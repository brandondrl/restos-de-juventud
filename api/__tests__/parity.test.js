process.env.TZ = 'America/Caracas';

require('../../public/timezone.js');
const fs = require('fs');
const path = require('path');

function loadWorkerFunctions() {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'bot', 'worker.js'), 'utf8');
  const cutIndex = source.indexOf('export default {');
  const trimmed = source.slice(0, cutIndex);
  const sandbox = {};
  const wrapped = `${trimmed}\nsandbox.calculateDayRisk = calculateDayRisk;\nsandbox.getConsecutiveOutageStatus = getConsecutiveOutageStatus;`;
  new Function('sandbox', wrapped)(sandbox);
  return sandbox;
}

const {
  buildHeatmap, adjustedProbability, RISK_THRESHOLD,
  getConsecutiveOutageStatus: webGetConsecutiveOutageStatus,
} = require('../../public/prediction.js');
const { calculateDayRisk, getConsecutiveOutageStatus: botGetConsecutiveOutageStatus } = loadWorkerFunctions();

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