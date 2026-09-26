// Núcleo de backtesting del motor de predicción (puro: sin DOM, fetch ni localStorage).
// Lo usan scripts/backtest.js (fase 2.0) y el marcador de aciertos (fase 2.10).
//
// Veredicto por día (definición de ROADMAP 2.10):
//   hit          hubo ventanas de riesgo y algún corte empezó dentro de una (±30 min)
//   false_alarm  hubo ventanas y ningún corte empezó dentro de ellas
//   missed       no hubo ventanas y hubo corte
//   quiet        no hubo ventanas ni corte
//   no_data      ninguna hora alcanza la confianza mínima (no cuenta en los porcentajes)

if (typeof module !== 'undefined' && typeof require === 'function' && typeof caracasGetDay === 'undefined') {
    require('./timezone.js');
}

const BACKTEST_HOUR_MS = 3600000;
const BACKTEST_DAY_MS = 86400000;
const BACKTEST_MARGIN_MINUTES = 30;
const BACKTEST_MIN_CONFIDENCE = 0.15;

function resolveBacktestEngine(options) {
    if (options && options.engine) return options.engine;
    if (typeof buildHeatmap === 'function' && typeof isRiskyHour === 'function') {
        return { buildHeatmap, adjustedProbability, isRiskyHour, RISK_THRESHOLD };
    }
    return require('./prediction.js');
}

function isBacktestCorte(outage) {
    return !!outage.start && (outage.type || 'corte') === 'corte';
}

// 00:00 VET del día indicado ('YYYY-MM-DD' o cualquier Date dentro de ese día en VET).
function vetDayStart(dayDate) {
    const reference = typeof dayDate === 'string'
        ? new Date(`${dayDate}T12:00:00Z`)
        : new Date(dayDate);
    return getStartOfDayUTC(reference);
}

function groupHourRanges(hours) {
    const ranges = [];
    hours.forEach(hour => {
        const last = ranges[ranges.length - 1];
        if (last && hour === last[1] + 1) last[1] = hour;
        else ranges.push([hour, hour]);
    });
    return ranges;
}

function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// Minutos desde `time` hasta la ventana [start, end] más cercana (0 si cae dentro).
function minutesToNearestWindow(time, windows) {
    const distances = windows.map(([start, end]) => {
        if (time < start) return (start - time) / 60000;
        if (time > end) return (time - end) / 60000;
        return 0;
    });
    return Math.min(...distances);
}

function evaluateDay(outagesBefore, outagesOfDay, dayDate, options = {}) {
    const engine = resolveBacktestEngine(options);
    const threshold = options.threshold !== undefined ? options.threshold : engine.RISK_THRESHOLD;
    const marginMs = (options.marginMinutes !== undefined ? options.marginMinutes : BACKTEST_MARGIN_MINUTES) * 60000;

    const dayStart = vetDayStart(dayDate);
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayStartMs + BACKTEST_DAY_MS;
    const dayOfWeek = caracasGetDay(new Date(dayStartMs + 12 * BACKTEST_HOUR_MS));

    const heatmap = options.heatmap !== undefined
        ? options.heatmap
        : engine.buildHeatmap(outagesBefore, dayStart, options.windowDays ? { windowDays: options.windowDays } : {});

    const predictions = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        ...((heatmap && heatmap[`${dayOfWeek}_${hour}`]) || { probability: 0, confidence: 0, startHits: 0 }),
    }));
    const hasData = predictions.some(p => p.confidence >= BACKTEST_MIN_CONFIDENCE);
    const riskyHours = hasData
        ? predictions.filter(p => engine.isRiskyHour(p, threshold)).map(p => p.hour)
        : [];
    const riskyRanges = groupHourRanges(riskyHours);

    const cortes = outagesOfDay.filter(isBacktestCorte).map(o => ({
        start: new Date(o.start).getTime(),
        end: o.end ? new Date(o.end).getTime() : dayEndMs,
    }));
    const starts = cortes
        .map(c => c.start)
        .filter(start => start >= dayStartMs && start < dayEndMs)
        .sort((a, b) => a - b);

    const hourly = predictions.map(p => {
        const hourStart = dayStartMs + p.hour * BACKTEST_HOUR_MS;
        const hourEnd = hourStart + BACKTEST_HOUR_MS;
        return {
            hour: p.hour,
            adjusted: engine.adjustedProbability(p.probability, p.confidence),
            happened: cortes.some(c => c.start < hourEnd && c.end > hourStart),
            risky: riskyHours.includes(p.hour),
        };
    });

    const strictWindows = riskyRanges.map(([first, last]) => [
        dayStartMs + first * BACKTEST_HOUR_MS,
        dayStartMs + (last + 1) * BACKTEST_HOUR_MS,
    ]);
    const insideMargin = start => strictWindows.some(([ws, we]) => start >= ws - marginMs && start <= we + marginMs);
    const startsInside = starts.filter(insideMargin).length;

    let verdict;
    if (!hasData) verdict = 'no_data';
    else if (riskyRanges.length) verdict = startsInside > 0 ? 'hit' : 'false_alarm';
    else verdict = starts.length ? 'missed' : 'quiet';

    return {
        date: caracasDateStr(new Date(dayStartMs + 12 * BACKTEST_HOUR_MS)),
        verdict,
        riskyRanges,
        outageStarts: starts.map(start => new Date(start).toISOString()),
        hourly,
        timingMinutes: strictWindows.length ? starts.map(start => minutesToNearestWindow(start, strictWindows)) : [],
        extraOutages: verdict === 'hit' ? starts.length - startsInside : 0,
    };
}

function summarizeEvaluations(evaluations) {
    const evaluated = evaluations.filter(e => e.verdict !== 'no_data');
    const verdicts = { hit: 0, false_alarm: 0, missed: 0, quiet: 0 };
    evaluated.forEach(e => { verdicts[e.verdict]++; });

    const hours = evaluated.flatMap(e => e.hourly);
    const marked = hours.filter(h => h.risky);
    const outcomes = verdicts.hit + verdicts.missed;

    return {
        evaluatedDays: evaluated.length,
        noDataDays: evaluations.length - evaluated.length,
        verdicts,
        hitRate: outcomes ? verdicts.hit / outcomes : null,
        falseAlarmRate: marked.length ? marked.filter(h => !h.happened).length / marked.length : null,
        brier: hours.length
            ? hours.reduce((sum, h) => sum + (h.adjusted - (h.happened ? 1 : 0)) ** 2, 0) / hours.length
            : null,
        timingMarginMin: median(evaluated.flatMap(e => e.timingMinutes)),
        accuracy: evaluated.length ? (verdicts.hit + verdicts.quiet) / evaluated.length : null,
    };
}

// Walk-forward: cada día D se predice solo con cortes que ya habían terminado a las 00:00 VET de D.
// options: { from, to ('YYYY-MM-DD'), now, threshold, windowDays, marginMinutes, engine }
function walkForward(outages, options = {}) {
    const cortes = outages.filter(isBacktestCorte);
    if (!cortes.length) {
        return { from: null, to: null, evaluations: [], summary: summarizeEvaluations([]) };
    }

    const earliest = Math.min(...cortes.map(o => new Date(o.start).getTime()));
    const latestEvent = options.now
        ? new Date(options.now).getTime()
        : Math.max(...outages.filter(o => o.start).map(o => new Date(o.end || o.start).getTime()));

    const firstDay = options.from
        ? vetDayStart(options.from).getTime()
        : vetDayStart(new Date(earliest)).getTime() + BACKTEST_DAY_MS;
    const lastDay = options.to
        ? vetDayStart(options.to).getTime()
        : vetDayStart(new Date(latestEvent)).getTime() - BACKTEST_DAY_MS;

    const evaluations = [];
    for (let dayStartMs = firstDay; dayStartMs <= lastDay; dayStartMs += BACKTEST_DAY_MS) {
        const dayEndMs = dayStartMs + BACKTEST_DAY_MS;
        const before = cortes.filter(o => o.end && new Date(o.end).getTime() <= dayStartMs);
        const ofDay = cortes.filter(o => {
            const start = new Date(o.start).getTime();
            const end = o.end ? new Date(o.end).getTime() : Infinity;
            return start < dayEndMs && end > dayStartMs;
        });
        evaluations.push(evaluateDay(before, ofDay, new Date(dayStartMs), options));
    }

    const dayLabel = ms => caracasDateStr(new Date(ms + 12 * BACKTEST_HOUR_MS));
    return {
        from: dayLabel(firstDay),
        to: dayLabel(lastDay),
        evaluations,
        summary: summarizeEvaluations(evaluations),
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        evaluateDay, summarizeEvaluations, walkForward,
        vetDayStart, groupHourRanges, median, minutesToNearestWindow,
        BACKTEST_MARGIN_MINUTES, BACKTEST_MIN_CONFIDENCE,
    };
}
