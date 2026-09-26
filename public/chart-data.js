// Adaptadores puros (fase 2.1): del heatmap del motor a las props de public/charts.js.
// No calculan probabilidades nuevas: solo mapean lo que ya entrega prediction.js.
// Hora y día siempre en VET (caracas*), nunca con getHours() del navegador (mina 3).

if (typeof module !== 'undefined' && typeof require === 'function' && typeof caracasGetHours === 'undefined') {
    require('./timezone.js');
}

const CHART_DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const CHART_MIN_CONFIDENCE = 0.15;

function chartDataEngine() {
    if (typeof isRiskyHour === 'function') return { adjustedProbability, isRiskyHour, getDayPredictions, RISK_THRESHOLD };
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

function riskCurvePoints(heatmap, dayOfWeek) {
    return chartDataEngine().getDayPredictions(heatmap, dayOfWeek)
        .map(p => ({ hour: p.hour, value: p.adjusted, observations: p.observations, level: p.level }));
}

// Día de "mañana" en VET (sábado 21:00 VET = domingo 01:00 UTC → mañana es domingo).
function tomorrowDayOfWeek(now = new Date()) {
    return caracasGetDay(new Date(new Date(now).getTime() + 86400000));
}

function riskCurveAriaLabel(points, ranges, dayText) {
    const prefix = `Riesgo por hora ${dayText}: `;
    const peak = points.reduce((best, p) => (p.value > (best ? best.value : 0) ? p : best), null);
    if (!peak || !ranges.length) return `${prefix}sin horas de riesgo`;
    const rangeText = ranges.map(([start, end]) => `entre ${chartDataPad(start)}:00 y ${chartDataPad(end + 1)}:00`).join(' y ');
    return `${prefix}pico ${Math.round(peak.value * 100)} % a las ${chartDataPad(peak.hour)}:00, riesgo ${rangeText}`;
}

// Props de riskLineChart para "hoy" o "mañana" (2.2). La otra serie va como fantasma y
// yMax usa hoy y mañana juntos (regla 2.1.2): ambas vistas comparten escala.
function buildRiskCurveProps({ id, heatmap, now = new Date(), selectedHour, day = 'today' } = {}) {
    const engine = chartDataEngine();
    const isTomorrow = day === 'tomorrow';
    const today = caracasGetDay(now);
    const tomorrow = tomorrowDayOfWeek(now);
    const shownDay = isTomorrow ? tomorrow : today;
    const todayPoints = riskCurvePoints(heatmap, today);
    const tomorrowPoints = riskCurvePoints(heatmap, tomorrow);
    const points = isTomorrow ? tomorrowPoints : todayPoints;
    const riskBands = riskRangesFromPredictions(predictionsForDay(heatmap, shownDay));
    const maxValue = Math.max(0, ...todayPoints.map(p => p.value), ...tomorrowPoints.map(p => p.value));
    const props = {
        id,
        points,
        ghostPoints: heatmap ? (isTomorrow ? todayPoints : tomorrowPoints) : undefined,
        yMax: chartDataNiceMax(maxValue),
        threshold: engine.RISK_THRESHOLD,
        riskBands,
        ariaLabel: riskCurveAriaLabel(points, riskBands, isTomorrow ? 'mañana' : 'hoy'),
    };
    if (!isTomorrow) props.nowHour = caracasGetHours(now);
    if (Number.isInteger(selectedHour) && selectedHour >= 0 && selectedHour < 24) props.selectedHour = selectedHour;
    return props;
}

function buildWeeklyHeatGridProps({ id, heatmap, now = new Date(), dayLabels = CHART_DAY_LABELS, selectedIndex, highlightDay } = {}) {
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
        highlightRows: [Number.isInteger(highlightDay) ? highlightDay : today],
        nowCell: { row: today, col: caracasGetHours(now) },
        selectedIndex: Number.isInteger(selectedIndex) ? selectedIndex : undefined,
        ariaLabel: 'Mapa de calor semanal: riesgo de corte por día y hora según tu historial',
    };
}

// --- Selección Hoy / Mañana (2.2) ---

const FORECAST_DAY_STORAGE_KEY = 'rdj_forecast_day';
const FORECAST_DAY_PRESELECT_HOUR = 20;

function isForecastDay(value) {
    return value === 'today' || value === 'tomorrow';
}

// ¿Queda alguna hora de riesgo hoy, contando la hora en curso?
function restOfTodayHasRisk(heatmap, now = new Date()) {
    const engine = chartDataEngine();
    const hour = caracasGetHours(now);
    return predictionsForDay(heatmap, caracasGetDay(now)).some(p => p.hour >= hour && engine.isRiskyHour(p));
}

// La elección manual de la sesión manda; si no hay, desde las 20:00 VET sin riesgo
// restante se preselecciona mañana; si no, lo recordado de otra sesión o "hoy".
function resolveForecastDay({ stored, manual, heatmap, now = new Date() } = {}) {
    if (isForecastDay(manual)) return manual;
    if (heatmap && caracasGetHours(now) >= FORECAST_DAY_PRESELECT_HOUR && !restOfTodayHasRisk(heatmap, now)) return 'tomorrow';
    return stored === 'tomorrow' ? 'tomorrow' : 'today';
}

function readStoredForecastDay(storage) {
    try {
        const value = storage ? storage.getItem(FORECAST_DAY_STORAGE_KEY) : null;
        return isForecastDay(value) ? value : null;
    } catch {
        return null;
    }
}

// Solo estado local + localStorage: cambiar de día nunca pide nada a la red.
function saveForecastDayChoice(state, day, storage) {
    if (!isForecastDay(day)) return false;
    state.forecastDay = day;
    state.forecastDayManual = day;
    try {
        if (storage) storage.setItem(FORECAST_DAY_STORAGE_KEY, day);
    } catch {
        // modo privado / iOS: la elección vale para esta sesión
    }
    return true;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        predictionsForDay, riskRangesFromPredictions, riskCurvePoints,
        buildRiskCurveProps, buildWeeklyHeatGridProps, CHART_DAY_LABELS, tomorrowDayOfWeek,
        restOfTodayHasRisk, resolveForecastDay, readStoredForecastDay, saveForecastDayChoice,
        FORECAST_DAY_STORAGE_KEY,
    };
}
