process.env.TZ = 'America/Caracas';

require('../../public/timezone.js');
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

// Ejecuta las 5 funciones del motor tal como las llama la app, con el reloj fijado en fixture.now.
function computeAll(fixture) {
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
    expect(result.tomorrowForecast).toMatchSnapshot();
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
});
