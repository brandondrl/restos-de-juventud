process.env.TZ = 'America/Caracas';

const { caracasGetDay } = require('../../public/timezone.js');
const fs = require('fs');
const path = require('path');
const engine = require('../../public/prediction.js');
const {
  evaluateDay, summarizeEvaluations, walkForward, vetDayStart, median,
} = require('../../public/backtest-core.js');

// 2026-06-15 es lunes (dayOfWeek 1). Horas en VET = UTC-4.
const DAY = '2026-06-15';
const MONDAY = 1;

function vet(hour, minute = 0, day = 15) {
  return new Date(Date.UTC(2026, 5, day, hour + 4, minute)).toISOString();
}

function corte(startHour, startMinute, minutes, day = 15) {
  const start = vet(startHour, startMinute, day);
  const end = new Date(new Date(start).getTime() + minutes * 60000).toISOString();
  return { start, end, duration_minutes: minutes, type: 'corte' };
}

// Heatmap controlado: todo con confianza 1 y probabilidad 0, salvo los slots indicados del lunes.
function heatmapWith(riskyByHour = {}, { confidence = 1 } = {}) {
  const heatmap = {};
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      heatmap[`${day}_${hour}`] = { probability: 0, confidence, hits: 0, startHits: 0, observations: 4 };
    }
  }
  Object.entries(riskyByHour).forEach(([hour, probability]) => {
    heatmap[`${MONDAY}_${hour}`] = { probability, confidence, hits: 2, startHits: 1, observations: 4 };
  });
  return heatmap;
}

const RISK_14_15 = heatmapWith({ 14: 0.5, 15: 0.5 });

describe('evaluateDay — veredictos', () => {
  it('hit: corte a las 14:20 dentro de la ventana 14:00–16:00', () => {
    const result = evaluateDay([], [corte(14, 20, 50)], DAY, { heatmap: RISK_14_15 });
    expect(result.verdict).toBe('hit');
    expect(result.riskyRanges).toEqual([[14, 15]]);
    expect(result.outageStarts).toEqual([vet(14, 20)]);
    expect(result.timingMinutes).toEqual([0]);
  });

  it('hit en el borde exacto +30 min (16:30) y false_alarm un minuto después', () => {
    expect(evaluateDay([], [corte(16, 30, 20)], DAY, { heatmap: RISK_14_15 }).verdict).toBe('hit');
    expect(evaluateDay([], [corte(16, 31, 20)], DAY, { heatmap: RISK_14_15 }).verdict).toBe('false_alarm');
  });

  it('hit en el borde exacto −30 min (13:30) y false_alarm un minuto antes', () => {
    expect(evaluateDay([], [corte(13, 30, 20)], DAY, { heatmap: RISK_14_15 }).verdict).toBe('hit');
    expect(evaluateDay([], [corte(13, 29, 20)], DAY, { heatmap: RISK_14_15 }).verdict).toBe('false_alarm');
  });

  it('false_alarm: hubo ventana y ningún corte', () => {
    const result = evaluateDay([], [], DAY, { heatmap: RISK_14_15 });
    expect(result.verdict).toBe('false_alarm');
    expect(result.timingMinutes).toEqual([]);
  });

  it('missed: sin ventanas y con corte', () => {
    const result = evaluateDay([], [corte(9, 0, 60)], DAY, { heatmap: heatmapWith() });
    expect(result.verdict).toBe('missed');
    expect(result.riskyRanges).toEqual([]);
    expect(result.timingMinutes).toEqual([]);
  });

  it('quiet: sin ventanas y sin corte', () => {
    expect(evaluateDay([], [], DAY, { heatmap: heatmapWith() }).verdict).toBe('quiet');
  });

  it('no_data: ninguna hora llega a la confianza mínima', () => {
    const result = evaluateDay([], [corte(14, 20, 50)], DAY, { heatmap: heatmapWith({ 14: 0.9 }, { confidence: 0.1 }) });
    expect(result.verdict).toBe('no_data');
    expect(result.riskyRanges).toEqual([]);
  });

  it('no_data también sin heatmap (usuario sin historial)', () => {
    expect(evaluateDay([], [], DAY, { heatmap: null }).verdict).toBe('no_data');
  });

  it('una hora de madrugada sin inicios previos no cuenta como riesgo', () => {
    const heatmap = heatmapWith();
    heatmap[`${MONDAY}_2`] = { probability: 0.8, confidence: 1, hits: 3, startHits: 0, observations: 4 };
    expect(evaluateDay([], [], DAY, { heatmap }).verdict).toBe('quiet');
  });

  it('dos ventanas y corte en la segunda → hit con distancia 0', () => {
    const heatmap = heatmapWith({ 8: 0.5, 18: 0.5, 19: 0.5 });
    const result = evaluateDay([], [corte(19, 45, 30)], DAY, { heatmap });
    expect(result.riskyRanges).toEqual([[8, 8], [18, 19]]);
    expect(result.verdict).toBe('hit');
    expect(result.timingMinutes).toEqual([0]);
  });

  it('corte dentro y otro fuera → hit con extraOutages = 1', () => {
    const result = evaluateDay([], [corte(9, 0, 30), corte(14, 10, 30)], DAY, { heatmap: RISK_14_15 });
    expect(result.verdict).toBe('hit');
    expect(result.extraOutages).toBe(1);
    expect(result.timingMinutes).toEqual([300, 0]);
  });

  it('umbral configurable: con threshold 0.6 la ventana de 0.5 desaparece', () => {
    const result = evaluateDay([], [corte(14, 20, 50)], DAY, { heatmap: RISK_14_15, threshold: 0.6 });
    expect(result.verdict).toBe('missed');
  });

  it('ignora fluctuaciones como cortes', () => {
    const fluct = { start: vet(14, 20), end: vet(14, 20), duration_minutes: 0, type: 'fluctuacion' };
    const result = evaluateDay([], [fluct], DAY, { heatmap: RISK_14_15 });
    expect(result.verdict).toBe('false_alarm');
    expect(result.hourly[14].happened).toBe(false);
  });
});

describe('evaluateDay — detalle por hora', () => {
  it('marca happened solo en las horas que toca el corte y copia la probabilidad ajustada', () => {
    const result = evaluateDay([], [corte(14, 20, 50)], DAY, { heatmap: RISK_14_15 });
    expect(result.hourly).toHaveLength(24);
    expect(result.hourly.filter(h => h.happened).map(h => h.hour)).toEqual([14, 15]);
    expect(result.hourly[14]).toEqual({ hour: 14, adjusted: 0.5, happened: true, risky: true });
    expect(result.hourly[13]).toEqual({ hour: 13, adjusted: 0, happened: false, risky: false });
  });

  it('un corte que empieza el día anterior cuenta en las horas de hoy pero no como inicio', () => {
    const crossing = corte(23, 30, 90, 14); // domingo 23:30 → lunes 01:00
    const result = evaluateDay([], [crossing], DAY, { heatmap: heatmapWith() });
    expect(result.outageStarts).toEqual([]);
    expect(result.verdict).toBe('quiet');
    expect(result.hourly[0].happened).toBe(true);
    expect(result.hourly[1].happened).toBe(false);
  });

  it('acepta el día como string o como Date y da lo mismo', () => {
    const asString = evaluateDay([], [corte(14, 20, 50)], DAY, { heatmap: RISK_14_15 });
    const asDate = evaluateDay([], [corte(14, 20, 50)], new Date(vet(10, 0)), { heatmap: RISK_14_15 });
    expect(asDate).toEqual(asString);
    expect(asString.date).toBe(DAY);
  });

  it('vetDayStart devuelve las 00:00 VET (04:00 UTC) también con TZ=UTC', () => {
    expect(vetDayStart(DAY).toISOString()).toBe('2026-06-15T04:00:00.000Z');
    process.env.TZ = 'UTC';
    try {
      expect(vetDayStart(DAY).toISOString()).toBe('2026-06-15T04:00:00.000Z');
      expect(vetDayStart(new Date('2026-06-16T02:00:00Z')).toISOString()).toBe('2026-06-15T04:00:00.000Z');
    } finally {
      process.env.TZ = 'America/Caracas';
    }
  });
});

describe('summarizeEvaluations — métricas calculadas a mano', () => {
  // Día 1 hit (14:20, dentro), día 2 falsa alarma, día 3 missed (09:00), día 4 hit por margen (16:20).
  const evaluations = [
    evaluateDay([], [corte(14, 20, 50)], DAY, { heatmap: RISK_14_15 }),
    evaluateDay([], [], DAY, { heatmap: RISK_14_15 }),
    evaluateDay([], [corte(9, 0, 60)], DAY, { heatmap: heatmapWith() }),
    evaluateDay([], [corte(16, 20, 30)], DAY, { heatmap: RISK_14_15 }),
    evaluateDay([], [], DAY, { heatmap: null }),
  ];
  const summary = summarizeEvaluations(evaluations);

  it('cuenta veredictos y excluye no_data', () => {
    expect(summary.evaluatedDays).toBe(4);
    expect(summary.noDataDays).toBe(1);
    expect(summary.verdicts).toEqual({ hit: 2, false_alarm: 1, missed: 1, quiet: 0 });
  });

  it('hitRate = hit / (hit + missed) = 2/3', () => {
    expect(summary.hitRate).toBeCloseTo(2 / 3, 12);
  });

  it('falseAlarmRate = horas marcadas sin corte / horas marcadas = 4/6', () => {
    // Marcadas: 14 y 15 en los días 1, 2 y 4 (6). Sin corte: día 2 (2) + día 4 (2, el corte fue a las 16).
    expect(summary.falseAlarmRate).toBeCloseTo(4 / 6, 12);
  });

  it('brier horario = 3,5 / 96', () => {
    // Día 1: 2×(0,5−1)² = 0,5 · Día 2: 2×0,5² = 0,5 · Día 3: (0−1)² = 1 (hora 9)
    // Día 4: 2×0,5² + (0−1)² = 1,5 (hora 16). Total 3,5 sobre 4×24 horas.
    expect(summary.brier).toBeCloseTo(3.5 / 96, 12);
  });

  it('timingMarginMin = mediana de [0, 20] = 10', () => {
    expect(summary.timingMarginMin).toBe(10);
  });

  it('accuracy = (hit + quiet) / evaluados = 2/4', () => {
    expect(summary.accuracy).toBe(0.5);
  });

  it('sin días evaluables todas las métricas son null', () => {
    const empty = summarizeEvaluations([evaluateDay([], [], DAY, { heatmap: null })]);
    expect(empty).toMatchObject({ evaluatedDays: 0, hitRate: null, falseAlarmRate: null, brier: null, timingMarginMin: null, accuracy: null });
  });

  it('median maneja listas pares, impares y vacías', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('walkForward', () => {
  const outages = [
    corte(14, 20, 50, 1),
    corte(14, 10, 40, 8),
    corte(9, 0, 30, 10),
    corte(23, 30, 90, 14), // cruza a la madrugada del día 15
    corte(14, 5, 30, 15),
  ];

  it('entrena cada día solo con cortes terminados antes de las 00:00 VET de ese día', () => {
    const calls = [];
    const spyEngine = {
      ...engine,
      buildHeatmap: (list, now, opts) => {
        calls.push({ list, now, opts });
        return RISK_14_15;
      },
    };
    walkForward(outages, { from: '2026-06-13', to: '2026-06-15', engine: spyEngine, windowDays: 42 });
    expect(calls.map(c => c.now.toISOString())).toEqual([
      '2026-06-13T04:00:00.000Z', '2026-06-14T04:00:00.000Z', '2026-06-15T04:00:00.000Z',
    ]);
    calls.forEach(({ list, now }) => {
      list.forEach(o => expect(new Date(o.end).getTime()).toBeLessThanOrEqual(now.getTime()));
    });
    // El corte del domingo 23:30 aún no terminaba a las 00:00 del lunes: no entrena el lunes.
    expect(calls[2].list).toHaveLength(3);
    expect(calls[0].opts).toEqual({ windowDays: 42 });
  });

  it('evalúa cada día con los cortes que lo tocan, incluido el que viene de la noche anterior', () => {
    const { evaluations } = walkForward(outages, { from: '2026-06-15', to: '2026-06-15', engine: { ...engine, buildHeatmap: () => RISK_14_15 } });
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0].verdict).toBe('hit');
    expect(evaluations[0].hourly[0].happened).toBe(true);
    expect(evaluations[0].outageStarts).toEqual([vet(14, 5)]);
  });

  it('por defecto va del día siguiente al primer corte al día anterior al último evento', () => {
    const { from, to, evaluations } = walkForward(outages, { engine: { ...engine, buildHeatmap: () => null } });
    expect(from).toBe('2026-06-02');
    expect(to).toBe('2026-06-14');
    expect(evaluations).toHaveLength(13);
  });

  it('con now, el último día evaluado es el anterior a now', () => {
    const { to } = walkForward(outages, { now: new Date(vet(8, 0, 20)), engine: { ...engine, buildHeatmap: () => null } });
    expect(to).toBe('2026-06-19');
  });
});

describe('coherencia con el motor real', () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'b-seis-semanas.json'), 'utf8'));
  const dayStart = vetDayStart('2026-02-16');

  it('las ventanas del backtest son las mismas que muestra el forecast del día', () => {
    const heatmap = engine.buildHeatmap(fixture.outages, dayStart);
    const day = caracasGetDay(dayStart);
    const predictions = Array.from({ length: 24 }, (_, hour) => ({ hour, ...heatmap[`${day}_${hour}`] }));
    const forecast = engine.getDayForecast(predictions, fixture.outages, { now: dayStart, activeOutage: { id: 'x' } });
    const result = evaluateDay(fixture.outages, [], '2026-02-16');
    expect(forecast.type).toBe('already_hit');
    expect(result.riskyRanges).toEqual(forecast.ranges);
    expect(result.verdict).toBe('false_alarm');
  });

  it('en el patrón regular, el lunes siguiente con corte a las 14:10 es hit', () => {
    const mondayOutage = {
      start: '2026-02-16T18:10:00.000Z', end: '2026-02-16T19:40:00.000Z', duration_minutes: 90, type: 'corte',
    };
    const result = evaluateDay(fixture.outages, [mondayOutage], '2026-02-16');
    expect(result.verdict).toBe('hit');
    expect(result.timingMinutes).toEqual([0]);
  });

  it('da lo mismo con TZ=UTC', () => {
    const inCaracas = evaluateDay(fixture.outages, [], '2026-02-16');
    process.env.TZ = 'UTC';
    try {
      expect(evaluateDay(fixture.outages, [], '2026-02-16')).toEqual(inCaracas);
    } finally {
      process.env.TZ = 'America/Caracas';
    }
  });
});
