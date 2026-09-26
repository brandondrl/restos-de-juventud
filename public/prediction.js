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
    cursor.setUTCMinutes(0, 0, 0); // Caracas es UTC−4 fijo: la hora en punto UTC es la de Caracas
    const endTime = new Date(outage.end);
    while (cursor < endTime) {
        slots.push({ dayOfWeek: caracasGetDay(cursor), hour: caracasGetHours(cursor) });
        cursor.setTime(cursor.getTime() + 3600000);
    }
    return slots;
}

// `now` y `options.windowDays` son opcionales; sin ellos el resultado es el de siempre
// (reloj real y ventana de HEATMAP_WINDOW_DAYS). El backtest los usa para entrenar en el pasado.
function buildHeatmap(outages, now, options = {}) {
    const reference = now ? new Date(now) : null;
    const currentTime = () => reference ? new Date(reference) : new Date();
    const windowDays = options.windowDays || HEATMAP_WINDOW_DAYS;

    const completed = outages.filter(
        o => o.start && o.end && (o.type || 'corte') === 'corte'
    );
    if (completed.length === 0) return null;

    const allDates = completed.flatMap(o => [new Date(o.start), new Date(o.end)]);
    const earliestDate = new Date(Math.min(...allDates.map(d => d.getTime())));

    const windowStart = currentTime();
    windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);
    windowStart.setUTCHours(0, 0, 0, 0);

    const effectiveStart = new Date(Math.max(earliestDate.getTime(), windowStart.getTime()));

    const observationCount = {};
    const hitCount = {};

    const cursor = new Date(effectiveStart);
    cursor.setUTCHours(0, 0, 0, 0);
    while (cursor <= currentTime()) {
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
        .map(o => new Date(o.start).getUTCMinutes());

    if (minutesInHour.length < ONSET_HINT_MIN_SAMPLES) return null;

    const sorted = [...minutesInHour].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    if (median < 15) return 'primeros 15 min';
    if (median < 30) return 'segundo cuarto';
    if (median < 45) return 'tercer cuarto';
    return 'últimos 15 min';
}

// Regla única de "hora de riesgo" del forecast (la usan también el backtest y el marcador).
function isRiskyHour(prediction, threshold = RISK_THRESHOLD) {
    if (adjustedProbability(prediction.probability, prediction.confidence) < threshold) return false;
    if (prediction.hour <= 4 && (prediction.startHits || 0) === 0) return false;
    return true;
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

function describeHourRanges(ranges, prefix = '') {
    const texts = ranges.map(([start, end]) =>
        start === end
            ? `${prefix}${padZero(start)}:00`
            : `${prefix}${padZero(start)}:00–${padZero(end + 1)}:00`
    );
    return texts.length === 1 ? texts[0] : texts.slice(0, -1).join(', ') + ' y ' + texts.slice(-1);
}

function dayPredictionsFromHeatmap(heatmap, dayOfWeek) {
    return Array.from({ length: 24 }, (_, hour) => ({
        hour,
        ...((heatmap && heatmap[`${dayOfWeek}_${hour}`]) || { probability: 0, confidence: 0, startHits: 0 })
    }));
}

// Duración estimada y hora típica de inicio. Aparte porque getOnsetHint es caro (timezone.js)
// y getDayForecast solo lo necesita en el caso "risk".
function forecastDetails(outages, riskyHours, dayOfWeek, peakHour) {
    const durationsByHour = averageDurationByHour(outages);
    const riskyDurations = riskyHours.map(p => p.hour).filter(h => durationsByHour[h]).map(h => durationsByHour[h]);
    const estimatedMinutes = riskyDurations.length > 0
        ? Math.round(riskyDurations.reduce((sum, d) => sum + d, 0) / riskyDurations.length)
        : null;
    return { estimatedMinutes, onsetHint: getOnsetHint(outages, dayOfWeek, peakHour) };
}

// Núcleo común de getDayForecast y getTomorrowForecast (2.2): horas de riesgo, rangos,
// pico, margen, duración estimada y hora típica de inicio para un día de la semana.
// `options.predictions` permite pasar las 24 predicciones ya armadas (así las recibe getDayForecast);
// `options.details: false` omite estimatedMinutes y onsetHint.
function buildForecastForDay(heatmap, outages, targetDayOfWeek, options = {}) {
    const predictions = options.predictions || dayPredictionsFromHeatmap(heatmap, targetDayOfWeek);
    if (!predictions.some(p => p.confidence >= 0.15)) {
        return { hasData: false, predictions, riskyHours: [], ranges: [] };
    }

    const riskyHours = predictions.filter(p => isRiskyHour(p));
    const ranges = groupHourRanges(riskyHours.map(p => p.hour));
    if (riskyHours.length === 0) return { hasData: true, predictions, riskyHours, ranges };

    const peak = riskyHours.reduce((best, current) =>
        adjustedProbability(current.probability, current.confidence) >
        adjustedProbability(best.probability, best.confidence) ? current : best,
        riskyHours[0]
    );
    const peakAdj = adjustedProbability(peak.probability, peak.confidence);

    return {
        hasData: true,
        predictions,
        riskyHours,
        ranges,
        peak,
        peakHour: peak.hour,
        peakPercent: Math.round(peakAdj * 100),
        peakLevel: peakAdj < 0.4 ? 'moderado' : 'alto',
        marginOfError: computeMarginOfError(peak.hits, peak.observations),
        ...(options.details === false ? {} : forecastDetails(outages, riskyHours, targetDayOfWeek, peak.hour)),
    };
}

// 24 puntos listos para gráficas y listas: probabilidad ajustada, confianza y nivel en texto.
function getDayPredictions(heatmap, dayOfWeek) {
    return Array.from({ length: 24 }, (_, hour) => {
        const slot = (heatmap && heatmap[`${dayOfWeek}_${hour}`]) || { probability: 0, confidence: 0, observations: 0 };
        const adjusted = adjustedProbability(slot.probability, slot.confidence);
        return {
            hour,
            adjusted,
            confidence: slot.confidence,
            observations: slot.observations || 0,
            level: riskLabel(adjusted, slot.confidence),
        };
    });
}

// `options.now` y `options.activeOutage` son opcionales; sin ellos se usa el reloj real
// y `window._activeOutage`, como siempre.
function getDayForecast(predictions, outages, options = {}) {
    const now = options.now ? new Date(options.now) : new Date();
    const caracasNowHour = caracasGetHours(now);
    const caracasNowDay = caracasGetDay(now);
    const forecast = buildForecastForDay(null, outages, caracasNowDay, { predictions, details: false });
    if (!forecast.hasData) return { type: 'nodata' };

    const startOfToday = getTodayStartUTC(undefined, now);
    const todayCortes = outages.filter(o =>
        o.end && (o.type || 'corte') === 'corte' && new Date(o.start) >= startOfToday
    );
    const hadOutageToday = todayCortes.length > 0;
    const activeOutage = options.activeOutage !== undefined
        ? options.activeOutage
        : (typeof window !== 'undefined' ? window._activeOutage : null);
    const activeNow = !!activeOutage;

    const { riskyHours, ranges } = forecast;
    if (riskyHours.length === 0) return { type: 'safe' };

    const lastRiskyHour = riskyHours[riskyHours.length - 1].hour;
    const allRiskyPassed = caracasNowHour > lastRiskyHour;

    if (hadOutageToday || activeNow) {
        return { type: 'already_hit', ranges, peakHour: forecast.peakHour, active: activeNow };
    }

    if (allRiskyPassed && !hadOutageToday) {
        return { type: 'missed', ranges, peakHour: forecast.peakHour };
    }

    const { estimatedMinutes, onsetHint } = forecastDetails(outages, riskyHours, caracasNowDay, forecast.peakHour);

    return {
        type: 'risk',
        message: `Es probable que se vaya la luz entre ${describeHourRanges(ranges, 'las ')}.`,
        peakHour: forecast.peakHour,
        peakPercent: forecast.peakPercent,
        peakLevel: forecast.peakLevel,
        estimatedMinutes,
        onsetHint,
        marginOfError: forecast.marginOfError,
        peakHits: forecast.peak.hits,
        peakObservations: forecast.peak.observations,
    };
}

function computeStatistics(outages, now = new Date()) {
    const startOfToday = getTodayStartUTC(undefined, now);
    const startOfWeek  = getWeekStartUTC(undefined, now);
    const startOfMonth = getMonthStartUTC(undefined, now);
    const startOfYear  = getYearStartUTC(undefined, now);

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

function getTomorrowForecast(outages, existingHeatmap, now) {
    const reference = now ? new Date(now) : new Date();
    const tomorrowDay = caracasGetDay(new Date(reference.getTime() + 86400000));

    const heatmap = existingHeatmap || buildHeatmap(outages, now);
    if (!heatmap) return null;

    const forecast = buildForecastForDay(heatmap, outages, tomorrowDay);
    if (!forecast.hasData) return null;
    if (forecast.riskyHours.length === 0) return { type: 'safe' };

    return {
        type: 'risk',
        ranges: describeHourRanges(forecast.ranges),
        peakHour: forecast.peakHour,
        peakPercent: forecast.peakPercent,
        peakLevel: forecast.peakLevel,
        marginOfError: forecast.marginOfError,
        estimatedMinutes: forecast.estimatedMinutes,
        onsetHint: forecast.onsetHint,
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        buildHeatmap, getHourlySlots, adjustedProbability, isRiskyHour, riskColor, riskLabel,
        getDayForecast, getTomorrowForecast, buildForecastForDay, getDayPredictions, computeStatistics, computeAverageMood,
        computeTrainingProgress, averageDurationByHour, computeSurvivalCurve,
        getOnsetHint, getConsecutiveOutageStatus, computeRecoveryGaps, computeMarginOfError,
        RISK_THRESHOLD, WEEKS_FOR_FULL_CONFIDENCE, HEATMAP_WINDOW_DAYS,
    };
}