require('../../public/timezone.js');
const {
  buildHeatmap, adjustedProbability, getConsecutiveOutageStatus,
  computeRecoveryGaps, getOnsetHint, computeMarginOfError, RISK_THRESHOLD,
} = require('../../public/prediction.js');

function outage(start, end) {
  return { start, end, type: 'corte' };
}

describe('buildHeatmap', () => {
  it('returns null with no completed outages', () => {
    expect(buildHeatmap([])).toBeNull();
  });

  it('produces a positive probability for an hour with a recorded outage', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-10T00:00:00.000Z'));
    try {
      const outages = [outage('2026-01-05T18:00:00.000Z', '2026-01-05T19:00:00.000Z')];
      const heatmap = buildHeatmap(outages);
      const hasProbability = Object.values(heatmap).some(v => v.probability > 0);
      expect(hasProbability).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps raw startHits unsmoothed for the early-hour guard', () => {
    const outageStart = new Date('2026-01-05T02:00:00.000Z');
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-10T00:00:00.000Z'));
    try {
      const outages = [{ start: outageStart.toISOString(), end: new Date(outageStart.getTime() + 3600000).toISOString(), type: 'corte' }];
      const heatmap = buildHeatmap(outages);
      const hitEntry = Object.values(heatmap).find(v => v.startHits === 1);
      expect(hitEntry).toBeDefined();
      expect(hitEntry.startHits).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('adjustedProbability', () => {
  it('zeroes out below the confidence floor', () => {
    expect(adjustedProbability(0.9, 0.1)).toBe(0);
  });

  it('multiplies probability by confidence above the floor', () => {
    expect(adjustedProbability(0.5, 0.5)).toBe(0.25);
  });
});

describe('computeRecoveryGaps', () => {
  it('computes the gap between consecutive completed outages', () => {
    const outages = [
      outage('2026-01-01T10:00:00.000Z', '2026-01-01T12:00:00.000Z'),
      outage('2026-01-01T18:00:00.000Z', '2026-01-01T20:00:00.000Z'),
    ];
    expect(computeRecoveryGaps(outages).gaps).toEqual([6]);
  });

  it('ignores fluctuations', () => {
    const outages = [
      { start: '2026-01-01T10:00:00.000Z', end: '2026-01-01T10:00:00.000Z', type: 'fluctuacion' },
      outage('2026-01-01T18:00:00.000Z', '2026-01-01T20:00:00.000Z'),
    ];
    expect(computeRecoveryGaps(outages).gaps).toEqual([]);
  });
});

describe('getConsecutiveOutageStatus', () => {
  function buildSeries(gapsHours) {
    const outages = [];
    let cursor = new Date('2026-01-01T00:00:00.000Z');
    gapsHours.forEach(gap => {
      const start = new Date(cursor.getTime());
      const end = new Date(start.getTime() + 2 * 3600000);
      outages.push(outage(start.toISOString(), end.toISOString()));
      cursor = new Date(end.getTime() + gap * 3600000);
    });
    outages.push(outage(cursor.toISOString(), new Date(cursor.getTime() + 2 * 3600000).toISOString()));
    return outages;
  }

  it('returns null with fewer than the minimum sample size', () => {
    expect(getConsecutiveOutageStatus(buildSeries([5, 6]), new Date())).toBeNull();
  });

  it('returns a status once enough gaps are recorded', () => {
    const outages = buildSeries([5, 6, 8, 7, 9]);
    const lastEnd = new Date(outages[outages.length - 1].end);
    const status = getConsecutiveOutageStatus(outages, lastEnd);
    expect(status).not.toBeNull();
    expect(status.sampleSize).toBeGreaterThanOrEqual(4);
    expect(status.percent).toBeGreaterThanOrEqual(0);
    expect(status.percent).toBeLessThanOrEqual(100);
  });

  it('returns null once too much time has passed since the last outage', () => {
    const outages = buildSeries([5, 6, 8, 7, 9]);
    const lastEnd = new Date(outages[outages.length - 1].end);
    const farFuture = new Date(lastEnd.getTime() + 40 * 3600000);
    expect(getConsecutiveOutageStatus(outages, farFuture)).toBeNull();
  });
});

describe('getOnsetHint', () => {
  it('returns null without enough repeated onsets', () => {
    const outages = [outage('2026-01-05T14:05:00.000Z', '2026-01-05T15:00:00.000Z')];
    expect(getOnsetHint(outages, 0, 0)).toBeNull();
  });

  it('returns a quarter hint once enough onsets repeat in the same hour', () => {
    const outages = [
      outage('2026-01-05T14:05:00.000Z', '2026-01-05T15:00:00.000Z'),
      outage('2026-01-12T14:08:00.000Z', '2026-01-12T15:00:00.000Z'),
      outage('2026-01-19T14:03:00.000Z', '2026-01-19T15:00:00.000Z'),
    ];
    let hint = null;
    for (let d = 0; d < 7 && !hint; d++)
      for (let h = 0; h < 24 && !hint; h++)
        hint = getOnsetHint(outages, d, h);
    expect(hint).toBe('primeros 15 min');
  });
});

describe('computeMarginOfError', () => {
  it('returns null with zero observations', () => {
    expect(computeMarginOfError(0, 0)).toBeNull();
  });

  it('returns higher margin with fewer observations for the same proportion', () => {
    expect(computeMarginOfError(2, 4)).toBeGreaterThan(computeMarginOfError(20, 40));
  });
});

describe('RISK_THRESHOLD', () => {
  it('is 0.13 as calibrated against real data', () => {
    expect(RISK_THRESHOLD).toBe(0.13);
  });
});