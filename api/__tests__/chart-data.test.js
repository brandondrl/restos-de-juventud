process.env.TZ = 'America/Caracas';

const fs = require('fs');
const path = require('path');
require('../../public/timezone.js');
const engine = require('../../public/prediction.js');
const { niceMax } = require('../../public/charts.js');
const {
  predictionsForDay, riskRangesFromPredictions, buildRiskCurveProps, buildWeeklyHeatGridProps,
} = require('../../public/chart-data.js');

const fixtureB = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'b-seis-semanas.json'), 'utf8'));

// Heatmap controlado: confianza 1 en todo, probabilidades solo donde se indique ('día_hora').
function heatmapWith(slots = {}, { confidence = 1 } = {}) {
  const heatmap = {};
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      heatmap[`${day}_${hour}`] = { probability: 0, confidence, hits: 0, startHits: 0, observations: 4 };
    }
  }
  Object.entries(slots).forEach(([key, probability]) => {
    heatmap[key] = { probability, confidence, hits: 2, startHits: 1, observations: 6 };
  });
  return heatmap;
}

// 2026-06-15 es lunes (1). 18:30 VET = 22:30 UTC.
const MONDAY_1830 = new Date('2026-06-15T22:30:00Z');

describe('predictionsForDay', () => {
  test('24 horas con el slot del heatmap o ceros por defecto', () => {
    const heatmap = heatmapWith({ '1_14': 0.5 });
    delete heatmap['1_3'];
    const predictions = predictionsForDay(heatmap, 1);
    expect(predictions).toHaveLength(24);
    expect(predictions[14]).toMatchObject({ hour: 14, probability: 0.5, confidence: 1 });
    expect(predictions[3]).toEqual({ hour: 3, probability: 0, confidence: 0 });
    expect(predictionsForDay(null, 1)).toEqual([]);
  });
});

describe('buildRiskCurveProps', () => {
  test('misma data que antes: valor = adjustedProbability, nivel en texto, observaciones', () => {
    const heatmap = heatmapWith({ '1_14': 0.42 }, { confidence: 0.5 });
    const props = buildRiskCurveProps({ id: 'hoy', heatmap, now: MONDAY_1830 });
    expect(props.points).toHaveLength(24);
    expect(props.points[14].value).toBeCloseTo(engine.adjustedProbability(0.42, 0.5));
    expect(props.points[14].level).toBe(engine.riskLabel(props.points[14].value, 0.5));
    expect(props.points[14].observations).toBe(6);
    expect(props.threshold).toBe(engine.RISK_THRESHOLD);
  });

  test('nowHour es la hora VET', () => {
    const props = buildRiskCurveProps({ id: 'hoy', heatmap: heatmapWith(), now: MONDAY_1830 });
    expect(props.nowHour).toBe(18);
  });

  test('yMax = niceMax del máximo de hoy y mañana juntos (piso 0,30)', () => {
    const quiet = buildRiskCurveProps({ id: 'hoy', heatmap: heatmapWith({ '1_9': 0.1 }), now: MONDAY_1830 });
    expect(quiet.yMax).toBe(0.3);
    const tomorrowHigher = buildRiskCurveProps({ id: 'hoy', heatmap: heatmapWith({ '1_9': 0.2, '2_15': 0.66 }), now: MONDAY_1830 });
    expect(tomorrowHigher.yMax).toBe(niceMax(0.66));
    expect(tomorrowHigher.yMax).toBe(0.7);
    // Un día que no es ni hoy ni mañana no cuenta.
    const otherDay = buildRiskCurveProps({ id: 'hoy', heatmap: heatmapWith({ '4_15': 0.9 }), now: MONDAY_1830 });
    expect(otherDay.yMax).toBe(0.3);
  });

  test('domingo → mañana es lunes (día 0 → 1)', () => {
    const sunday = new Date('2026-06-14T15:00:00Z');
    const props = buildRiskCurveProps({ id: 'hoy', heatmap: heatmapWith({ '1_10': 0.55 }), now: sunday });
    expect(props.yMax).toBe(0.6);
  });

  test('bandas de riesgo == rangos del forecast del motor (fixture b)', () => {
    const now = new Date('2026-02-16T23:30:00Z'); // lunes 19:30 VET, sin corte hoy → 'missed' con rangos
    const heatmap = engine.buildHeatmap(fixtureB.outages, now);
    const predictions = predictionsForDay(heatmap, 1);
    const forecast = engine.getDayForecast(predictions, fixtureB.outages, { now, activeOutage: null });
    expect(forecast.type).toBe('missed');
    const props = buildRiskCurveProps({ id: 'hoy', heatmap, now });
    expect(props.riskBands).toEqual(forecast.ranges);
    expect(props.riskBands.length).toBeGreaterThan(0);
  });

  test('riskRangesFromPredictions agrupa horas contiguas y respeta el filtro de madrugada', () => {
    const heatmap = heatmapWith({ '1_2': 0.5, '1_7': 0.3, '1_8': 0.3, '1_9': 0.3, '1_15': 0.2 });
    heatmap['1_2'].startHits = 0; // madrugada sin inicios: no es hora de riesgo
    expect(riskRangesFromPredictions(predictionsForDay(heatmap, 1))).toEqual([[7, 9], [15, 15]]);
    expect(riskRangesFromPredictions([])).toEqual([]);
  });

  test('aria-label con pico y rangos de riesgo', () => {
    const heatmap = heatmapWith({ '1_13': 0.3, '1_14': 0.42, '1_15': 0.2 });
    const props = buildRiskCurveProps({ id: 'hoy', heatmap, now: MONDAY_1830 });
    expect(props.ariaLabel).toBe('Riesgo por hora hoy: pico 42 % a las 14:00, riesgo entre 13:00 y 16:00');
    const twoRanges = buildRiskCurveProps({ id: 'hoy', heatmap: heatmapWith({ '1_7': 0.3, '1_18': 0.5 }), now: MONDAY_1830 });
    expect(twoRanges.ariaLabel).toBe('Riesgo por hora hoy: pico 50 % a las 18:00, riesgo entre 07:00 y 08:00 y entre 18:00 y 19:00');
    const flat = buildRiskCurveProps({ id: 'hoy', heatmap: heatmapWith(), now: MONDAY_1830 });
    expect(flat.ariaLabel).toBe('Riesgo por hora hoy: sin horas de riesgo');
  });

  test('selectedHour se pasa tal cual solo si es una hora válida', () => {
    const heatmap = heatmapWith();
    expect(buildRiskCurveProps({ id: 'hoy', heatmap, now: MONDAY_1830, selectedHour: 5 }).selectedHour).toBe(5);
    expect(buildRiskCurveProps({ id: 'hoy', heatmap, now: MONDAY_1830, selectedHour: 30 }).selectedHour).toBeUndefined();
    expect(buildRiskCurveProps({ id: 'hoy', heatmap, now: MONDAY_1830 }).selectedHour).toBeUndefined();
  });
});

describe('buildWeeklyHeatGridProps', () => {
  test('7×24, confianza < 0,15 → sin datos (null); resto = adjustedProbability', () => {
    const heatmap = heatmapWith({ '1_14': 0.5 });
    heatmap['3_4'] = { probability: 0.9, confidence: 0.1, observations: 1 };
    const props = buildWeeklyHeatGridProps({ id: 'semana', heatmap, now: MONDAY_1830 });
    expect(props.cells).toHaveLength(7);
    props.cells.forEach(row => expect(row).toHaveLength(24));
    expect(props.cells[1][14].value).toBeCloseTo(0.5);
    expect(props.cells[1][14].label).toBe('Lun 14:00 · 50 %');
    expect(props.cells[3][4].value).toBeNull();
    expect(props.cells[3][4].label).toBe('Mié 04:00 · sin datos');
    expect(props.cells[2][0].value).toBe(0);
  });

  test('fila de hoy resaltada y celda de "ahora" en hora VET', () => {
    const props = buildWeeklyHeatGridProps({ id: 'semana', heatmap: heatmapWith(), now: MONDAY_1830 });
    expect(props.rowLabels).toEqual(['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']);
    expect(props.highlightRows).toEqual([1]);
    expect(props.nowCell).toEqual({ row: 1, col: 18 });
    expect(props.colLabels[0]).toBe('00');
    expect(props.colLabels[3]).toBe('03');
    expect(props.colLabels[1]).toBe('');
    expect(props.ariaLabel).toMatch(/^Mapa de calor semanal/);
  });
});
