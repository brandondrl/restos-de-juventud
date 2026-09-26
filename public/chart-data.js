// Adaptadores puros (fase 2.1): del heatmap del motor a las props de public/charts.js.
// No calculan probabilidades nuevas: solo mapean lo que ya entrega prediction.js.
// Hora y día siempre en VET (caracas*), nunca con getHours() del navegador (mina 3).

if (typeof module !== 'undefined' && typeof require === 'function' && typeof caracasGetHours === 'undefined') {
    require('./timezone.js');
}

const CHART_DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const CHART_MIN_CONFIDENCE = 0.15;

function chartDataEngine() {
    if (typeof isRiskyHour === 'function') return { adjustedProbability, isRiskyHour, riskLabel, RISK_THRESHOLD };
    return require('./prediction.js');
}

function chartDataNiceMax(value) {
    return typeof niceMax === 'function' ? niceMax(value) : require('./charts.js').niceMax(value);
}

function chartDataPad(hour) {
    return String(hour).padStart(2, '0');
}

function predictionsForDay(heatmap, dayOfWeek) {
    if (!heatmap) return [];
    return Array.from({ length: 24 }, (_, hour) => ({
        hour, ...(heatmap[`${dayOfWeek}_${hour}`] || { probability: 0, confidence: 0 }),
    }));
}

// Misma regla y agrupación que los rangos de getDayForecast/getTomorrowForecast.
function riskRangesFromPredictions(predictions, threshold) {
    const engine = chartDataEngine();
    const ranges = [];
    predictions
        .filter(p => engine.isRiskyHour(p, threshold === undefined ? engine.RISK_THRESHOLD : threshold))
        .forEach(({ hour }) => {
            const last = ranges[ranges.length - 1];
            if (last && hour === last[1] + 1) last[1] = hour;
            else ranges.push([hour, hour]);
        });
    return ranges;
}

function riskCurvePoints(predictions) {
    const engine = chartDataEngine();
    return predictions.map(p => {
        const value = engine.adjustedProbability(p.probability, p.confidence);
        return { hour: p.hour, value, observations: p.observations || 0, level: engine.riskLabel(value, p.confidence) };
    });
}

function riskCurveAriaLabel(points, ranges, dayText) {
    const prefix = `Riesgo por hora ${dayText}: `;
    const peak = points.reduce((best, p) => (p.value > (best ? best.value : 0) ? p : best), null);
    if (!peak || !ranges.length) return `${prefix}sin horas de riesgo`;
    const rangeText = ranges.map(([start, end]) => `entre ${chartDataPad(start)}:00 y ${chartDataPad(end + 1)}:00`).join(' y ');
    return `${prefix}pico ${Math.round(peak.value * 100)} % a las ${chartDataPad(peak.hour)}:00, riesgo ${rangeText}`;
}

// Props de riskLineChart para "hoy". yMax usa hoy y mañana juntos (regla 2.1.2),
// así la escala no cambia cuando 2.2 permita ver mañana.
function buildRiskCurveProps({ id, heatmap, now = new Date(), selectedHour } = {}) {
    const engine = chartDataEngine();
    const today = caracasGetDay(now);
    const todayPredictions = predictionsForDay(heatmap, today);
    const tomorrowPoints = riskCurvePoints(predictionsForDay(heatmap, (today + 1) % 7));
    const points = riskCurvePoints(todayPredictions);
    const riskBands = riskRangesFromPredictions(todayPredictions);
    const maxValue = Math.max(0, ...points.map(p => p.value), ...tomorrowPoints.map(p => p.value));
    const props = {
        id,
        points,
        yMax: chartDataNiceMax(maxValue),
        threshold: engine.RISK_THRESHOLD,
        riskBands,
        nowHour: caracasGetHours(now),
        ariaLabel: riskCurveAriaLabel(points, riskBands, 'hoy'),
    };
    if (Number.isInteger(selectedHour) && selectedHour >= 0 && selectedHour < 24) props.selectedHour = selectedHour;
    return props;
}

function buildWeeklyHeatGridProps({ id, heatmap, now = new Date(), dayLabels = CHART_DAY_LABELS, selectedIndex } = {}) {
    const engine = chartDataEngine();
    const today = caracasGetDay(now);
    const cells = dayLabels.map((dayLabel, day) => predictionsForDay(heatmap, day).map(p => {
        const hasData = p.confidence >= CHART_MIN_CONFIDENCE;
        const value = hasData ? engine.adjustedProbability(p.probability, p.confidence) : null;
        const text = hasData ? `${Math.round(value * 100)} %` : 'sin datos';
        return { value, label: `${dayLabel} ${chartDataPad(p.hour)}:00 · ${text}` };
    }));
    return {
        id,
        rowLabels: dayLabels.slice(),
        colLabels: Array.from({ length: 24 }, (_, hour) => (hour % 3 === 0 ? chartDataPad(hour) : '')),
        cells,
        highlightRows: [today],
        nowCell: { row: today, col: caracasGetHours(now) },
        selectedIndex: Number.isInteger(selectedIndex) ? selectedIndex : undefined,
        ariaLabel: 'Mapa de calor semanal: riesgo de corte por día y hora según tu historial',
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        predictionsForDay, riskRangesFromPredictions, riskCurvePoints,
        buildRiskCurveProps, buildWeeklyHeatGridProps, CHART_DAY_LABELS,
    };
}
