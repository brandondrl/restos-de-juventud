process.env.TZ = 'America/Caracas';

require('../../public/timezone.js');
const fs = require('fs');
const path = require('path');

function loadWorkerFunctions() {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'bot', 'worker.js'), 'utf8');
  const cutIndex = source.indexOf('export default {');
  const trimmed = source.slice(0, cutIndex);
  const sandbox = {};
  const wrapped = `${trimmed}\nsandbox.calculateDayRisk = calculateDayRisk;\nsandbox.getConsecutiveOutageStatus = getConsecutiveOutageStatus;`
    + `\nsandbox.buildTomorrowRiskMessage = buildTomorrowRiskMessage;\nsandbox.STRINGS = STRINGS;`;
  new Function('sandbox', wrapped)(sandbox);
  return sandbox;
}

const {
  buildHeatmap, adjustedProbability, RISK_THRESHOLD,
  getConsecutiveOutageStatus: webGetConsecutiveOutageStatus,
} = require('../../public/prediction.js');
const {
  calculateDayRisk, getConsecutiveOutageStatus: botGetConsecutiveOutageStatus,
  buildTomorrowRiskMessage, STRINGS,
} = loadWorkerFunctions();
const { buildForecastForDay } = require('../../public/prediction.js');

function webRiskyHours(outages, day) {
  const heatmap = buildHeatmap(outages);
  if (!heatmap) return [];
  const risky = [];
  for (let h = 0; h < 24; h++) {
    const slot = heatmap[`${day}_${h}`];
    const adjusted = adjustedProbability(slot.probability, slot.confidence);
    if (adjusted >= RISK_THRESHOLD) risky.push({ h, prob: adjusted });
  }
  return risky;
}

function outage(id, start, end) {
  return { id, start, end, type: 'corte' };
}

function buildFixedDataset() {
  const outages = [];
  for (let week = 0; week < 6; week++) {
    const monday = new Date(Date.UTC(2026, 0, 5 + week * 7, 18, 10, 0));
    outages.push(outage(`m${week}`, monday.toISOString(), new Date(monday.getTime() + 90 * 60000).toISOString()));
    const thursday = new Date(Date.UTC(2026, 0, 8 + week * 7, 14, 40, 0));
    outages.push(outage(`t${week}`, thursday.toISOString(), new Date(thursday.getTime() + 200 * 60000).toISOString()));
  }
  return outages;
}

describe('web vs bot risk engine parity', () => {
  const outages = buildFixedDataset();
  const targetDate = new Date('2026-06-15T12:00:00.000Z');
  const localNow = new Date(targetDate.getTime() + (-4) * 3600000);
  const day = targetDate.getDay();

  it('flags the exact same risky hours with the exact same probabilities', () => {
    const web = webRiskyHours(outages, day);
    const botResult = calculateDayRisk(outages, localNow);
    const bot = botResult ? botResult.risky : [];

    const webMap = new Map(web.map(p => [p.h, p.prob]));
    const botMap = new Map(bot.map(p => [p.h, p.prob]));

    expect(botMap.size).toBe(webMap.size);
    webMap.forEach((prob, hour) => {
      expect(botMap.get(hour)).toBeCloseTo(prob, 9);
    });
  });
});

describe('web vs bot consecutive-outage parity', () => {
  const outages = buildFixedDataset();

  it('returns the same status for the same reference time', () => {
    const lastEnd = new Date(outages[outages.length - 1].end);
    const web = webGetConsecutiveOutageStatus(outages, lastEnd);
    const bot = botGetConsecutiveOutageStatus(outages, lastEnd);

    if (web === null || bot === null) {
      expect(web).toBe(bot);
      return;
    }
    expect(bot.percent).toBe(web.percent);
    expect(bot.level).toBe(web.level);
    expect(bot.sampleSize).toBe(web.sampleSize);
  });
});

// Fase 2.2: /manana del bot reutiliza calculateDayRisk para el día siguiente.
const { caracasGetDay } = require('../../public/timezone.js');
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const loadFixture = name => JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, `${name}.json`), 'utf8'));
const TZ_OFFSET_MS = -4 * 3600000;
const pad = h => String(h).padStart(2, '0');
const formatBotRanges = ranges => ranges.map(([a, b]) => (a === b ? `${pad(a)}:00` : `${pad(a)}:00–${pad(b + 1)}:00`)).join(', ');

function webTomorrow(outages, now) {
  const heatmap = buildHeatmap(outages, now);
  const tomorrowDay = caracasGetDay(new Date(now.getTime() + 86400000));
  return buildForecastForDay(heatmap, outages, tomorrowDay);
}

function botTomorrow(outages, now) {
  return calculateDayRisk(outages, new Date(now.getTime() + TZ_OFFSET_MS + 86400000), now);
}

describe.each(['b-seis-semanas', 'c-cambio-patron'])('paridad web == bot para mañana — %s', (name) => {
  const fixture = loadFixture(name);
  // El `now` del fixture y los 6 días siguientes: cada día de la semana es "mañana" una vez.
  const nows = Array.from({ length: 7 }, (_, k) => new Date(new Date(fixture.now).getTime() + k * 86400000));

  it.each(nows.map(now => [now.toISOString(), now]))('mismas horas, probabilidades, pico y margen (%s)', (_, now) => {
    const web = webTomorrow(fixture.outages, now);
    const bot = botTomorrow(fixture.outages, now);
    const webHours = web.riskyHours.map(p => p.hour);
    const botHours = bot ? bot.risky.map(p => p.h) : [];
    expect(botHours).toEqual(webHours);
    if (!bot) return;
    web.riskyHours.forEach((p, i) => {
      expect(bot.risky[i].prob).toBeCloseTo(adjustedProbability(p.probability, p.confidence), 9);
    });
    expect(bot.peak.h).toBe(web.peakHour);
    expect(Math.round(bot.peak.prob * 100)).toBe(web.peakPercent);
    expect(bot.marginOfError).toBe(web.marginOfError);
    expect(bot.rangeText).toBe(formatBotRanges(web.ranges));
  });

  it('la semana incluye al menos un "mañana" con riesgo (la paridad no es vacía)', () => {
    expect(nows.some(now => webTomorrow(fixture.outages, now).riskyHours.length > 0)).toBe(true);
  });
});

describe('/manana del bot', () => {
  const fixture = loadFixture('c-cambio-patron');
  const now = new Date(fixture.now); // viernes 06:00 VET → mañana sábado

  it('usa el formato de /probabilidad para el día siguiente', () => {
    const message = buildTomorrowRiskMessage(fixture.outages, now);
    expect(message).toBe(
      '🔮 *Predicción para mañana (sábado)*\n\n⏰ Riesgo: *07:00–10:00, 14:00–19:00*\n📈 Pico: *16:00* (65% ±24%)\n\n_Basado en tu historial personal._'
    );
  });

  it('coincide con el pronóstico de mañana de la web', () => {
    const message = buildTomorrowRiskMessage(fixture.outages, now);
    const web = webTomorrow(fixture.outages, now);
    expect(message).toContain(formatBotRanges(web.ranges));
    expect(message).toContain(`*${pad(web.peakHour)}:00* (${web.peakPercent}% ±${web.marginOfError}%)`);
  });

  it('sin riesgo mañana → mensaje de "sin riesgo" con el día', () => {
    const fixtureB = loadFixture('b-seis-semanas'); // lunes → mañana martes, sin riesgo
    expect(buildTomorrowRiskMessage(fixtureB.outages, new Date(fixtureB.now)))
      .toBe('✅ Sin riesgo significativo mañana (martes) según tu historial.');
  });

  it('sábado 21:00 VET (domingo 01:00 UTC) → habla del domingo', () => {
    const saturday2100 = new Date('2026-06-14T01:00:00Z');
    expect(buildTomorrowRiskMessage([], saturday2100)).toMatch(/mañana \(domingo\)/);
  });

  it('sin `now` usa el reloj real', () => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    try {
      expect(buildTomorrowRiskMessage(fixture.outages)).toBe(buildTomorrowRiskMessage(fixture.outages, now));
    } finally {
      jest.useRealTimers();
    }
  });

  it('/ayuda lista /manana', () => {
    expect(STRINGS.help).toMatch(/\/manana — Riesgo de corte mañana/);
  });

  it('calculateDayRisk sin `now` da lo mismo que con el reloj real (firma retrocompatible)', () => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    try {
      const localTomorrow = new Date(now.getTime() + TZ_OFFSET_MS + 86400000);
      expect(calculateDayRisk(fixture.outages, localTomorrow)).toEqual(calculateDayRisk(fixture.outages, localTomorrow, now));
    } finally {
      jest.useRealTimers();
    }
  });
});
