process.env.TZ = 'America/Caracas';

const fs = require('fs');
const path = require('path');
const { caracasGetDay, caracasGetHours } = require('../../public/timezone.js');
const engine = require('../../public/prediction.js');
const {
  predictionsForDay, riskRangesFromPredictions, buildRiskCurveProps, buildWeeklyHeatGridProps,
  tomorrowDayOfWeek, restOfTodayHasRisk, resolveForecastDay, readStoredForecastDay,
  saveForecastDayChoice, FORECAST_DAY_STORAGE_KEY,
} = require('../../public/chart-data.js');

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', `${name}.json`), 'utf8'));
}

// Heatmap controlado: confianza 1 en todo, probabilidades solo donde se indique ('día_hora').
function heatmapWith(slots = {}) {
  const heatmap = {};
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      heatmap[`${day}_${hour}`] = { probability: 0, confidence: 1, hits: 0, startHits: 0, observations: 4 };
    }
  }
  Object.entries(slots).forEach(([key, probability]) => {
    heatmap[key] = { probability, confidence: 1, hits: 2, startHits: 1, observations: 6 };
  });
  return heatmap;
}

function formatRanges(ranges) {
  const texts = ranges.map(([a, b]) => {
    const pad = h => String(h).padStart(2, '0');
    return a === b ? `${pad(a)}:00` : `${pad(a)}:00–${pad(b + 1)}:00`;
  });
  return texts.length === 1 ? texts[0] : texts.slice(0, -1).join(', ') + ' y ' + texts.slice(-1);
}

const fixtureB = loadFixture('b-seis-semanas');
const fixtureC = loadFixture('c-cambio-patron');
const fixtureE = loadFixture('e-fluctuaciones');

// 2026-06-13 es sábado. 21:00 VET = domingo 2026-06-14 01:00 UTC.
const SATURDAY_2100_VET = new Date('2026-06-14T01:00:00Z');

describe('buildForecastForDay — núcleo común de hoy y mañana', () => {
  test('se exporta desde el motor', () => {
    expect(typeof engine.buildForecastForDay).toBe('function');
  });

  test('para mañana da los mismos rangos, pico y margen que getTomorrowForecast (fixture c)', () => {
    const now = new Date(fixtureC.now);
    const heatmap = engine.buildHeatmap(fixtureC.outages, now);
    const core = engine.buildForecastForDay(heatmap, fixtureC.outages, tomorrowDayOfWeek(now));
    const tomorrow = engine.getTomorrowForecast(fixtureC.outages, heatmap, now);
    expect(core.hasData).toBe(true);
    expect(formatRanges(core.ranges)).toBe(tomorrow.ranges);
    expect(core.peakHour).toBe(tomorrow.peakHour);
    expect(core.peakPercent).toBe(tomorrow.peakPercent);
    expect(core.peakLevel).toBe(tomorrow.peakLevel);
    expect(core.marginOfError).toBe(tomorrow.marginOfError);
  });

  test('para hoy da los mismos rangos y pico que getDayForecast (fixture e, already_hit)', () => {
    const now = new Date(fixtureE.now);
    const heatmap = engine.buildHeatmap(fixtureE.outages, now);
    const today = caracasGetDay(now);
    const forecast = engine.getDayForecast(predictionsForDay(heatmap, today), fixtureE.outages,
      { now, activeOutage: fixtureE.activeOutage });
    const core = engine.buildForecastForDay(heatmap, fixtureE.outages, today);
    expect(forecast.type).toBe('already_hit');
    expect(core.ranges).toEqual(forecast.ranges);
    expect(core.peakHour).toBe(forecast.peakHour);
  });

  test('acepta las predicciones ya armadas (como las recibe getDayForecast)', () => {
    const now = new Date(fixtureC.now);
    const heatmap = engine.buildHeatmap(fixtureC.outages, now);
    const day = caracasGetDay(now);
    const fromHeatmap = engine.buildForecastForDay(heatmap, fixtureC.outages, day);
    const fromPredictions = engine.buildForecastForDay(null, fixtureC.outages, day,
      { predictions: predictionsForDay(heatmap, day) });
    expect(fromPredictions.ranges).toEqual(fromHeatmap.ranges);
    expect(fromPredictions.peakPercent).toBe(fromHeatmap.peakPercent);
    expect(fromPredictions.estimatedMinutes).toBe(fromHeatmap.estimatedMinutes);
  });

  test('sin datos suficientes → hasData false y sin rangos', () => {
    const empty = heatmapWith();
    Object.values(empty).forEach(slot => { slot.confidence = 0.1; });
    const core = engine.buildForecastForDay(empty, [], 3);
    expect(core.hasData).toBe(false);
    expect(core.ranges).toEqual([]);
  });

  test('día sin horas de riesgo → hasData true, rangos vacíos, sin pico', () => {
    const core = engine.buildForecastForDay(heatmapWith({ '3_14': 0.1 }), [], 3);
    expect(core.hasData).toBe(true);
    expect(core.ranges).toEqual([]);
    expect(core.peakHour).toBeUndefined();
  });
});

describe('getTomorrowForecast — campos nuevos (sin quitar nada)', () => {
  const now = new Date(fixtureC.now);
  const heatmap = engine.buildHeatmap(fixtureC.outages, now);
  const tomorrow = engine.getTomorrowForecast(fixtureC.outages, heatmap, now);

  test('añade estimatedMinutes = promedio de duración de las horas de riesgo', () => {
    const durations = engine.averageDurationByHour(fixtureC.outages);
    const core = engine.buildForecastForDay(heatmap, fixtureC.outages, tomorrowDayOfWeek(now));
    const values = core.riskyHours.map(p => durations[p.hour]).filter(Boolean);
    const expected = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
    expect(tomorrow.estimatedMinutes).toBe(expected);
    expect(tomorrow.estimatedMinutes).toBeGreaterThan(0);
  });

  test('añade onsetHint del día de mañana en la hora pico', () => {
    const expected = engine.getOnsetHint(fixtureC.outages, tomorrowDayOfWeek(now), tomorrow.peakHour);
    expect(tomorrow).toHaveProperty('onsetHint');
    expect(tomorrow.onsetHint).toBe(expected);
  });

  test('conserva exactamente los campos existentes', () => {
    expect(tomorrow).toMatchObject({
      type: 'risk', ranges: '07:00–10:00 y 14:00–19:00', peakHour: 16, peakPercent: 65,
      peakLevel: 'alto', marginOfError: 24,
    });
  });

  test('"safe" y null no cambian (fixture b y usuario sin datos)', () => {
    const nowB = new Date(fixtureB.now);
    expect(engine.getTomorrowForecast(fixtureB.outages, engine.buildHeatmap(fixtureB.outages, nowB), nowB))
      .toEqual({ type: 'safe' });
    expect(engine.getTomorrowForecast([], null, nowB)).toBeNull();
  });
});

describe('getDayPredictions', () => {
  test('24 puntos { hour, adjusted, confidence, observations, level }', () => {
    const heatmap = heatmapWith({ '2_14': 0.42 });
    heatmap['2_14'].confidence = 0.5;
    const points = engine.getDayPredictions(heatmap, 2);
    expect(points).toHaveLength(24);
    expect(Object.keys(points[14]).sort()).toEqual(['adjusted', 'confidence', 'hour', 'level', 'observations']);
    expect(points[14].hour).toBe(14);
    expect(points[14].adjusted).toBeCloseTo(engine.adjustedProbability(0.42, 0.5));
    expect(points[14].confidence).toBe(0.5);
    expect(points[14].observations).toBe(6);
    expect(points[14].level).toBe(engine.riskLabel(points[14].adjusted, 0.5));
  });

  test('confianza baja → adjusted 0 y "Sin datos"; slots ausentes o heatmap null no revientan', () => {
    const heatmap = heatmapWith();
    heatmap['4_9'].confidence = 0.1;
    delete heatmap['4_10'];
    const points = engine.getDayPredictions(heatmap, 4);
    expect(points[9]).toMatchObject({ adjusted: 0, level: 'Sin datos' });
    expect(points[10]).toEqual({ hour: 10, adjusted: 0, confidence: 0, observations: 0, level: 'Sin datos' });
    const none = engine.getDayPredictions(null, 4);
    expect(none).toHaveLength(24);
    expect(none.every(p => p.adjusted === 0 && p.level === 'Sin datos')).toBe(true);
  });

  test('coincide con los puntos de la gráfica', () => {
    const now = new Date(fixtureC.now);
    const heatmap = engine.buildHeatmap(fixtureC.outages, now);
    const props = buildRiskCurveProps({ id: 'x', heatmap, now, day: 'tomorrow' });
    const points = engine.getDayPredictions(heatmap, tomorrowDayOfWeek(now));
    expect(props.points.map(p => p.value)).toEqual(points.map(p => p.adjusted));
    expect(props.points.map(p => p.level)).toEqual(points.map(p => p.level));
  });
});

describe('gráfica Hoy / Mañana', () => {
  const now = new Date(fixtureC.now);
  const heatmap = engine.buildHeatmap(fixtureC.outages, now);
  const today = buildRiskCurveProps({ id: 'risk-today', heatmap, now, day: 'today' });
  const tomorrow = buildRiskCurveProps({ id: 'risk-tomorrow', heatmap, now, day: 'tomorrow' });

  test('Hoy: marca de "ahora" y serie fantasma = mañana', () => {
    expect(today.nowHour).toBe(caracasGetHours(now));
    expect(today.ghostPoints.map(p => p.value)).toEqual(tomorrow.points.map(p => p.value));
  });

  test('Mañana: sin marca de "ahora" y serie fantasma = hoy', () => {
    expect(tomorrow.nowHour).toBeUndefined();
    expect(tomorrow.ghostPoints.map(p => p.value)).toEqual(today.points.map(p => p.value));
    expect(tomorrow.ariaLabel).toMatch(/^Riesgo por hora mañana/);
  });

  test('misma escala Y en ambos', () => {
    expect(tomorrow.yMax).toBe(today.yMax);
  });

  test('bandas de mañana == rangos del texto de mañana', () => {
    const text = engine.getTomorrowForecast(fixtureC.outages, heatmap, now).ranges;
    expect(tomorrow.riskBands.length).toBeGreaterThan(0);
    expect(formatRanges(tomorrow.riskBands)).toBe(text);
  });

  test('bandas de mañana == rangos del texto en todos los fixtures con riesgo', () => {
    ['c-cambio-patron', 'd-cruce-medianoche', 'e-fluctuaciones'].forEach(name => {
      const fixture = loadFixture(name);
      const at = new Date(fixture.now);
      const hm = engine.buildHeatmap(fixture.outages, at);
      const props = buildRiskCurveProps({ id: 'm', heatmap: hm, now: at, day: 'tomorrow' });
      expect(formatRanges(props.riskBands)).toBe(engine.getTomorrowForecast(fixture.outages, hm, at).ranges);
    });
  });

  test('selectedHour se respeta en la vista de mañana', () => {
    expect(buildRiskCurveProps({ id: 'm', heatmap, now, day: 'tomorrow', selectedHour: 9 }).selectedHour).toBe(9);
  });

  test('el heatmap resalta la fila del día elegido', () => {
    const tomorrowDay = tomorrowDayOfWeek(now);
    expect(buildWeeklyHeatGridProps({ id: 'h', heatmap, now, highlightDay: tomorrowDay }).highlightRows)
      .toEqual([tomorrowDay]);
    expect(buildWeeklyHeatGridProps({ id: 'h', heatmap, now }).highlightRows).toEqual([caracasGetDay(now)]);
  });
});

describe('borde de zona horaria', () => {
  const sundayOnly = heatmapWith({ '0_15': 0.5, '1_9': 0.9 });

  test('sábado 21:00 VET (= domingo 01:00 UTC) → mañana es domingo', () => {
    expect(tomorrowDayOfWeek(SATURDAY_2100_VET)).toBe(0);
  });

  test('getTomorrowForecast del sábado 21:00 VET usa el domingo, no el lunes', () => {
    const forecast = engine.getTomorrowForecast([], sundayOnly, SATURDAY_2100_VET);
    expect(forecast.type).toBe('risk');
    expect(forecast.peakHour).toBe(15);
  });

  test('la gráfica de mañana del sábado 21:00 VET dibuja el domingo', () => {
    const props = buildRiskCurveProps({ id: 'm', heatmap: sundayOnly, now: SATURDAY_2100_VET, day: 'tomorrow' });
    expect(props.riskBands).toEqual(riskRangesFromPredictions(predictionsForDay(sundayOnly, 0)));
    expect(props.points[15].value).toBeCloseTo(0.5);
  });
});

describe('preselección de Mañana desde las 20:00 VET', () => {
  // Lunes 2026-06-15. 20:00 VET = 2026-06-16T00:00Z.
  const at = (h, m = 0) => new Date(Date.UTC(2026, 5, 16, h - 20, m));
  const lateRisk = heatmapWith({ '1_22': 0.6 });
  const morningRisk = heatmapWith({ '1_9': 0.6 });

  test('20:00 sin riesgo en el resto de hoy → mañana', () => {
    expect(restOfTodayHasRisk(morningRisk, at(20))).toBe(false);
    expect(resolveForecastDay({ heatmap: morningRisk, now: at(20) })).toBe('tomorrow');
  });

  test('19:59 → sigue en hoy', () => {
    expect(resolveForecastDay({ heatmap: morningRisk, now: at(19, 59) })).toBe('today');
  });

  test('20:00 con riesgo a las 22:00 → hoy', () => {
    expect(restOfTodayHasRisk(lateRisk, at(20))).toBe(true);
    expect(resolveForecastDay({ heatmap: lateRisk, now: at(20) })).toBe('today');
  });

  test('la hora en curso cuenta como "resto de hoy"', () => {
    expect(restOfTodayHasRisk(heatmapWith({ '1_20': 0.6 }), at(20, 45))).toBe(true);
  });

  test('si el usuario eligió en la sesión, se respeta su elección', () => {
    expect(resolveForecastDay({ manual: 'today', heatmap: morningRisk, now: at(21) })).toBe('today');
    expect(resolveForecastDay({ manual: 'tomorrow', heatmap: lateRisk, now: at(10) })).toBe('tomorrow');
  });

  test('lo guardado de otra sesión se usa, pero la preselección de las 20:00 manda', () => {
    expect(resolveForecastDay({ stored: 'tomorrow', heatmap: lateRisk, now: at(10) })).toBe('tomorrow');
    expect(resolveForecastDay({ stored: 'today', heatmap: morningRisk, now: at(20) })).toBe('tomorrow');
    expect(resolveForecastDay({ stored: 'basura', heatmap: lateRisk, now: at(10) })).toBe('today');
  });

  test('sin heatmap → hoy', () => {
    expect(resolveForecastDay({ heatmap: null, now: at(22) })).toBe('today');
  });
});

describe('elección Hoy / Mañana: localStorage y red', () => {
  function memoryStorage() {
    const data = {};
    return {
      data,
      getItem: key => (key in data ? data[key] : null),
      setItem: (key, value) => { data[key] = String(value); },
    };
  }
  const throwing = {
    getItem: () => { throw new Error('bloqueado'); },
    setItem: () => { throw new Error('bloqueado'); },
  };

  test('guarda la elección en rdj_forecast_day y en el estado de la sesión', () => {
    const storage = memoryStorage();
    const state = {};
    expect(FORECAST_DAY_STORAGE_KEY).toBe('rdj_forecast_day');
    expect(saveForecastDayChoice(state, 'tomorrow', storage)).toBe(true);
    expect(state).toMatchObject({ forecastDay: 'tomorrow', forecastDayManual: 'tomorrow' });
    expect(storage.data.rdj_forecast_day).toBe('tomorrow');
    expect(readStoredForecastDay(storage)).toBe('tomorrow');
  });

  test('valores inválidos se ignoran', () => {
    const storage = memoryStorage();
    const state = {};
    expect(saveForecastDayChoice(state, 'pasado', storage)).toBe(false);
    expect(state).toEqual({});
    storage.setItem('rdj_forecast_day', 'x');
    expect(readStoredForecastDay(storage)).toBeNull();
  });

  test('localStorage bloqueado o ausente no rompe (modo privado / iOS)', () => {
    const state = {};
    expect(saveForecastDayChoice(state, 'today', throwing)).toBe(true);
    expect(state.forecastDay).toBe('today');
    expect(readStoredForecastDay(throwing)).toBeNull();
    expect(readStoredForecastDay(null)).toBeNull();
    expect(saveForecastDayChoice({}, 'today', null)).toBe(true);
  });

  test('cambiar Hoy↔Mañana no hace peticiones de red', () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn();
    try {
      const state = {};
      saveForecastDayChoice(state, 'tomorrow', memoryStorage());
      saveForecastDayChoice(state, 'today', memoryStorage());
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
    // El handler de la app solo guarda la elección y re-renderiza (sin http/fetch).
    const app = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'app.js'), 'utf8');
    const match = app.match(/function setForecastDay\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    expect(match).not.toBeNull();
    expect(match[1]).toMatch(/saveForecastDayChoice\(/);
    expect(match[1]).not.toMatch(/http\.|fetch\(|load\w*\(|refresh\w*\(/);
  });
});

describe('buildForecastForDay — detalles perezosos', () => {
  test('details: false omite estimatedMinutes y onsetHint sin cambiar el resto', () => {
    const now = new Date(fixtureC.now);
    const heatmap = engine.buildHeatmap(fixtureC.outages, now);
    const day = tomorrowDayOfWeek(now);
    const full = engine.buildForecastForDay(heatmap, fixtureC.outages, day);
    const light = engine.buildForecastForDay(heatmap, fixtureC.outages, day, { details: false });
    expect(light).not.toHaveProperty('estimatedMinutes');
    expect(light).not.toHaveProperty('onsetHint');
    const { estimatedMinutes, onsetHint, ...rest } = full;
    expect(estimatedMinutes).toBeGreaterThan(0);
    expect(onsetHint === null || typeof onsetHint === 'string').toBe(true);
    expect(light).toEqual(rest);
  });
});
