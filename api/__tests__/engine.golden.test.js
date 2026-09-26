process.env.TZ = 'America/Caracas';

const { caracasGetDay } = require('../../public/timezone.js');
const fs = require('fs');
const path = require('path');
const engine = require('../../public/prediction.js');

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const FIXTURE_FILES = [
  'a-usuario-nuevo',
  'b-seis-semanas',
  'c-cambio-patron',
  'd-cruce-medianoche',
  'e-fluctuaciones',
];

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, `${name}.json`), 'utf8'));
}

function todayPredictions(heatmap, now) {
  if (!heatmap) return [];
  const day = caracasGetDay(now);
  return Array.from({ length: 24 }, (_, hour) => ({
    hour, ...(heatmap[`${day}_${hour}`] || { probability: 0, confidence: 0 }),
  }));
}

// 2.2 añade estos campos a getTomorrowForecast. El snapshot congela solo los campos
// existentes, que deben quedar idénticos (el .snap no se regenera).
const TOMORROW_FIELDS_ADDED_IN_2_2 = ['estimatedMinutes', 'onsetHint'];

function existingTomorrowFields(forecast) {
  if (!forecast) return forecast;
  const copy = { ...forecast };
  TOMORROW_FIELDS_ADDED_IN_2_2.forEach(field => { delete copy[field]; });
  return copy;
}

// Ejecuta las 5 funciones del motor con `now` y `activeOutage` explícitos.
function computeAll(fixture) {
  const now = new Date(fixture.now);
  const heatmap = engine.buildHeatmap(fixture.outages, now);
  const predictions = todayPredictions(heatmap, now);
  return {
    heatmap,
    dayForecast: heatmap
      ? engine.getDayForecast(predictions, fixture.outages, { now, activeOutage: fixture.activeOutage })
      : { type: 'nodata' },
    tomorrowForecast: engine.getTomorrowForecast(fixture.outages, heatmap, now),
    statistics: JSON.parse(JSON.stringify(engine.computeStatistics(fixture.outages, now))),
    consecutive: engine.getConsecutiveOutageStatus(fixture.outages, now),
  };
}

// Llamada "como la app hoy": sin `now` (reloj simulado) y el corte activo en `window`.
function computeAllLegacy(fixture) {
  const now = new Date(fixture.now);
  jest.useFakeTimers();
  jest.setSystemTime(now);
  global.window = { _activeOutage: fixture.activeOutage };
  try {
    const heatmap = engine.buildHeatmap(fixture.outages);
    const predictions = todayPredictions(heatmap, now);
    return {
      heatmap,
      dayForecast: heatmap ? engine.getDayForecast(predictions, fixture.outages) : { type: 'nodata' },
      tomorrowForecast: engine.getTomorrowForecast(fixture.outages, heatmap),
      statistics: JSON.parse(JSON.stringify(engine.computeStatistics(fixture.outages))),
      consecutive: engine.getConsecutiveOutageStatus(fixture.outages, now),
    };
  } finally {
    delete global.window;
    jest.useRealTimers();
  }
}

describe.each(FIXTURE_FILES)('golden del motor — %s', (name) => {
  const fixture = loadFixture(name);
  const result = computeAll(fixture);

  it('buildHeatmap', () => {
    expect(result.heatmap).toMatchSnapshot();
  });

  it('getDayForecast', () => {
    expect(result.dayForecast).toMatchSnapshot();
  });

  it('getTomorrowForecast', () => {
    expect(existingTomorrowFields(result.tomorrowForecast)).toMatchSnapshot();
  });

  it('getTomorrowForecast solo añade los campos de 2.2 (y solo cuando hay riesgo)', () => {
    const forecast = result.tomorrowForecast;
    if (!forecast || forecast.type !== 'risk') {
      TOMORROW_FIELDS_ADDED_IN_2_2.forEach(field => expect(forecast || {}).not.toHaveProperty(field));
      return;
    }
    TOMORROW_FIELDS_ADDED_IN_2_2.forEach(field => expect(forecast).toHaveProperty(field));
  });

  it('computeStatistics', () => {
    expect(result.statistics).toMatchSnapshot();
  });

  it('getConsecutiveOutageStatus', () => {
    expect(result.consecutive).toMatchSnapshot();
  });

  it('da exactamente lo mismo con TZ=UTC', () => {
    process.env.TZ = 'UTC';
    try {
      expect(computeAll(fixture)).toEqual(result);
    } finally {
      process.env.TZ = 'America/Caracas';
    }
  });

  it('sin `now` ni `activeOutage` (reloj real + window) da lo mismo que con ellos', () => {
    expect(computeAllLegacy(fixture)).toEqual(result);
  });
});

describe('getDayForecast — corte activo explícito vs window._activeOutage', () => {
  const fixture = loadFixture('b-seis-semanas');
  const now = new Date(fixture.now);
  const heatmap = engine.buildHeatmap(fixture.outages, now);
  const predictions = todayPredictions(heatmap, now);
  const active = { id: 'x', start: fixture.now, end: null, type: 'corte' };

  afterEach(() => { delete global.window; });

  it('activeOutage explícito marca already_hit aunque window no tenga corte', () => {
    global.window = { _activeOutage: null };
    const forecast = engine.getDayForecast(predictions, fixture.outages, { now, activeOutage: active });
    expect(forecast.type).toBe('already_hit');
    expect(forecast.active).toBe(true);
  });

  it('activeOutage: null explícito ignora el corte de window', () => {
    global.window = { _activeOutage: active };
    const forecast = engine.getDayForecast(predictions, fixture.outages, { now, activeOutage: null });
    expect(forecast.type).toBe('risk');
  });

  it('sin activeOutage cae a window._activeOutage', () => {
    global.window = { _activeOutage: active };
    const forecast = engine.getDayForecast(predictions, fixture.outages, { now });
    expect(forecast.type).toBe('already_hit');
  });

  it('funciona en Node sin window definido', () => {
    const forecast = engine.getDayForecast(predictions, fixture.outages, { now });
    expect(forecast.type).toBe('risk');
  });
});

describe('buildHeatmap — opciones nuevas', () => {
  const fixture = loadFixture('c-cambio-patron');
  const now = new Date(fixture.now);

  it('windowDays: 84 explícito es idéntico al valor por defecto', () => {
    expect(engine.buildHeatmap(fixture.outages, now, { windowDays: 84 }))
      .toEqual(engine.buildHeatmap(fixture.outages, now));
  });

  it('una ventana corta deja fuera el patrón viejo de la mañana', () => {
    const short = engine.buildHeatmap(fixture.outages, now, { windowDays: 42 });
    const full = engine.buildHeatmap(fixture.outages, now);
    const morningHits = heatmap => Object.keys(heatmap)
      .filter(key => Number(key.split('_')[1]) === 7)
      .reduce((sum, key) => sum + heatmap[key].hits, 0);
    expect(morningHits(short)).toBe(0);
    expect(morningHits(full)).toBeGreaterThan(0);
  });

  it('isRiskyHour aplica el umbral y el filtro de madrugada sin inicios', () => {
    expect(engine.isRiskyHour({ hour: 14, probability: 0.5, confidence: 1 })).toBe(true);
    expect(engine.isRiskyHour({ hour: 14, probability: 0.1, confidence: 1 })).toBe(false);
    expect(engine.isRiskyHour({ hour: 3, probability: 0.5, confidence: 1, startHits: 0 })).toBe(false);
    expect(engine.isRiskyHour({ hour: 3, probability: 0.5, confidence: 1, startHits: 1 })).toBe(true);
    expect(engine.isRiskyHour({ hour: 14, probability: 0.5, confidence: 1 }, 0.6)).toBe(false);
  });
});
