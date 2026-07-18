const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAYS_FULL  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WEEKS_FOR_FULL_CONFIDENCE = 4;
const HEATMAP_WINDOW_DAYS = 84;
const RISK_THRESHOLD = 0.13;
const WILSON_Z = 1.96;
const ONSET_HINT_MIN_SAMPLES = 3;
const CONSECUTIVE_OUTAGE_MIN_SAMPLE = 4;
const CONSECUTIVE_OUTAGE_WINDOW_HOURS = 12;
const CONSECUTIVE_OUTAGE_MAX_ELAPSED_HOURS = 36;

function padZero(number) {
    return String(number).padStart(2, '0');
}

function getHourlySlots(outage) {
    const slots = [];
    const cursor = new Date(outage.start);
    cursor.setMinutes(0, 0, 0);
    const endTime = new Date(outage.end);
    while (cursor < endTime) {
        slots.push({ dayOfWeek: caracasGetDay(cursor), hour: caracasGetHours(cursor) });
        cursor.setTime(cursor.getTime() + 3600000);
    }
    return slots;
}

function buildHeatmap(outages) {
    const completed = outages.filter(
        o => o.start && o.end && (o.type || 'corte') === 'corte'
    );
    if (completed.length === 0) return null;

    const allDates = completed.flatMap(o => [new Date(o.start), new Date(o.end)]);
    const earliestDate = new Date(Math.min(...allDates.map(d => d.getTime())));

    const windowStart = new Date();
    windowStart.setUTCDate(windowStart.getUTCDate() - HEATMAP_WINDOW_DAYS);
    windowStart.setUTCHours(0, 0, 0, 0);

    const effectiveStart = new Date(Math.max(earliestDate.getTime(), windowStart.getTime()));

    const observationCount = {};
    const hitCount = {};

    const cursor = new Date(effectiveStart);
    cursor.setUTCHours(0, 0, 0, 0);
    while (cursor <= new Date()) {
        for (let hour = 0; hour < 24; hour++) {
            const slotDate = new Date(cursor.getTime() + hour * 3600000);
            const key = `${caracasGetDay(slotDate)}_${caracasGetHours(slotDate)}`;
            observationCount[key] = (observationCount[key] || 0) + 1;
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const windowedCompleted = completed.filter(o => new Date(o.start) >= effectiveStart);
    const startHitCount = {};

    windowedCompleted.forEach(outage => {
        getHourlySlots(outage).forEach(({ dayOfWeek, hour }) => {
            const key = `${dayOfWeek}_${hour}`;
            hitCount[key] = (hitCount[key] || 0) + 1;
        });
        const startDay  = caracasGetDay(new Date(outage.start));
        const startHour = caracasGetHours(new Date(outage.start));
        const startKey  = `${startDay}_${startHour}`;
        startHitCount[startKey] = (startHitCount[startKey] || 0) + 1;
    });

    const raw = {};
    for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
            const key = `${day}_${hour}`;
            const observations = observationCount[key] || 0;
            const hits = hitCount[key] || 0;
            raw[key] = {
                probability: observations > 0 ? (hits + 0.5) / (observations + 1) : 0,
                confidence:  Math.min(observations / WEEKS_FOR_FULL_CONFIDENCE, 1),
                hits,
                startHits: startHitCount[key] || 0,
                observations,
            };
        }
    }

    const heatmap = {};
    for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
            const key = `${day}_${hour}`;
            const prevKey = `${day}_${(hour + 23) % 24}`;
            const nextKey = `${day}_${(hour + 1) % 24}`;
            const center = raw[key];
            const smoothedProbability = (raw[prevKey].probability + center.probability * 2 + raw[nextKey].probability) / 4;
            heatmap[key] = { ...center, probability: smoothedProbability };
        }
    }
    return heatmap;
}

function averageDurationByHour(outages) {
    const completed = outages.filter(
        o => o.start && o.end && (o.type || 'corte') === 'corte' && o.duration_minutes > 0
    );
    const grouped = {};
    completed.forEach(outage => {
        const hour = caracasGetHours(new Date(outage.start));
        if (!grouped[hour]) grouped[hour] = [];
        grouped[hour].push(outage.duration_minutes);
    });
    const averages = {};
    Object.entries(grouped).forEach(([hour, durations]) => {
        averages[+hour] = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    });
    return averages;
}

function computeSurvivalCurve(outages) {
    const completed = outages.filter(
        o => o.start && o.end && (o.type || 'corte') === 'corte' && o.duration_minutes > 0
    );
    if (completed.length < 2) return null;
    const lambda = completed.reduce((s, o) => s + o.duration_minutes, 0) / completed.length;
    return { lambda, n: completed.length };
}

function adjustedProbability(rawProbability, confidence) {
    return confidence < 0.15 ? 0 : rawProbability * confidence;
}

function computeMarginOfError(hits, observations) {
    if (!observations || observations <= 0) return null;
    const pHat = hits / observations;
    const z2 = WILSON_Z * WILSON_Z;
    const denominator = 1 + z2 / observations;
    const margin = (WILSON_Z * Math.sqrt((pHat * (1 - pHat)) / observations + z2 / (4 * observations * observations))) / denominator;
    return Math.round(margin * 100);
}

function riskColor(probability) {
    if (probability < 0.05) return '#475569';
    if (probability < 0.2)  return '#639922';
    if (probability < 0.4)  return '#d97706';
    if (probability < 0.6)  return '#e24b4a';
    return '#b91c1c';
}

function riskLabel(probability, confidence) {
    if (confidence < 0.15)  return 'Sin datos';
    if (probability < 0.05) return 'Sin riesgo';
    if (probability < 0.2)  return 'Bajo';
    if (probability < 0.4)  return 'Moderado';
    if (probability < 0.6)  return 'Alto';
    return 'Muy alto';
}

function computeRecoveryGaps(outages) {
    const completed = outages
        .filter(o => o.start && o.end && (o.type || 'corte') === 'corte')
        .map(o => ({ start: new Date(o.start), end: new Date(o.end) }))
        .sort((a, b) => a.start - b.start);
    const gaps = [];
    for (let i = 1; i < completed.length; i++) {
        const hours = (completed[i].start - completed[i - 1].end) / 3600000;
        if (hours >= 0) gaps.push(hours);
    }
    return { gaps, completed };
}

function getConsecutiveOutageStatus(outages, now = new Date()) {
    const { gaps, completed } = computeRecoveryGaps(outages);
    if (gaps.length < CONSECUTIVE_OUTAGE_MIN_SAMPLE || completed.length === 0) return null;

    const lastEnd = completed[completed.length - 1].end;
    const hoursElapsed = (now - lastEnd) / 3600000;
    if (hoursElapsed < 0 || hoursElapsed > CONSECUTIVE_OUTAGE_MAX_ELAPSED_HOURS) return null;

    const eligible = gaps.filter(g => g >= hoursElapsed);
    if (eligible.length < CONSECUTIVE_OUTAGE_MIN_SAMPLE) return null;

    const within = eligible.filter(g => g <= hoursElapsed + CONSECUTIVE_OUTAGE_WINDOW_HOURS).length;
    let probability = (within + 0.5) / (eligible.length + 1);

    const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
    if (hoursElapsed > median) {
        probability *= Math.exp(-(hoursElapsed - median) / median);
    }

    const percent = Math.round(probability * 100);
    const level = percent < 15 ? 'bajo' : percent < 35 ? 'moderado' : 'alto';

    return {
        percent,
        level,
        hoursAhead: CONSECUTIVE_OUTAGE_WINDOW_HOURS,
        hoursElapsed: Math.round(hoursElapsed * 10) / 10,
        sampleSize: eligible.length,
    };
}

function getOnsetHint(outages, dayOfWeek, hour) {
    const completed = outages.filter(o => o.start && o.end && (o.type || 'corte') === 'corte');
    const minutesInHour = completed
        .filter(o => {
            const start = new Date(o.start);
            return caracasGetDay(start) === dayOfWeek && caracasGetHours(start) === hour;
        })
        .map(o => new Date(o.start).getMinutes());

    if (minutesInHour.length < ONSET_HINT_MIN_SAMPLES) return null;

    const sorted = [...minutesInHour].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    if (median < 15) return 'primeros 15 min';
    if (median < 30) return 'segundo cuarto';
    if (median < 45) return 'tercer cuarto';
    return 'últimos 15 min';
}

function getDayForecast(predictions, outages) {
    const hasEnoughData = predictions.some(p => p.confidence >= 0.15);
    if (!hasEnoughData) return { type: 'nodata' };

    const now = new Date();
    const startOfToday = getTodayStartUTC();
    const caracasNowHour = caracasGetHours(now);
    const caracasNowDay = caracasGetDay(now);

    const todayCortes = outages.filter(o =>
        o.end && (o.type || 'corte') === 'corte' && new Date(o.start) >= startOfToday
    );
    const hadOutageToday = todayCortes.length > 0;
    const activeNow = !!(window._activeOutage);

    const riskyHours = predictions.filter(p => {
        if (adjustedProbability(p.probability, p.confidence) < RISK_THRESHOLD) return false;
        if (p.hour <= 4 && (p.startHits || 0) === 0) return false;
        return true;
    });

    if (riskyHours.length === 0) return { type: 'safe' };

    const ranges = [];
    let rangeStart = null, rangeEnd = null;
    riskyHours.forEach(({ hour }) => {
        if (rangeStart === null) { rangeStart = hour; rangeEnd = hour; }
        else if (hour === rangeEnd + 1) { rangeEnd = hour; }
        else { ranges.push([rangeStart, rangeEnd]); rangeStart = hour; rangeEnd = hour; }
    });
    if (rangeStart !== null) ranges.push([rangeStart, rangeEnd]);

    const peakHour = riskyHours.reduce((peak, current) =>
        adjustedProbability(current.probability, current.confidence) >
        adjustedProbability(peak.probability, peak.confidence) ? current : peak,
        riskyHours[0]
    );

    const lastRiskyHour = riskyHours[riskyHours.length - 1].hour;
    const allRiskyPassed = caracasNowHour > lastRiskyHour;
    const inRiskyWindow = riskyHours.some(p => p.hour === caracasNowHour);

    if (hadOutageToday || activeNow) {
        return { type: 'already_hit', ranges, peakHour: peakHour.hour, active: activeNow };
    }

    if (allRiskyPassed && !hadOutageToday) {
        return { type: 'missed', ranges, peakHour: peakHour.hour };
    }

    const rangeTexts = ranges.map(([start, end]) =>
        start === end
            ? `las ${padZero(start)}:00`
            : `las ${padZero(start)}:00–${padZero(end + 1)}:00`
    );
    const rangeDescription = rangeTexts.length === 1
        ? rangeTexts[0]
        : rangeTexts.slice(0, -1).join(', ') + ' y ' + rangeTexts.slice(-1);

    const durationsByHour = averageDurationByHour(outages);
    const riskyDurations = riskyHours.map(p => p.hour).filter(h => durationsByHour[h]).map(h => durationsByHour[h]);
    const estimatedMinutes = riskyDurations.length > 0
        ? Math.round(riskyDurations.reduce((sum, d) => sum + d, 0) / riskyDurations.length)
        : null;

    const peakAdj = adjustedProbability(peakHour.probability, peakHour.confidence);
    const onsetHint = getOnsetHint(outages, caracasNowDay, peakHour.hour);
    const marginOfError = computeMarginOfError(peakHour.hits, peakHour.observations);

    return {
        type: 'risk',
        message: `Es probable que se vaya la luz entre ${rangeDescription}.`,
        peakHour: peakHour.hour,
        peakPercent: Math.round(peakAdj * 100),
        peakLevel: peakAdj < 0.4 ? 'moderado' : 'alto',
        estimatedMinutes,
        onsetHint,
        marginOfError,
        peakHits: peakHour.hits,
        peakObservations: peakHour.observations,
    };
}

function computeStatistics(outages) {
    const startOfToday = getTodayStartUTC();
    const startOfWeek  = getWeekStartUTC();
    const startOfMonth = getMonthStartUTC();
    const startOfYear  = getYearStartUTC();

    const completed    = outages.filter(o => o.start && o.end && (o.type || 'corte') === 'corte' && o.duration_minutes != null);
    const fluctuations = outages.filter(o => (o.type || 'corte') === 'fluctuacion');
    const sumMinutes   = list => list.reduce((total, o) => total + (o.duration_minutes || 0), 0);

    const thisWeek  = completed.filter(o => new Date(o.start) >= startOfWeek);
    const thisMonth = completed.filter(o => new Date(o.start) >= startOfMonth);
    const thisYear  = completed.filter(o => new Date(o.start) >= startOfYear);

    const longestOutage = completed.reduce(
        (longest, o) => (o.duration_minutes || 0) > (longest?.duration_minutes || 0) ? o : longest,
        null
    );

    const byDay = {};
    completed.forEach(o => {
        const key = caracasToDateString(new Date(o.start));
        if (!byDay[key]) byDay[key] = { minutes: 0, count: 0, date: new Date(o.start) };
        byDay[key].minutes += o.duration_minutes || 0;
        byDay[key].count++;
    });
    const worstDay = Object.values(byDay).sort((a, b) => b.minutes - a.minutes)[0] || null;

    const slotFrequency = {};
    completed.forEach(o => {
        getHourlySlots(o).forEach(({ hour }) => {
            slotFrequency[hour] = (slotFrequency[hour] || 0) + 1;
        });
    });
    const peakEntry = Object.entries(slotFrequency).sort((a, b) => b[1] - a[1])[0];

    const now = new Date();
    const daysTracked = completed.length > 0
        ? Math.max(1, Math.ceil((now - new Date(Math.min(...completed.map(o => new Date(o.start).getTime())))) / 86400000))
        : 1;

    return {
        weekMinutes:   sumMinutes(thisWeek),   weekCount:  thisWeek.length,
        monthMinutes:  sumMinutes(thisMonth),  monthCount: thisMonth.length,
        yearMinutes:   sumMinutes(thisYear),   yearCount:  thisYear.length,
        longestOutage,
        worstDay,
        peakHour:      peakEntry ? +peakEntry[0] : null,
        dailyAverage:  sumMinutes(completed) / daysTracked,
        fluctuationsToday:     fluctuations.filter(o => new Date(o.start) >= startOfToday).length,
        fluctuationsThisWeek:  fluctuations.filter(o => new Date(o.start) >= startOfWeek).length,
        fluctuationsThisMonth: fluctuations.filter(o => new Date(o.start) >= startOfMonth).length,
    };
}

function computeAverageMood(outages) {
    const withMood = outages.filter(o => o.mood && o.end && (o.type || 'corte') === 'corte');
    if (withMood.length === 0) return null;
    const recent  = withMood.slice(0, 20);
    const average = recent.reduce((sum, o) => sum + o.mood, 0) / recent.length;
    return { average, totalCount: withMood.length };
}

function computeTrainingProgress(outages) {
    const completed = outages.filter(o => o.start && o.end && (o.type || 'corte') === 'corte');
    if (completed.length === 0) return { weeks: 0, percent: 0, isReady: false };
    const earliestDate = new Date(Math.min(...completed.map(o => new Date(o.start).getTime())));
    const weeksElapsed = (new Date() - earliestDate) / (7 * 24 * 3600 * 1000);
    const percent      = Math.min(Math.round((weeksElapsed / WEEKS_FOR_FULL_CONFIDENCE) * 100), 100);
    return { weeks: Math.floor(weeksElapsed), percent, isReady: weeksElapsed >= WEEKS_FOR_FULL_CONFIDENCE };
}

function getTomorrowForecast(outages) {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 86400000);
    const tomorrowDay = caracasGetDay(tomorrow);

    const heatmap = buildHeatmap(outages);
    if (!heatmap) return null;

    const tomorrowPredictions = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        ...(heatmap[`${tomorrowDay}_${hour}`] || { probability: 0, confidence: 0, startHits: 0 })
    }));

    const hasData = tomorrowPredictions.some(p => p.confidence >= 0.15);
    if (!hasData) return null;

    const riskyHours = tomorrowPredictions.filter(p => {
        if (adjustedProbability(p.probability, p.confidence) < RISK_THRESHOLD) return false;
        if (p.hour <= 4 && (p.startHits || 0) === 0) return false;
        return true;
    });

    if (!riskyHours.length) return { type: 'safe' };

    const peak = riskyHours.reduce((a, b) =>
        adjustedProbability(b.probability, b.confidence) > adjustedProbability(a.probability, a.confidence) ? b : a
    );

    const ranges = [];
    let rs = null, re = null;
    riskyHours.forEach(({ hour }) => {
        if (rs === null) { rs = hour; re = hour; }
        else if (hour === re + 1) { re = hour; }
        else { ranges.push([rs, re]); rs = hour; re = hour; }
    });
    if (rs !== null) ranges.push([rs, re]);

    const rangeTexts = ranges.map(([a, b]) =>
        a === b ? `${padZero(a)}:00` : `${padZero(a)}:00–${padZero(b + 1)}:00`
    );
    const rangeDescription = rangeTexts.length === 1
        ? rangeTexts[0]
        : rangeTexts.slice(0, -1).join(', ') + ' y ' + rangeTexts.slice(-1);

    const peakAdj = adjustedProbability(peak.probability, peak.confidence);
    const marginOfError = computeMarginOfError(peak.hits, peak.observations);

    return {
        type: 'risk',
        ranges: rangeDescription,
        peakHour: peak.hour,
        peakPercent: Math.round(peakAdj * 100),
        peakLevel: peakAdj < 0.4 ? 'moderado' : 'alto',
        marginOfError,
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        buildHeatmap, getHourlySlots, adjustedProbability, riskColor, riskLabel,
        getDayForecast, getTomorrowForecast, computeStatistics, computeAverageMood,
        computeTrainingProgress, averageDurationByHour, computeSurvivalCurve,
        getOnsetHint, getConsecutiveOutageStatus, computeRecoveryGaps, computeMarginOfError,
        RISK_THRESHOLD, WEEKS_FOR_FULL_CONFIDENCE, HEATMAP_WINDOW_DAYS,
    };
}