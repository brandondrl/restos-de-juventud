// Mina 3: con el navegador en UTC, la marca de "ahora" debe seguir la hora de Caracas.
// Dentro de jest, cambiar process.env.TZ no cambia la zona del proceso; por eso el cálculo
// corre en un proceso hijo lanzado con TZ=UTC.
const { execFileSync } = require('child_process');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public').replace(/\\/g, '/');

const SCRIPT = `
require('${PUBLIC_DIR}/timezone.js');
const { riskLineChart, CHART_LAYOUT } = require('${PUBLIC_DIR}/charts.js');
const { buildRiskCurveProps, buildWeeklyHeatGridProps } = require('${PUBLIC_DIR}/chart-data.js');
const heatmap = {};
for (let day = 0; day < 7; day++) {
  for (let hour = 0; hour < 24; hour++) heatmap[day + '_' + hour] = { probability: 0, confidence: 1, observations: 4 };
}
heatmap['0_21'] = { probability: 0.4, confidence: 1, startHits: 1, observations: 4 };
const now = new Date('2026-06-15T02:30:00Z'); // lunes 02:30 UTC = domingo 14, 22:30 VET
const props = buildRiskCurveProps({ id: 'hoy', heatmap, now });
const svg = riskLineChart(props);
const grid = buildWeeklyHeatGridProps({ id: 'semana', heatmap, now });
process.stdout.write(JSON.stringify({
  resolvedTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  browserHour: now.getHours(),
  browserDay: now.getDay(),
  nowHour: props.nowHour,
  value21: props.points[21].value,
  riskBands: props.riskBands,
  nowX: parseFloat(svg.match(/class="ch-now"[^>]*x1="([\\d.]+)"/)[1]),
  layout: CHART_LAYOUT.line,
  width: CHART_LAYOUT.width,
  highlightRows: grid.highlightRows,
  nowCell: grid.nowCell,
}));
`;

const result = JSON.parse(execFileSync(process.execPath, ['-e', SCRIPT], {
  env: { ...process.env, TZ: 'UTC' },
  encoding: 'utf8',
}));

test('el proceso hijo corre de verdad en UTC (getHours da la hora UTC)', () => {
  expect(['UTC', 'Etc/UTC']).toContain(result.resolvedTz);
  expect(result.browserHour).toBe(2);
  expect(result.browserDay).toBe(1);
});

test('nowHour usa la hora VET, no la del navegador', () => {
  expect(result.nowHour).toBe(22);
  // El día también es el VET (domingo): el pico de 40 % a las 21:00 es de "hoy".
  expect(result.value21).toBeCloseTo(0.4);
  expect(result.riskBands).toEqual([[21, 21]]);
});

test('la línea de "ahora" del SVG cae en la columna de las 22:00 VET', () => {
  const { left, right } = result.layout;
  const colW = (result.width - left - right) / 24;
  expect(result.nowX).toBeCloseTo(left + 22.5 * colW, 1);
});

test('heatmap semanal: fila y celda de "ahora" en VET', () => {
  expect(result.highlightRows).toEqual([0]);
  expect(result.nowCell).toEqual({ row: 0, col: 22 });
});
