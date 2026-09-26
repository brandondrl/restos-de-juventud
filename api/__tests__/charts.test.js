process.env.TZ = 'America/Caracas';

const fs = require('fs');
const path = require('path');
const charts = require('../../public/charts.js');

const {
  riskLineChart, barChart, heatGrid, statTile,
  scaleY, niceMax, formatPercent, hitColumns, CHART_LAYOUT,
} = charts;

const L = CHART_LAYOUT.line;
const PLOT_W = CHART_LAYOUT.width - L.left - L.right;
const PLOT_H = L.height - L.top - L.bottom;
const COL_W = PLOT_W / 24;

function series(valuesByHour = {}, observations = 4) {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour, value: valuesByHour[hour] || 0, observations, level: valuesByHour[hour] ? 'Alto' : 'Sin riesgo',
  }));
}

function attr(svg, selector, name) {
  const match = svg.match(new RegExp(`<[^>]*class="${selector}"[^>]*>`));
  if (!match) return null;
  const value = match[0].match(new RegExp(`\\s${name}="([^"]*)"`));
  return value ? value[1] : null;
}

function allTags(svg, className) {
  return svg.match(new RegExp(`<[^>]*class="${className}"[^>]*>`, 'g')) || [];
}

function peakY(svg) {
  return parseFloat(attr(svg, 'ch-peak', 'cy'));
}

describe('helpers', () => {
  test('niceMax: piso de 0,30 para máximos pequeños', () => {
    expect(niceMax(0)).toBe(0.3);
    expect(niceMax(0.05)).toBe(0.3);
    expect(niceMax(0.15)).toBe(0.3);
    expect(niceMax(0.3)).toBe(0.3);
  });

  test('niceMax: pasos de 0,10 hacia arriba y tope 1,0', () => {
    expect(niceMax(0.301)).toBe(0.4);
    expect(niceMax(0.42)).toBe(0.5);
    expect(niceMax(0.8)).toBe(0.8);
    expect(niceMax(0.81)).toBe(0.9);
    expect(niceMax(0.3 + 0.1 + 0.1)).toBe(0.5); // 0.5000000000000001 no sube a 0.6
    expect(niceMax(1.4)).toBe(1);
  });

  test('niceMax: entradas inválidas caen al piso', () => {
    expect(niceMax(NaN)).toBe(0.3);
    expect(niceMax(-2)).toBe(0.3);
    expect(niceMax(undefined)).toBe(0.3);
  });

  test('niceMax genérico (barras): 1-2-2,5-5-10 desde 0', () => {
    const generic = v => niceMax(v, { unitInterval: false });
    expect(generic(0)).toBe(1);
    expect(generic(7)).toBe(10);
    expect(generic(12)).toBe(20);
    expect(generic(2.2)).toBe(2.5);
    expect(generic(130)).toBe(200);
    expect(generic(50)).toBe(50);
  });

  test('scaleY: 0 abajo, yMax arriba, recorta fuera de rango y nunca NaN', () => {
    expect(scaleY(0, 0.5, 100)).toBe(100);
    expect(scaleY(0.5, 0.5, 100)).toBe(0);
    expect(scaleY(0.25, 0.5, 100)).toBe(50);
    expect(scaleY(2, 0.5, 100)).toBe(0);
    expect(scaleY(-1, 0.5, 100)).toBe(100);
    expect(scaleY(NaN, 0.5, 100)).toBe(100);
    expect(scaleY(0.2, 0, 100)).toBe(100);
  });

  test('formatPercent', () => {
    expect(formatPercent(0.42)).toBe('42 %');
    expect(formatPercent(0.004)).toBe('0 %');
    expect(formatPercent(1)).toBe('100 %');
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(NaN)).toBe('—');
  });

  test('hitColumns: n columnas uniformes y contiguas que cubren el ancho', () => {
    const columns = hitColumns(240, 24, 30);
    expect(columns).toHaveLength(24);
    columns.forEach((c, i) => {
      expect(c.width).toBeCloseTo(10);
      expect(c.x).toBeCloseTo(30 + i * 10);
    });
    expect(columns[23].x + columns[23].width).toBeCloseTo(270);
    expect(hitColumns(240, 0)).toEqual([]);
  });
});

describe('riskLineChart — escala y geometría', () => {
  test('escala fija: pico 0,15 y 0,80 con el mismo yMax dan alturas proporcionales', () => {
    const low = riskLineChart({ id: 'a', points: series({ 14: 0.15 }), yMax: 0.8 });
    const high = riskLineChart({ id: 'b', points: series({ 14: 0.8 }), yMax: 0.8 });
    const base = L.top + PLOT_H;
    const lowHeight = base - peakY(low);
    const highHeight = base - peakY(high);
    expect(highHeight).toBeCloseTo(PLOT_H, 0);
    expect(lowHeight / highHeight).toBeCloseTo(0.15 / 0.8, 2);
  });

  test('no normaliza al máximo del día: un pico de 15 % no llega arriba', () => {
    const svg = riskLineChart({ id: 'a', points: series({ 10: 0.15 }), yMax: niceMax(0.15) });
    expect(peakY(svg)).toBeCloseTo(L.top + scaleY(0.15, 0.3, PLOT_H), 1);
    expect(peakY(svg)).toBeGreaterThan(L.top + PLOT_H * 0.4);
  });

  test('viewBox fijo, xMidYMid meet, nunca "none"', () => {
    const svg = riskLineChart({ id: 'a', points: series() });
    expect(svg).toContain(`viewBox="0 0 ${CHART_LAYOUT.width} ${L.height}"`);
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(svg).not.toMatch(/preserveAspectRatio="none"/);
  });

  test('márgenes y tamaño de texto mínimos', () => {
    expect(L.left).toBeGreaterThanOrEqual(28);
    expect(L.bottom).toBeGreaterThanOrEqual(20);
    expect(L.top).toBeGreaterThanOrEqual(12);
    const svg = riskLineChart({ id: 'a', points: series({ 3: 0.4 }), threshold: 0.13, nowHour: 5, selectedHour: 3 });
    const sizes = [...svg.matchAll(/font-size="([\d.]+)"/g)].map(m => +m[1]);
    expect(sizes.length).toBeGreaterThan(0);
    sizes.forEach(size => expect(size).toBeGreaterThanOrEqual(10));
    // A 360 px el contenido de la tarjeta mide ~294 px: el texto efectivo sigue ≥ 10 px.
    expect(Math.min(...sizes) * 294 / CHART_LAYOUT.width).toBeGreaterThanOrEqual(10);
  });

  test('etiquetas: 3 en Y (0 %, mitad, yMax) y 8 en X', () => {
    const svg = riskLineChart({ id: 'a', points: series(), yMax: 0.4 });
    const yLabels = allTags(svg, 'ch-label ch-y').length;
    expect(yLabels).toBe(3);
    expect(svg).toMatch(/>0 %</);
    expect(svg).toMatch(/>20 %</);
    expect(svg).toMatch(/>40 %</);
    ['00', '03', '06', '09', '12', '15', '18', '21'].forEach(h => expect(svg).toContain(`>${h}<`));
    expect(allTags(svg, 'ch-label ch-x')).toHaveLength(8);
  });

  test('umbral: línea punteada en la coordenada correcta con etiqueta "riesgo"', () => {
    const svg = riskLineChart({ id: 'a', points: series(), yMax: 0.4, threshold: 0.13 });
    const y = parseFloat(attr(svg, 'ch-threshold', 'y1'));
    expect(y).toBeCloseTo(L.top + scaleY(0.13, 0.4, PLOT_H), 1);
    expect(attr(svg, 'ch-threshold', 'stroke-dasharray')).toBeTruthy();
    expect(svg).toMatch(/class="ch-label ch-threshold-label"[^>]*>riesgo</);
  });

  test('cuadrícula horizontal sólida, sin líneas verticales ni punteados salvo el umbral', () => {
    const svg = riskLineChart({ id: 'a', points: series(), threshold: 0.13 });
    const grid = allTags(svg, 'ch-grid');
    expect(grid).toHaveLength(3);
    grid.forEach(line => {
      const [, y1] = line.match(/y1="([\d.]+)"/);
      const [, y2] = line.match(/y2="([\d.]+)"/);
      expect(y1).toBe(y2);
      expect(line).not.toContain('dasharray');
    });
    expect((svg.match(/stroke-dasharray/g) || []).length).toBe(1);
  });

  test('bandas de riesgo alineadas a las columnas de hora y detrás de la curva', () => {
    const svg = riskLineChart({ id: 'a', points: series({ 13: 0.3 }), riskBands: [[13, 15], [20, 20]] });
    const bands = allTags(svg, 'ch-band-risk');
    expect(bands).toHaveLength(2);
    const x = parseFloat(bands[0].match(/x="([\d.]+)"/)[1]);
    const width = parseFloat(bands[0].match(/width="([\d.]+)"/)[1]);
    expect(x).toBeCloseTo(L.left + 13 * COL_W, 1);
    expect(width).toBeCloseTo(3 * COL_W, 1);
    expect(parseFloat(bands[1].match(/width="([\d.]+)"/)[1])).toBeCloseTo(COL_W, 1);
    expect(svg.indexOf('ch-band-risk')).toBeLessThan(svg.indexOf('class="ch-line"'));
    expect(svg.indexOf('ch-band-risk')).toBeLessThan(svg.indexOf('class="ch-area"'));
  });

  test('bandas buenas (2.9) con su propia clase', () => {
    const svg = riskLineChart({ id: 'a', points: series(), goodBands: [[16, 20]] });
    expect(allTags(svg, 'ch-band-good')).toHaveLength(1);
    expect(allTags(svg, 'ch-band-risk')).toHaveLength(0);
  });

  test('tramos monotónicos: ningún punto de control se sale del rango del tramo', () => {
    const values = { 5: 0.05, 6: 0.4, 7: 0.1, 8: 0.35, 9: 0.36, 10: 0, 11: 0.5 };
    const svg = riskLineChart({ id: 'a', points: series(values), yMax: 0.5 });
    const d = attr(svg, 'ch-line', 'd');
    expect(d).not.toMatch(/[QT]/);
    const numbers = d.replace(/[MC]/g, ' ').trim().split(/[\s,]+/).map(Number);
    let [, prevY] = numbers;
    for (let i = 2; i < numbers.length; i += 6) {
      const c1y = numbers[i + 1], c2y = numbers[i + 3], y = numbers[i + 5];
      const lo = Math.min(prevY, y) - 0.11, hi = Math.max(prevY, y) + 0.11;
      [c1y, c2y].forEach(c => { expect(c).toBeGreaterThanOrEqual(lo); expect(c).toBeLessThanOrEqual(hi); });
      prevY = y;
    }
  });

  test('columnas táctiles: 24 rectángulos de alto total con data-chart y data-index', () => {
    const svg = riskLineChart({ id: 'hoy', points: series() });
    const hits = allTags(svg, 'ch-hit');
    expect(hits).toHaveLength(24);
    hits.forEach((rect, i) => {
      expect(rect).toContain('data-chart="hoy"');
      expect(rect).toContain(`data-index="${i}"`);
      expect(rect).toContain(`height="${L.height}"`);
      expect(rect).toContain('y="0"');
      expect(parseFloat(rect.match(/width="([\d.]+)"/)[1])).toBeCloseTo(COL_W, 1);
    });
  });
});

describe('riskLineChart — marcas', () => {
  test('tooltip solo con selectedHour: hora, %, nivel y observaciones', () => {
    const points = series({ 14: 0.42 }, 12);
    expect(riskLineChart({ id: 'a', points })).not.toContain('ch-tooltip');
    const svg = riskLineChart({ id: 'a', points, selectedHour: 14 });
    expect(svg).toContain('ch-tooltip');
    expect(svg).toContain('14:00');
    expect(svg).toContain('42 %');
    expect(svg).toContain('Alto');
    expect(svg).toContain('12 observaciones');
  });

  test('tooltip: "1 observación" en singular', () => {
    const svg = riskLineChart({ id: 'a', points: series({}, 1), selectedHour: 3 });
    expect(svg).toContain('1 observación<');
  });

  test('tooltip no se sale por los bordes (horas 0 y 23)', () => {
    [0, 23].forEach(hour => {
      const svg = riskLineChart({ id: 'a', points: series({ [hour]: 0.9 }, 30), selectedHour: hour });
      const box = svg.match(/<rect class="ch-tooltip"[^>]*>/)[0];
      const x = parseFloat(box.match(/x="([\d.-]+)"/)[1]);
      const width = parseFloat(box.match(/width="([\d.]+)"/)[1]);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(CHART_LAYOUT.width);
    });
  });

  test('serie fantasma: trazo propio y sin área', () => {
    const svg = riskLineChart({ id: 'a', points: series({ 9: 0.2 }), ghostPoints: series({ 18: 0.3 }) });
    expect(allTags(svg, 'ch-ghost')).toHaveLength(1);
    expect(allTags(svg, 'ch-area')).toHaveLength(1);
    expect(attr(svg, 'ch-ghost', 'fill')).toBe('none');
    expect(attr(svg, 'ch-ghost', 'stroke-width')).toBe('1.5');
  });

  test('pico: un solo punto de 8 px con anillo y una sola etiqueta de %', () => {
    const svg = riskLineChart({ id: 'a', points: series({ 8: 0.1, 14: 0.35, 15: 0.3 }), yMax: 0.4 });
    expect(allTags(svg, 'ch-peak')).toHaveLength(1);
    expect(attr(svg, 'ch-peak', 'r')).toBe('4');
    expect(attr(svg, 'ch-peak', 'stroke-width')).toBe('2');
    expect(parseFloat(attr(svg, 'ch-peak', 'cx'))).toBeCloseTo(L.left + 14.5 * COL_W, 1);
    const percentLabels = svg.match(/>\d+ %</g).filter(t => !['>0 %<', '>20 %<', '>40 %<'].includes(t));
    expect(percentLabels).toEqual(['>35 %<']);
  });

  test('marca de "ahora" en la columna de nowHour; ausente sin nowHour', () => {
    const svg = riskLineChart({ id: 'a', points: series(), nowHour: 22 });
    expect(parseFloat(attr(svg, 'ch-now', 'x1'))).toBeCloseTo(L.left + 22.5 * COL_W, 1);
    expect(svg).toMatch(/>ahora</);
    const without = riskLineChart({ id: 'a', points: series() });
    expect(without).not.toContain('ch-now');
    expect(without).not.toMatch(/>ahora</);
  });

  test('sin NaN con series vacías, todo cero o sin yMax', () => {
    const variants = [
      riskLineChart({ id: 'a', points: [] }),
      riskLineChart({ id: 'a' }),
      riskLineChart({ id: 'a', points: series(), threshold: 0.13, riskBands: [], nowHour: 0, selectedHour: 0 }),
      riskLineChart({ id: 'a', points: series(), ghostPoints: [], yMax: 0 }),
    ];
    variants.forEach(svg => {
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      expect(svg).toContain('<svg');
    });
    expect(variants[2]).not.toContain('ch-peak');
  });

  test('ids de <defs> prefijados con el id de la gráfica; dos gráficas no comparten ids', () => {
    const a = riskLineChart({ id: 'hoy', points: series({ 3: 0.2 }) });
    const b = riskLineChart({ id: 'manana', points: series({ 3: 0.2 }) });
    const idsA = [...a.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    const idsB = [...b.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    expect(idsA.length).toBeGreaterThan(0);
    idsA.forEach(id => expect(id.startsWith('hoy-')).toBe(true));
    idsB.forEach(id => expect(id.startsWith('manana-')).toBe(true));
    expect(idsA.filter(id => idsB.includes(id))).toEqual([]);
    [...a.matchAll(/url\(#([^)]+)\)/g)].forEach(m => expect(idsA).toContain(m[1]));
  });

  test('accesibilidad y táctil: role, aria-label escapado, tabindex y pan-y', () => {
    const svg = riskLineChart({ id: 'a', points: series(), ariaLabel: 'Pico "42 %" <hoy>' });
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Pico &quot;42 %&quot; &lt;hoy&gt;"');
    expect(svg).toContain('tabindex="0"');
    expect(svg).toContain('touch-action:pan-y');
    expect(svg).toContain('data-chart-root="a"');
    expect(svg).toContain('data-count="24"');
  });
});

describe('barChart', () => {
  const bars = [
    { key: '2026-07', label: 'Jul', value: 12, detail: '12 h · 5 cortes' },
    { key: '2026-08', label: 'Ago', value: 37, detail: '37 h · 14 cortes' },
    { key: '2026-09', label: 'Sep', value: 20, detail: '20 h · 8 cortes' },
  ];

  test('barras de ancho uniforme con 2 px de separación, esquinas redondeadas y eje desde 0', () => {
    const svg = barChart({ id: 'mes', bars, unit: ' h' });
    const paths = allTags(svg, 'ch-bar');
    expect(paths).toHaveLength(3);
    const lefts = paths.map(p => parseFloat(p.match(/d="M([\d.]+)/)[1]));
    const widths = paths.map(p => {
      const d = p.match(/d="([^"]+)"/)[1];
      const xs = [...d.matchAll(/H([\d.]+)/g)].map(m => +m[1]);
      return xs[0] + 4 - parseFloat(d.slice(1));
    });
    widths.forEach(w => expect(w).toBeCloseTo(widths[0], 1));
    expect(lefts[1] - (lefts[0] + widths[0])).toBeCloseTo(2, 1);
    paths.forEach(p => expect(p).toMatch(/Q/));
    expect(svg).toMatch(/>0 h</);
    expect(svg).toMatch(/>50 h</); // niceMax genérico de 37
  });

  test('etiqueta de valor solo en la máxima, o en la seleccionada si hay selección', () => {
    const plain = barChart({ id: 'mes', bars, unit: ' h' });
    expect(allTags(plain, 'ch-label ch-value')).toHaveLength(1);
    expect(plain).toMatch(/class="ch-label ch-value"[^>]*>37 h</);
    const selected = barChart({ id: 'mes', bars, unit: ' h', selectedKey: '2026-07' });
    expect(allTags(selected, 'ch-label ch-value')).toHaveLength(1);
    expect(selected).toMatch(/class="ch-label ch-value"[^>]*>12 h</);
    expect(selected).toContain('12 h · 5 cortes');
  });

  test('sin NaN con barras vacías o en cero, y columnas táctiles por barra', () => {
    [barChart({ id: 'x', bars: [] }), barChart({ id: 'x', bars: [{ key: 'a', label: 'A', value: 0 }] })]
      .forEach(svg => expect(svg).not.toMatch(/NaN|undefined|Infinity/));
    const svg = barChart({ id: 'mes', bars });
    expect(allTags(svg, 'ch-hit')).toHaveLength(3);
    expect(svg).toContain('data-count="3"');
  });
});

describe('heatGrid', () => {
  const cells = [
    [{ value: null, label: 'Lun 00:00 · sin datos' }, { value: 0, label: 'Lun 01:00 · 0 %' }, { value: 0.1, label: 'Lun 02:00 · 10 %' }],
    [{ value: 0.3, label: 'Mar 00:00 · 30 %' }, { value: 0.05, label: 'Mar 01:00 · 5 %' }, { value: null, label: 'Mar 02:00 · sin datos' }],
  ];

  test('celdas sin datos se distinguen de 0 %', () => {
    const svg = heatGrid({ id: 'hm', rowLabels: ['Lun', 'Mar'], colLabels: ['00', '', ''], cells });
    expect(allTags(svg, 'ch-heat ch-heat-none')).toHaveLength(2);
    expect(allTags(svg, 'ch-heat ch-heat-0')).toHaveLength(1);
    expect(svg).not.toMatch(/NaN|undefined/);
  });

  test('escala secuencial de un solo tono: más valor → nivel más intenso', () => {
    const svg = heatGrid({ id: 'hm', rowLabels: ['Lun', 'Mar'], colLabels: [], cells, valueMax: 0.3 });
    const levelOf = index => {
      const tag = svg.match(new RegExp(`<rect class="ch-heat ch-heat-(\\d)"[^>]*data-index="${index}"`));
      return +tag[1];
    };
    expect(levelOf(4)).toBeLessThan(levelOf(2));  // 5 % < 10 %
    expect(levelOf(2)).toBeLessThan(levelOf(3));  // 10 % < 30 %
    expect(levelOf(3)).toBe(5);
  });

  test('leyenda de escala siempre visible con "Sin datos" y "0 %"', () => {
    const svg = heatGrid({ id: 'hm', rowLabels: ['Lun', 'Mar'], colLabels: [], cells });
    expect(svg).toContain('ch-legend');
    expect(svg).toMatch(/>Sin datos</);
    expect(svg).toMatch(/>0 %</);
    const empty = heatGrid({ id: 'hm', rowLabels: [], colLabels: [], cells: [] });
    expect(empty).toContain('ch-legend');
    expect(empty).not.toMatch(/NaN|undefined|Infinity/);
  });

  test('fila resaltada, celda de "ahora" y tooltip de la celda seleccionada', () => {
    const svg = heatGrid({
      id: 'hm', rowLabels: ['Lun', 'Mar'], colLabels: [], cells,
      highlightRows: [1], nowCell: { row: 1, col: 2 }, selectedIndex: 3,
    });
    expect(svg).toMatch(/class="ch-label ch-row ch-strong"[^>]*>Mar</);
    expect(allTags(svg, 'ch-now-cell')).toHaveLength(1);
    expect(svg).toContain('Mar 00:00 · 30 %');
    expect(heatGrid({ id: 'hm', rowLabels: [], colLabels: [], cells })).not.toContain('ch-tooltip');
  });
});

describe('statTile', () => {
  test('valor, subetiqueta y tendencia con flecha y texto, escapados', () => {
    const html = statTile({ label: 'Tendencia <30 d>', value: '12 h', sublabel: 'vs. 30 d previos', trend: { direction: 'down', text: '−20 %' } });
    expect(html).toContain('Tendencia &lt;30 d&gt;');
    expect(html).toContain('12 h');
    expect(html).toContain('vs. 30 d previos');
    expect(html).toContain('stat-trend-down');
    expect(html).toContain('−20 %');
    expect(statTile({ label: 'A', value: 1 })).not.toContain('stat-trend');
  });
});

describe('restricciones del módulo', () => {
  // Se mide con saltos LF (como queda en el repo), aunque el checkout local use CRLF.
  const source = fs.readFileSync(path.join(__dirname, '../../public/charts.js'), 'utf8').replace(/\r\n/g, '\n');

  test('charts.js pesa ≤ 15 KB sin minificar', () => {
    expect(Buffer.byteLength(source, 'utf8')).toBeLessThanOrEqual(15 * 1024);
  });

  test('sin colores hex sueltos, sin DOM ni estado global', () => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b(document|window|localStorage|fetch|appState)\b/);
  });

  test('las clases de color usadas existen en style.css y usan variables', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../public/style.css'), 'utf8');
    ['ch-line', 'ch-area-0', 'ch-ghost', 'ch-grid', 'ch-threshold', 'ch-band-risk', 'ch-band-good',
      'ch-now', 'ch-peak', 'ch-label', 'ch-tooltip', 'ch-bar', 'ch-heat-none', 'ch-heat-0', 'ch-heat-5']
      .forEach(cls => expect(css).toMatch(new RegExp(`\\.${cls}[,{][^}]*var\\(--`)));
    expect(css).toMatch(/prefers-reduced-motion/);
  });
});

describe('rendimiento', () => {
  function medianMs(fn, runs = 60) {
    for (let i = 0; i < 20; i++) fn();
    const times = [];
    for (let i = 0; i < runs; i++) {
      const t0 = process.hrtime.bigint();
      fn();
      times.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)];
  }

  test('riskLineChart de 24 puntos < 2 ms', () => {
    const values = Object.fromEntries(Array.from({ length: 24 }, (_, h) => [h, (h * 7 % 11) / 20]));
    const ms = medianMs(() => riskLineChart({
      id: 'p', points: series(values), ghostPoints: series(values), threshold: 0.13,
      riskBands: [[6, 8], [14, 17]], nowHour: 12, selectedHour: 15, ariaLabel: 'x',
    }));
    expect(ms).toBeLessThan(2);
  });

  test('heatGrid 7×24 < 5 ms', () => {
    const cells = Array.from({ length: 7 }, (_, r) => Array.from({ length: 24 }, (_, c) => ({
      value: (r + c) % 5 === 0 ? null : ((r * c) % 9) / 20, label: `${r} ${c}`,
    })));
    const ms = medianMs(() => heatGrid({
      id: 'h', rowLabels: ['D', 'L', 'M', 'X', 'J', 'V', 'S'], colLabels: Array(24).fill('00'),
      cells, highlightRows: [2], nowCell: { row: 2, col: 9 }, selectedIndex: 40,
    }));
    expect(ms).toBeLessThan(5);
  });
});
