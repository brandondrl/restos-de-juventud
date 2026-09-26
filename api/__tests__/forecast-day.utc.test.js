// Borde de zona horaria de 2.2 con el proceso en UTC real (jest no cambia la zona con
// process.env.TZ; ver chart-data.utc.test.js). Sábado 21:00 VET = domingo 01:00 UTC.
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..').replace(/\\/g, '/');

const SCRIPT = `
require('${ROOT}/public/timezone.js');
const engine = require('${ROOT}/public/prediction.js');
const { buildRiskCurveProps, tomorrowDayOfWeek, resolveForecastDay } = require('${ROOT}/public/chart-data.js');
const fs = require('fs');
let source = fs.readFileSync('${ROOT}/bot/worker.js', 'utf8');
source = source.slice(0, source.indexOf('export default {'));
const bot = {};
new Function('sandbox', source + '\\nsandbox.buildTomorrowRiskMessage = buildTomorrowRiskMessage;'
  + '\\nsandbox.calculateDayRisk = calculateDayRisk;')(bot);

const heatmap = {};
for (let day = 0; day < 7; day++) {
  for (let hour = 0; hour < 24; hour++) heatmap[day + '_' + hour] = { probability: 0, confidence: 1, startHits: 0, observations: 4 };
}
heatmap['0_15'] = { probability: 0.5, confidence: 1, startHits: 1, observations: 4 }; // domingo
heatmap['1_9'] = { probability: 0.9, confidence: 1, startHits: 1, observations: 4 };  // lunes
const saturday2100 = new Date('2026-06-14T01:00:00Z');
const tomorrowProps = buildRiskCurveProps({ id: 'm', heatmap, now: saturday2100, day: 'tomorrow' });
const forecast = engine.getTomorrowForecast([], heatmap, saturday2100);
const outages = [];
for (let week = 0; week < 6; week++) {
  const start = new Date(Date.UTC(2026, 4, 3 + week * 7, 19, 10)); // domingos 15:10 VET
  outages.push({ id: 's' + week, start: start.toISOString(), end: new Date(start.getTime() + 90 * 60000).toISOString(), type: 'corte' });
}
// Paridad de mañana en los 4 fixtures con datos, 7 días seguidos, como corre el Worker (UTC).
const parity = [];
for (const name of ['b-seis-semanas', 'c-cambio-patron', 'd-cruce-medianoche', 'e-fluctuaciones']) {
  const fixture = JSON.parse(fs.readFileSync('${ROOT}/api/__tests__/fixtures/' + name + '.json', 'utf8'));
  for (let k = 0; k < 7; k++) {
    const at = new Date(new Date(fixture.now).getTime() + k * 86400000);
    const hm = engine.buildHeatmap(fixture.outages, at);
    const web = engine.buildForecastForDay(hm, fixture.outages, tomorrowDayOfWeek(at));
    const b = bot.calculateDayRisk(fixture.outages, new Date(at.getTime() - 4 * 3600000 + 86400000), at);
    parity.push({
      name, k,
      web: web.riskyHours.map(p => [p.hour, engine.adjustedProbability(p.probability, p.confidence)]),
      bot: b ? b.risky.map(p => [p.h, p.prob]) : [],
    });
  }
}
process.stdout.write(JSON.stringify({
  parity,
  resolvedTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  browserDay: saturday2100.getDay(),
  tomorrowDay: tomorrowDayOfWeek(saturday2100),
  bands: tomorrowProps.riskBands,
  nowHour: tomorrowProps.nowHour === undefined ? null : tomorrowProps.nowHour,
  forecastPeak: forecast.peakHour,
  preselect: resolveForecastDay({ heatmap, now: saturday2100 }),
  preselectEarly: resolveForecastDay({ heatmap, now: new Date('2026-06-13T23:59:00Z') }),
  botMessage: bot.buildTomorrowRiskMessage(outages, saturday2100),
}));
`;

const result = JSON.parse(execFileSync(process.execPath, ['-e', SCRIPT], {
  env: { ...process.env, TZ: 'UTC' },
  encoding: 'utf8',
}));

test('el proceso hijo corre en UTC (para el navegador ya es domingo)', () => {
  expect(['UTC', 'Etc/UTC']).toContain(result.resolvedTz);
  expect(result.browserDay).toBe(0);
});

test('web: mañana del sábado 21:00 VET es domingo, también en la gráfica y el forecast', () => {
  expect(result.tomorrowDay).toBe(0);
  expect(result.bands).toEqual([[15, 15]]);
  expect(result.forecastPeak).toBe(15);
  expect(result.nowHour).toBeNull();
});

test('preselección usa la hora VET: 21:00 sin riesgo restante → mañana; 19:59 → hoy', () => {
  expect(result.preselect).toBe('tomorrow');
  expect(result.preselectEarly).toBe('today');
});

test('paridad web == bot para mañana en UTC real (fixtures b, c, d, e × 7 días)', () => {
  expect(result.parity).toHaveLength(28);
  expect(result.parity.some(r => r.web.length > 0)).toBe(true);
  result.parity.forEach(r => {
    const label = `${r.name} +${r.k}`;
    expect({ label, hours: r.bot.map(p => p[0]) }).toEqual({ label, hours: r.web.map(p => p[0]) });
    r.web.forEach((p, i) => expect(r.bot[i][1]).toBeCloseTo(p[1], 9));
  });
});

test('bot: /manana del sábado 21:00 VET habla del domingo', () => {
  expect(result.botMessage).toMatch(/mañana \(domingo\)/);
  expect(result.botMessage).toMatch(/15:00/);
});
