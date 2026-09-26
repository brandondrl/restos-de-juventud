// Gráficas SVG (fase 2.1). Puro: datos ya calculados → string. Colores en style.css (.ch-*).
// Zonas de toque data-chart/data-index: las atiende el handler delegado de app.js.

const CHART_LAYOUT = {
    width: 300, // ≈ ancho útil de la tarjeta a 360 px
    font: 11,
    line: { height: 170, left: 30, right: 8, top: 22, bottom: 20 },
    bar:  { height: 160, left: 30, right: 4, top: 18, bottom: 20 },
    grid: { left: 30, right: 2, top: 16, rowH: 16, gap: 2, legend: 34 },
};
const CHART_HEAT_LEVELS = 5;

function chartNum(value) {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function chartEscape(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function chartPad(hour) {
    return String(hour).padStart(2, '0');
}

function chartClamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function chartValue(item) {
    return item && Number.isFinite(+item.value) ? Math.max(+item.value, 0) : 0;
}

// Tope del eje. Riesgo: piso 0,30, pasos de 0,10, tope 1. unitInterval:false → 1·2·2,5·5·10 × 10^k.
function niceMax(maxValue, options = {}) {
    const value = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 0;
    if (options.unitInterval === false) {
        if (value === 0) return 1;
        const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
        return [1, 2, 2.5, 5, 10].find(s => s * magnitude >= value - 1e-9) * magnitude;
    }
    return chartClamp(Math.ceil(Math.round(value * 1000) / 100 - 1e-9), 3, 10) / 10;
}

// Distancia desde el borde superior del área de dibujo.
function scaleY(value, yMax, height) {
    if (!Number.isFinite(value) || !(yMax > 0)) return height;
    return height - chartClamp(value / yMax, 0, 1) * height;
}

function formatPercent(value) {
    return value == null || !Number.isFinite(value) ? '—' : `${Math.round(value * 100)} %`;
}

function hitColumns(width, n, x0 = 0) {
    if (!(n > 0)) return [];
    const w = width / n;
    return Array.from({ length: n }, (_, i) => ({ x: x0 + i * w, width: w }));
}

function chartOpen(id, height, count, ariaLabel) {
    return `<svg class="chart" viewBox="0 0 ${CHART_LAYOUT.width} ${height}" preserveAspectRatio="xMidYMid meet" role="img"`
        + ` aria-label="${chartEscape(ariaLabel)}" tabindex="0" data-chart-root="${chartEscape(id)}" data-count="${count}"`
        + ` font-size="${CHART_LAYOUT.font}" style="touch-action:pan-y">`;
}

function chartText(x, y, text, cls, anchor = 'middle') {
    return `<text class="${cls}" x="${chartNum(x)}" y="${chartNum(y)}" text-anchor="${anchor}">${chartEscape(text)}</text>`;
}

function chartLine(cls, x1, y1, x2, y2, extra = '') {
    const f = chartNum;
    return `<line class="${cls}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"${extra}/>`;
}

function chartRect(cls, x, y, width, height, extra = '') {
    const f = chartNum;
    return `<rect class="${cls}" x="${f(x)}" y="${f(y)}" width="${f(width)}" height="${f(height)}"${extra}/>`;
}

// Cuadrícula horizontal sólida + 3 etiquetas Y (0, mitad y tope).
function chartYAxis(layout, yMax, plotH, format) {
    return [0, yMax / 2, yMax].map(v => {
        const y = layout.top + scaleY(v, yMax, plotH);
        return chartLine('ch-grid', layout.left, y, CHART_LAYOUT.width - layout.right, y)
            + chartText(layout.left - 4, y + 4, format(v), 'ch-label ch-y', 'end');
    }).join('');
}

function chartHits(id, columns, height) {
    return columns.map((c, i) =>
        chartRect('ch-hit', c.x, 0, c.width, height, ` fill="transparent" data-chart="${chartEscape(id)}" data-index="${i}"`)).join('');
}

// Tooltip dentro del SVG, centrado en cx y recolocado para no salirse por los bordes.
function chartTooltip(cx, top, lines) {
    const boxWidth = Math.max(...lines.map(l => String(l).length)) * 6.2 + 16;
    const x = chartClamp(cx - boxWidth / 2, 2, CHART_LAYOUT.width - 2 - boxWidth);
    return `<g class="ch-tip">${chartRect('ch-tooltip', x, top, boxWidth, lines.length * 15 + 8, ' rx="4"')}`
        + lines.map((l, i) => chartText(x + 8, top + 16 + i * 15, l, i ? 'ch-tooltip-sub' : 'ch-tooltip-main', 'start')).join('')
        + '</g>';
}

// Interpolación monotónica (Fritsch–Carlson): pasa por cada punto sin sobrepasar sus valores.
function chartMonotonePath(pts) {
    const f = chartNum, n = pts.length, k = [], t = [];
    if (!n) return '';
    for (let i = 0; i < n - 1; i++) k.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x));
    for (let i = 0; i < n; i++) t.push(i === 0 ? k[0] : i === n - 1 ? k[i - 1] : k[i - 1] * k[i] <= 0 ? 0 : (k[i - 1] + k[i]) / 2);
    for (let i = 0; i < n - 1; i++) {
        const a = t[i] / k[i], b = t[i + 1] / k[i], h = Math.sqrt(a * a + b * b);
        if (!k[i]) t[i] = t[i + 1] = 0;
        else if (h > 3) { t[i] = 3 * a * k[i] / h; t[i + 1] = 3 * b * k[i] / h; }
    }
    return pts.reduce((d, q, i) => {
        if (!i) return `M${f(q.x)} ${f(q.y)}`;
        const p = pts[i - 1], dx = (q.x - p.x) / 3;
        return `${d}C${f(p.x + dx)} ${f(p.y + t[i - 1] * dx)} ${f(q.x - dx)} ${f(q.y - t[i] * dx)} ${f(q.x)} ${f(q.y)}`;
    }, '');
}

function riskLineChart(options = {}) {
    const { id = 'chart', ghostPoints, threshold, riskBands, goodBands, nowHour, selectedHour, ariaLabel = '' } = options;
    const L = CHART_LAYOUT.line, W = CHART_LAYOUT.width, H = L.height, f = chartNum;
    const plotW = W - L.left - L.right, plotH = H - L.top - L.bottom, base = L.top + plotH, colW = plotW / 24;
    const isHour = h => Number.isInteger(h) && h >= 0 && h < 24;
    const xOf = hour => L.left + (hour + 0.5) * colW;
    const clean = list => (Array.isArray(list) ? list : []).filter(p => p && isHour(p.hour)).sort((a, b) => a.hour - b.hour);
    const main = clean(options.points);
    const yMax = options.yMax > 0 ? options.yMax : niceMax(Math.max(0, ...main.map(chartValue)));
    const yOf = v => L.top + scaleY(v, yMax, plotH);
    const toXY = list => list.map(p => ({ x: xOf(p.hour), y: yOf(chartValue(p)) }));
    const gid = `${chartEscape(id)}-area`;
    const band = cls => ([a, b]) => (isHour(a) && isHour(b) && b >= a ? chartRect(cls, L.left + a * colW, L.top, (b - a + 1) * colW, plotH) : '');

    let s = chartOpen(id, H, 24, ariaLabel)
        + `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">`
        + '<stop class="ch-area-0" offset="0"/><stop class="ch-area-1" offset="1"/></linearGradient></defs>'
        + (riskBands || []).map(band('ch-band-risk')).join('') + (goodBands || []).map(band('ch-band-good')).join('')
        + chartYAxis(L, yMax, plotH, formatPercent)
        + [0, 3, 6, 9, 12, 15, 18, 21].map(h => chartText(xOf(h), H - 6, chartPad(h), 'ch-label ch-x')).join('');

    if (threshold > 0 && threshold <= yMax) {
        s += chartLine('ch-threshold', L.left, yOf(threshold), W - L.right, yOf(threshold), ' stroke-dasharray="3 3"')
            + chartText(W - L.right, yOf(threshold) - 3, 'riesgo', 'ch-label ch-threshold-label', 'end');
    }
    const ghost = clean(ghostPoints);
    if (ghost.length) s += `<path class="ch-ghost" d="${chartMonotonePath(toXY(ghost))}" fill="none" stroke-width="1.5"/>`;

    const xy = toXY(main);
    if (xy.length) {
        const line = chartMonotonePath(xy);
        s += `<path class="ch-area" d="${line}L${f(xy[xy.length - 1].x)} ${base}L${f(xy[0].x)} ${base}Z" fill="url(#${gid})"/>`
            + `<path class="ch-line" d="${line}"/>`;
    }

    const hasNow = isHour(nowHour);
    if (hasNow) {
        s += chartLine('ch-now', xOf(nowHour), L.top, xOf(nowHour), base)
            + chartText(chartClamp(xOf(nowHour), L.left + 14, W - 16), L.top - 8, 'ahora', 'ch-label');
    }

    const selected = isHour(selectedHour) ? main.find(p => p.hour === selectedHour) : null;
    const peak = main.reduce((best, p) => (chartValue(p) > chartValue(best) ? p : best), null);
    if (peak) {
        const px = xOf(peak.hour), py = yOf(chartValue(peak)), label = formatPercent(chartValue(peak));
        // Etiqueta única: arriba del punto, o al lado si choca con "ahora".
        const beside = hasNow && Math.abs(xOf(nowHour) - px) < 24 && py < L.top + 12, left = px > W - 40;
        s += `<circle class="ch-peak" cx="${f(px)}" cy="${f(py)}" r="4" stroke-width="2"/>` + (selected ? '' : beside
            ? chartText(left ? px - 8 : px + 8, py + 4, label, 'ch-label ch-strong', left ? 'end' : 'start')
            : chartText(chartClamp(px, L.left + 12, W - 14), Math.max(py - 8, 12), label, 'ch-label ch-strong'));
    }

    if (selected) {
        const sx = xOf(selected.hour), value = chartValue(selected);
        const obs = Number.isFinite(+selected.observations) ? +selected.observations : 0;
        const detail = `${obs} ${obs === 1 ? 'observación' : 'observaciones'}`;
        s += chartLine('ch-cursor', sx, L.top, sx, base)
            + `<circle class="ch-dot" cx="${f(sx)}" cy="${f(yOf(value))}" r="3.5"/>`
            + chartTooltip(sx, L.top, [`${chartPad(selected.hour)}:00 · ${formatPercent(value)}`,
                selected.level ? `${selected.level} · ${detail}` : detail]);
    }
    return `${s}${chartHits(id, hitColumns(plotW, 24, L.left), H)}</svg>`;
}

function chartFormatValue(value, unit = '') {
    const rounded = Math.round(value * 10) / 10;
    return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',')) + unit;
}

function barChart(options = {}) {
    const { id = 'bars', selectedKey, unit = '', ariaLabel = '' } = options;
    const bars = Array.isArray(options.bars) ? options.bars : [];
    const B = CHART_LAYOUT.bar, W = CHART_LAYOUT.width, H = B.height, f = chartNum;
    const plotW = W - B.left - B.right, plotH = H - B.top - B.bottom, base = B.top + plotH;
    const yMax = options.yMax > 0 ? options.yMax : niceMax(Math.max(0, ...bars.map(chartValue)), { unitInterval: false });
    const columns = hitColumns(plotW, bars.length, B.left);
    const selectedIndex = bars.findIndex(b => selectedKey != null && b.key === selectedKey);
    const maxIndex = bars.reduce((best, b, i) => (chartValue(b) > chartValue(bars[best]) ? i : best), -1);
    const labelEvery = Math.max(1, Math.ceil(bars.length / 12));

    let s = chartOpen(id, H, bars.length, ariaLabel) + chartYAxis(B, yMax, plotH, v => chartFormatValue(v, unit));
    bars.forEach((bar, i) => {
        const x = columns[i].x + 1, w = Math.max(columns[i].width - 2, 1), cx = x + w / 2;
        const top = B.top + scaleY(chartValue(bar), yMax, plotH), r = Math.min(4, base - top, w / 2);
        if (base - top > 0) {
            s += `<path class="${selectedIndex >= 0 && i !== selectedIndex ? 'ch-bar ch-bar-dim' : 'ch-bar'}"`
                + ` d="M${f(x)} ${f(base)}V${f(top + r)}Q${f(x)} ${f(top)} ${f(x + r)} ${f(top)}`
                + `H${f(x + w - r)}Q${f(x + w)} ${f(top)} ${f(x + w)} ${f(top + r)}V${f(base)}Z"/>`;
        }
        if (i % labelEvery === 0 || i === selectedIndex) {
            s += chartText(cx, H - 6, bar.label, i === selectedIndex ? 'ch-label ch-x ch-strong' : 'ch-label ch-x');
        }
        if (i === (selectedIndex >= 0 ? selectedIndex : maxIndex)) s += chartText(cx, Math.max(top - 5, 12), chartFormatValue(chartValue(bar), unit), 'ch-label ch-value');
    });
    if (selectedIndex >= 0 && bars[selectedIndex].detail) {
        const c = columns[selectedIndex];
        s += chartTooltip(c.x + c.width / 2, B.top, [bars[selectedIndex].label, bars[selectedIndex].detail]);
    }
    return `${s}${chartHits(id, columns, H)}</svg>`;
}

function heatGrid(options = {}) {
    const { id = 'grid', rowLabels = [], colLabels = [], highlightRows = [], nowCell, selectedIndex, ariaLabel = '' } = options;
    const cells = Array.isArray(options.cells) ? options.cells : [];
    const G = CHART_LAYOUT.grid, W = CHART_LAYOUT.width, rowStep = G.rowH + G.gap;
    const rows = cells.length, cols = Math.max(0, colLabels.length, ...cells.map(r => r.length));
    const cellW = cols ? (W - G.left - G.right) / cols : 0, H = G.top + rows * rowStep + G.legend;
    const values = [].concat(...cells).filter(c => c && Number.isFinite(c.value)).map(c => c.value);
    const vMax = options.valueMax > 0 ? options.valueMax : niceMax(Math.max(0, ...values));
    const levelOf = v => (v == null || !Number.isFinite(v) ? 'none' : Math.round(v * 100) === 0 ? 0
        : chartClamp(Math.ceil((v / vMax) * CHART_HEAT_LEVELS - 1e-9), 1, CHART_HEAT_LEVELS));
    const cellX = c => G.left + c * cellW, rowY = r => G.top + r * rowStep;

    let s = chartOpen(id, H, rows * cols, ariaLabel)
        + colLabels.map((l, c) => (l ? chartText(cellX(c + 0.5), G.top - 5, l, 'ch-label ch-x') : '')).join('');
    cells.forEach((row, r) => {
        s += chartText(G.left - 4, rowY(r) + G.rowH - 4, rowLabels[r],
            highlightRows.includes(r) ? 'ch-label ch-row ch-strong' : 'ch-label ch-row', 'end');
        row.forEach((cell, c) => {
            s += chartRect(`ch-heat ch-heat-${levelOf(cell && cell.value)}`, cellX(c) + 1, rowY(r), Math.max(cellW - 2, 1), G.rowH,
                ` rx="2" data-chart="${chartEscape(id)}" data-index="${r * cols + c}"`);
        });
    });
    if (nowCell && nowCell.row < rows && nowCell.col < cols) {
        s += chartRect('ch-now-cell', cellX(nowCell.col) + 0.5, rowY(nowCell.row) - 0.5, Math.max(cellW - 1, 1), G.rowH + 1, ' rx="2"');
    }

    // Leyenda: sin datos · 0 % · rampa de un solo tono hasta el tope.
    const ly = rowY(rows) + 12, lx = G.left + 120;
    const swatch = (x, level) => chartRect(`ch-swatch ch-heat-${level}`, x, ly, 10, 10, ' rx="2"');
    s += `<g class="ch-legend">${swatch(G.left, 'none')}${chartText(G.left + 14, ly + 9, 'Sin datos', 'ch-label', 'start')}`
        + `${swatch(G.left + 76, 0)}${chartText(G.left + 90, ly + 9, '0 %', 'ch-label', 'start')}`;
    for (let level = 1; level <= CHART_HEAT_LEVELS; level++) s += swatch(lx + (level - 1) * 12, level);
    s += `${chartText(lx + CHART_HEAT_LEVELS * 12 + 2, ly + 9, formatPercent(vMax), 'ch-label', 'start')}</g>`;

    const r = Math.floor(selectedIndex / cols), c = selectedIndex % cols;
    const cell = Number.isInteger(selectedIndex) && cols && cells[r] ? cells[r][c] : null;
    if (cell) {
        s += chartRect('ch-cursor-cell', cellX(c), rowY(r) - 1, cellW, G.rowH + 2, ' rx="2"')
            + chartTooltip(cellX(c + 0.5), r < rows / 2 ? rowY(r + 1) + 2 : rowY(r) - 40, [cell.label]);
    }
    return `${s}</svg>`;
}

function statTile({ label, value, sublabel, trend } = {}) {
    const e = chartEscape, arrows = { up: '▲', down: '▼', flat: '▬' };
    const dir = trend && arrows[trend.direction] ? trend.direction : 'flat';
    return `<div class="stat-tile"><div class="slb">${e(label)}</div><div class="stat-value">${e(value)}</div>`
        + (sublabel ? `<div class="ssub">${e(sublabel)}</div>` : '')
        + (trend && trend.text ? `<div class="stat-trend stat-trend-${dir}"><span aria-hidden="true">${arrows[dir]}</span> ${e(trend.text)}</div>` : '')
        + '</div>';
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        riskLineChart, barChart, heatGrid, statTile,
        scaleY, niceMax, formatPercent, hitColumns, CHART_LAYOUT,
    };
}
