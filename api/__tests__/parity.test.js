process.env.TZ = 'America/Caracas';

const { caracasGetDay } = require('../../public/timezone.js');
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
  buildHeatmap, adjustedProbability, isRiskyHour,
  getConsecutiveOutageStatus: webGetConsecutiveOutageStatus,
} = require('../../public/prediction.js');
const {
  calculateDayRisk, getConsecutiveOutageStatus: botGetConsecutiveOutageStatus,
  buildTomorrowRiskMessage, STRINGS,
} = loadWorkerFunctions();
const { buildForecastForDay } = require('../../public/prediction.js');

// Horas de riesgo de la web con la misma regla que el forecast (umbral + filtro de madrugada).
function webRiskyHours(outages, day, now) {
  const heatmap = buildHeatmap(outages, now);
  if (!heatmap) return [];
  const risky = [];
  for (let h = 0; h < 24; h++) {
    const slot = heatmap[`${day}_${h}`];
    if (isRiskyHour({ hour: h, ...slot })) risky.push({ h, prob: adjustedProbability(slot.probability, slot.confidence) });
  }
  return risky;
}

function expectSameRisk(web, botResult) {
  const bot = botResult ? botResult.risky : [];
  expect(bot.map(p => p.h)).toEqual(web.map(p => p.h));
  web.forEach((p, i) => expect(bot[i].prob).toBeCloseTo(p.prob, 9));
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
  // `now` fijo justo después de los datos (antes usaba el reloj real y la ventana de 84 días
  // dejaba los datos fuera: ambos motores daban "sin riesgo" y el test pasaba sin comparar nada).
  // Lunes 2026-02-16 12:00 VET y los 6 días siguientes: cada día de la semana es "hoy" una vez.
  const nows = Array.from({ length: 7 }, (_, k) => new Date(Date.UTC(2026, 1, 16 + k, 16, 0, 0)));

  it.each(nows.map(now => [now.toISOString(), now]))('flags the exact same risky hours with the exact same probabilities (%s)', (_, now) => {
    const localNow = new Date(now.getTime() + (-4) * 3600000);
    expectSameRisk(webRiskyHours(outages, caracasGetDay(now), now), calculateDayRisk(outages, localNow, now));
  });

  it('the comparison is not empty (Monday and Thursday have risk)', () => {
    const monday = nows[0];
    const thursday = nows[3];
    expect(webRiskyHours(outages, caracasGetDay(monday), monday).length).toBeGreaterThan(0);
    expect(webRiskyHours(outages, caracasGetDay(thursday), thursday).length).toBeGreaterThan(0);
  });
});

describe('web vs bot: filtro de madrugada', () => {
  // Cortes que empiezan a las 22:30 VET y siguen hasta las 02:00 (arrastre nocturno) y otros
  // que empiezan a las 03:00 VET. De 00 a 04 solo cuenta la hora en la que un corte empezó.
  const outages = [];
  for (let week = 0; week < 6; week++) {
    const late = new Date(Date.UTC(2026, 0, 6 + week * 7, 2, 30, 0)); // lunes 22:30 VET → martes
    outages.push(outage(`n${week}`, late.toISOString(), new Date(late.getTime() + 210 * 60000).toISOString()));
    const early = new Date(Date.UTC(2026, 0, 9 + week * 7, 7, 0, 0)); // viernes 03:00 VET
    outages.push(outage(`e${week}`, early.toISOString(), new Date(early.getTime() + 180 * 60000).toISOString()));
  }
  const now = new Date(Date.UTC(2026, 1, 16, 16, 0, 0));

  it.each([[2, 'martes (arrastre 00–02)'], [5, 'viernes (inicio a las 03)']])('día %s: %s', (day) => {
    const localDay = new Date(Date.UTC(2026, 1, 15 + day, 12, 0, 0)); // domingo 15 + day
    const web = webRiskyHours(outages, day, now);
    expectSameRisk(web, calculateDayRisk(outages, localDay, now));
  });

  it('el bot ya no marca la madrugada por arrastre de un corte de la noche anterior', () => {
    const tuesday = calculateDayRisk(outages, new Date(Date.UTC(2026, 1, 17, 12, 0, 0)), now);
    const early = tuesday ? tuesday.risky.filter(p => p.h <= 4) : [];
    expect(early).toEqual([]);
  });

  it('el bot sí marca la hora de madrugada en la que empiezan cortes', () => {
    const friday = calculateDayRisk(outages, new Date(Date.UTC(2026, 1, 20, 12, 0, 0)), now);
    expect(friday.risky.map(p => p.h)).toContain(3);
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

describe.each(['b-seis-semanas', 'c-cambio-patron', 'd-cruce-medianoche', 'e-fluctuaciones'])('paridad web == bot para mañana — %s', (name) => {
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
