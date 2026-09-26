// Los cálculos de riesgo se hacen en hora de Caracas y deben dar lo mismo en la web y en el bot,
// sin importar la zona horaria de la máquina (navegador del usuario, Worker en UTC, CI, este PC).
// Cada zona corre en un proceso hijo porque jest no cambia la zona con process.env.TZ.
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..').replace(/\\/g, '/');
const ZONES = ['America/Caracas', 'UTC', 'Asia/Kolkata', 'America/St_Johns', 'Pacific/Kiritimati'];

const SCRIPT = `
const { caracasGetDay, caracasGetHours } = require('${ROOT}/public/timezone.js');
const engine = require('${ROOT}/public/prediction.js');
const fs = require('fs');
let source = fs.readFileSync('${ROOT}/bot/worker.js', 'utf8');
source = source.slice(0, source.indexOf('export default {'));
const bot = {};
new Function('sandbox', source + '\\nsandbox.calculateDayRisk = calculateDayRisk;'
  + '\\nsandbox.getConsecutiveOutageStatus = getConsecutiveOutageStatus;')(bot);

const H = 3600000;
const vet = (y, m, d, h, min = 0) => new Date(Date.UTC(y, m - 1, d, h + 4, min)); // hora de Caracas → instante
const corte = (id, start, minutes) => ({ id, start: start.toISOString(), end: new Date(start.getTime() + minutes * 60000).toISOString(), type: 'corte', duration_minutes: minutes });

// Cortes que empiezan a cada una de las 24 horas y muchos cruzan la medianoche; 6 semanas.
const cruces = [];
for (let week = 0; week < 6; week++) {
  for (let hour = 0; hour < 24; hour++) {
    const day = 1 + week * 7 + (hour % 7);
    cruces.push(corte('c' + week + '_' + hour, vet(2026, 3, day, hour, 37), 45 + ((hour * 53) % 300)));
  }
  cruces.push(corte('sab' + week, vet(2026, 3, 7 + week * 7, 22, 30), 165));          // sábado 22:30 → domingo 01:15
  cruces.push(corte('largo' + week, vet(2026, 3, 3 + week * 7, 20, 0), 27 * 60));   // 27 h: cruza dos medianoches
}
cruces.push(corte('anio', vet(2025, 12, 31, 23, 10), 130));                          // 31/12 23:10 → 01/01 01:20
cruces.push({ id: 'fluc', start: vet(2026, 3, 10, 3).toISOString(), end: vet(2026, 3, 10, 3).toISOString(), type: 'fluctuacion' });

const datasets = {};
for (const name of ['a-usuario-nuevo', 'b-seis-semanas', 'c-cambio-patron', 'd-cruce-medianoche', 'e-fluctuaciones']) {
  const fixture = JSON.parse(fs.readFileSync('${ROOT}/api/__tests__/fixtures/' + name + '.json', 'utf8'));
  datasets[name] = { outages: fixture.outages, now: new Date(fixture.now) };
}
datasets.cruces = { outages: cruces, now: vet(2026, 4, 13, 9) };

const out = { tz: Intl.DateTimeFormat().resolvedOptions().timeZone, datasets: {} };
for (const [name, { outages, now }] of Object.entries(datasets)) {
  const heatmap = engine.buildHeatmap(outages, now);
  const days = [];
  for (let day = 0; day < 7; day++) {
    // Un instante de ese día de la semana en Caracas (para el bot: fecha "local" = UTC−4).
    const offset = (day - caracasGetDay(now) + 7) % 7;
    const localDay = new Date(now.getTime() - 4 * H + offset * 24 * H);
    const web = engine.buildForecastForDay(heatmap, outages, day);
    const b = bot.calculateDayRisk(outages, localDay, now);
    days.push({
      day,
      web: web.riskyHours.map(p => [p.hour, engine.adjustedProbability(p.probability, p.confidence)]),
      webPeak: web.peakHour === undefined ? null : [web.peakHour, web.peakPercent, web.marginOfError],
      bot: b ? b.risky.map(p => [p.h, p.prob]) : [],
      botPeak: b ? [b.peak.h, Math.round(b.peak.prob * 100), b.marginOfError] : null,
    });
  }
  const completedEnds = outages.filter(o => o.end && (o.type || 'corte') === 'corte').map(o => new Date(o.end).getTime());
  const lastEnd = completedEnds.length ? Math.max(...completedEnds) : now.getTime();
  const consecutive = [0, 1, 6, 20, 30].map(h => {
    const at = new Date(lastEnd + h * H);
    const w = engine.getConsecutiveOutageStatus(outages, at);
    const b = bot.getConsecutiveOutageStatus(outages, at);
    return { h, web: w && [w.percent, w.level, w.sampleSize], bot: b && [b.percent, b.level, b.sampleSize] };
  });
  out.datasets[name] = {
    heatmap,
    today: engine.getDayForecast(
      heatmap ? Array.from({ length: 24 }, (_, hour) => ({ hour, ...heatmap[caracasGetDay(now) + '_' + hour] })) : [],
      outages, { now, activeOutage: null }),
    tomorrow: engine.getTomorrowForecast(outages, heatmap, now),
    days,
    consecutive,
  };
}
// Slots de un corte que cruza la medianoche: sábado 22:30 → domingo 01:15 (hora de Caracas).
out.slots = engine.getHourlySlots(corte('x', vet(2026, 3, 7, 22, 30), 165)).map(s => s.dayOfWeek + '_' + s.hour);
out.slotsExact = engine.getHourlySlots(corte('y', vet(2026, 3, 8, 0, 0), 60)).map(s => s.dayOfWeek + '_' + s.hour);
out.slotsEdge = engine.getHourlySlots(corte('z', vet(2026, 3, 7, 23, 59), 2)).map(s => s.dayOfWeek + '_' + s.hour);
out.onset = engine.getOnsetHint(cruces, 6, 22);
process.stdout.write(JSON.stringify(out));
`;

const results = Object.fromEntries(ZONES.map(zone => [zone, JSON.parse(execFileSync(process.execPath, ['-e', SCRIPT], {
  env: { ...process.env, TZ: zone },
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
}))]));
const reference = results['America/Caracas'];

test.each(ZONES)('el proceso corre de verdad en %s', (zone) => {
  const expected = { UTC: ['UTC', 'Etc/UTC'], 'Asia/Kolkata': ['Asia/Kolkata', 'Asia/Calcutta'] }[zone] || [zone];
  expect(expected).toContain(results[zone].tz);
});

test.each(ZONES.filter(z => z !== 'America/Caracas'))('en %s la web y el bot dan exactamente lo mismo que en Caracas', (zone) => {
  expect(results[zone].datasets).toEqual(reference.datasets);
  expect(results[zone].slots).toEqual(reference.slots);
  expect(results[zone].onset).toEqual(reference.onset);
});

test.each(Object.keys(reference.datasets))('web == bot en los 7 días de la semana — %s', (name) => {
  reference.datasets[name].days.forEach(({ day, web, bot, webPeak, botPeak }) => {
    expect({ day, hours: bot.map(p => p[0]) }).toEqual({ day, hours: web.map(p => p[0]) });
    web.forEach((p, i) => expect(bot[i][1]).toBeCloseTo(p[1], 9));
    expect({ day, peak: botPeak }).toEqual({ day, peak: webPeak });
  });
});

test.each(Object.keys(reference.datasets))('web == bot en "otro corte en 12 h" (0, 1, 6, 20 y 30 h después) — %s', (name) => {
  reference.datasets[name].consecutive.forEach(({ h, web, bot }) => {
    expect({ h, bot }).toEqual({ h, bot: web });
  });
});

test('los datos con cruces de medianoche producen riesgo real (la comparación no es vacía)', () => {
  const risky = reference.datasets.cruces.days.filter(d => d.web.length > 0);
  expect(risky.length).toBeGreaterThan(0);
});

test('un corte de sábado 22:30 a domingo 01:15 ocupa sáb 22, sáb 23, dom 00 y dom 01', () => {
  expect(reference.slots).toEqual(['6_22', '6_23', '0_0', '0_1']);
});

test('un corte de 00:00 a 01:00 ocupa solo la hora 00; uno de 23:59 a 00:01 ocupa 23 y 00 del día siguiente', () => {
  expect(reference.slotsExact).toEqual(['0_0']);
  expect(reference.slotsEdge).toEqual(['6_23', '0_0']);
});
