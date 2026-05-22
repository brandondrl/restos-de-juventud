const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAYS_FULL  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WEEKS_FOR_FULL_CONFIDENCE = 4;

function padZero(number) {
    return String(number).padStart(2, '0');
}

function getHourlySlots(outage) {
    const slots = [];
    const cursor = new Date(outage.start);
    cursor.setMinutes(0, 0, 0);
    const endTime = new Date(outage.end);
    while (cursor < endTime) {
        slots.push({ dayOfWeek: cursor.getDay(), hour: cursor.getHours() });
        cursor.setHours(cursor.getHours() + 1);
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

    const observationCount = {};
    const hitCount = {};

    const cursor = new Date(earliestDate);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= new Date()) {
        for (let hour = 0; hour < 24; hour++) {
            const key = `${cursor.getDay()}_${hour}`;
            observationCount[key] = (observationCount[key] || 0) + 1;
        }
        cursor.setDate(cursor.getDate() + 1);
    }

    completed.forEach(outage => {
        getHourlySlots(outage).forEach(({ dayOfWeek, hour }) => {
            const key = `${dayOfWeek}_${hour}`;
            hitCount[key] = (hitCount[key] || 0) + 1;
        });
    });

    const heatmap = {};
    for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
            const key = `${day}_${hour}`;
            const observations = observationCount[key] || 0;
            const hits = hitCount[key] || 0;
            heatmap[key] = {
                probability: observations > 0 ? (hits + 0.5) / (observations + 1) : 0,
                confidence:  Math.min(observations / WEEKS_FOR_FULL_CONFIDENCE, 1),
                hits,
                observations,
            };
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
        const hour = new Date(outage.start).getHours();
        if (!grouped[hour]) grouped[hour] = [];
        grouped[hour].push(outage.duration_minutes);
    });
    const averages = {};
    Object.entries(grouped).forEach(([hour, durations]) => {
        averages[+hour] = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    });
    return averages;
}

function adjustedProbability(rawProbability, confidence) {
    return confidence < 0.15 ? 0 : rawProbability * confidence;
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

function getDayForecast(predictions, outages) {
    const hasEnoughData = predictions.some(p => p.confidence >= 0.15);
    if (!hasEnoughData) return { type: 'nodata' };

    const riskyHours = predictions.filter(
        p => adjustedProbability(p.probability, p.confidence) >= 0.18
    );
    if (riskyHours.length === 0) return { type: 'safe' };

    const ranges = [];
    let rangeStart = null;
    let rangeEnd   = null;
    riskyHours.forEach(({ hour }) => {
        if (rangeStart === null) {
            rangeStart = hour;
            rangeEnd   = hour;
        } else if (hour === rangeEnd + 1) {
            rangeEnd = hour;
        } else {
            ranges.push([rangeStart, rangeEnd]);
            rangeStart = hour;
            rangeEnd   = hour;
        }
    });
    if (rangeStart !== null) ranges.push([rangeStart, rangeEnd]);

    const peakHour = riskyHours.reduce((peak, current) =>
        adjustedProbability(current.probability, current.confidence) >
        adjustedProbability(peak.probability,    peak.confidence) ? current : peak,
        riskyHours[0]
    );

    const rangeTexts = ranges.map(([start, end]) =>
        start === end
            ? `las ${padZero(start)}:00`
            : `las ${padZero(start)}:00–${padZero(end + 1)}:00`
    );
    const rangeDescription = rangeTexts.length === 1
        ? rangeTexts[0]
        : rangeTexts.slice(0, -1).join(', ') + ' y ' + rangeTexts.slice(-1);

    const durationsByHour  = averageDurationByHour(outages);
    const riskyDurations   = riskyHours
        .map(p => p.hour)
        .filter(h => durationsByHour[h])
        .map(h => durationsByHour[h]);
    const estimatedMinutes = riskyDurations.length > 0
        ? Math.round(riskyDurations.reduce((sum, d) => sum + d, 0) / riskyDurations.length)
        : null;

    return {
        type: 'risk',
        message: `Es probable que se vaya la luz entre ${rangeDescription}.`,
        peakHour:          peakHour.hour,
        peakPercent:       Math.round(adjustedProbability(peakHour.probability, peakHour.confidence) * 100),
        peakLevel:         peakHour.probability < 0.4 ? 'moderado' : 'alto',
        estimatedMinutes,
    };
}

function computeStatistics(outages) {
    const now           = new Date();
    const startOfToday  = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek   = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear   = new Date(now.getFullYear(), 0, 1);

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
        const key = new Date(o.start).toDateString();
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
