process.env.TZ = 'America/Caracas';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  parseArgs, parseCsvRows, parseExportCsv, loadInput, runBacktest, formatReport,
} = require('../../scripts/backtest.js');

const ROOT = path.join(__dirname, '..', '..');
const FIXTURE_B = path.join(__dirname, 'fixtures', 'b-seis-semanas.json');
const HEADER = 'Inicio,Fin,Duración (min),Tipo,Notas';

describe('parseCsvRows', () => {
  it('respeta comillas, comas, comillas escapadas y saltos de línea dentro de un campo', () => {
    const rows = parseCsvRows('a,b\r\n"x, y","dijo ""hola""\nadiós"\n');
    expect(rows).toEqual([['a', 'b'], ['x, y', 'dijo "hola"\nadiós']]);
  });

  it('ignora el BOM y las líneas vacías', () => {
    expect(parseCsvRows('﻿a,b\n\n1,2\n\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('parseExportCsv', () => {
  it('lee el formato de api/export.js (fechas estilo Date#toString) y lo pasa a ISO', () => {
    const csv = [
      HEADER,
      '"Fri Sep 25 2026 22:27:34 GMT+0000 (Coordinated Universal Time)","Fri Sep 25 2026 22:27:34 GMT+0000 (Coordinated Universal Time)","0","fluctuacion",""',
      '"Wed May 20 2026 23:49:00 GMT+0000 (Coordinated Universal Time)","Thu May 21 2026 04:39:00 GMT+0000 (Coordinated Universal Time)","290","corte","nota, con coma"',
    ].join('\n');
    const { outages, skipped } = parseExportCsv(csv);
    expect(skipped).toBe(0);
    expect(outages).toEqual([
      { id: 'csv-0', start: '2026-09-25T22:27:34.000Z', end: '2026-09-25T22:27:34.000Z', duration_minutes: 0, type: 'fluctuacion' },
      { id: 'csv-1', start: '2026-05-20T23:49:00.000Z', end: '2026-05-21T04:39:00.000Z', duration_minutes: 290, type: 'corte' },
    ]);
  });

  it('acepta fechas ISO y cuenta las filas con fechas inválidas', () => {
    const csv = `${HEADER}\n"2026-05-20T10:00:00.000Z","2026-05-20T11:00:00.000Z","60","corte",""\n"no es fecha","","0","corte",""`;
    const { outages, skipped } = parseExportCsv(csv);
    expect(outages).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it('rechaza un CSV que no es la exportación de la app', () => {
    expect(() => parseExportCsv('foo,bar\n1,2')).toThrow(/encabezado/);
  });
});

describe('parseArgs', () => {
  it('usa los parámetros actuales del motor por defecto', () => {
    expect(parseArgs(['--input', 'x.csv'])).toMatchObject({
      input: 'x.csv', window: 84, threshold: 0.13, mode: 'fixed84', halfLife: null, json: false,
    });
  });

  it('lee --window, --threshold, --mode, --half-life, --from y --to', () => {
    const args = parseArgs(['--input', 'x.csv', '--window', '42', '--threshold', '0.16', '--mode', 'fixed84',
      '--half-life', '21', '--from', '2026-06-01', '--to', '2026-06-30', '--json']);
    expect(args).toMatchObject({ window: 42, threshold: 0.16, halfLife: 21, from: '2026-06-01', to: '2026-06-30', json: true });
  });

  it.each([
    [[], /--input/],
    [['--input', 'x', '--mode', 'decay'], /2\.5/],
    [['--input', 'x', '--mode', 'otro'], /--mode/],
    [['--input', 'x', '--threshold', '1.5'], /--threshold/],
    [['--input', 'x', '--window', '0'], /--window/],
    [['--input', 'x', '--from', '01/06/2026'], /--from/],
    [['--input', 'x', '--foo'], /desconocida/],
    [['--input'], /Falta el valor/],
  ])('rechaza %j', (argv, message) => {
    expect(() => parseArgs(argv)).toThrow(message);
  });
});

describe('ejecución', () => {
  it('loadInput lee un fixture JSON con su fecha de referencia', () => {
    const { outages, now } = loadInput(FIXTURE_B);
    expect(outages).toHaveLength(12);
    expect(now).toBe('2026-02-16T12:00:00.000Z');
  });

  it('runBacktest devuelve las 4 métricas y solo agregados (sin eventos crudos)', () => {
    const report = runBacktest(parseArgs(['--input', FIXTURE_B, '--from', '2026-02-09', '--to', '2026-02-15']));
    expect(Object.keys(report.metrics)).toEqual(['hitRate', 'falseAlarmRate', 'brier', 'timingMarginMin']);
    expect(report.period).toEqual({ from: '2026-02-09', to: '2026-02-15', days: 7 });
    // Lunes 9 y jueves 12 tuvieron corte en su ventana; el resto sin ventanas ni cortes.
    expect(report.extra.verdicts).toEqual({ hit: 2, false_alarm: 0, missed: 0, quiet: 5 });
    expect(report.metrics.hitRate).toBe(1);
    expect(JSON.stringify(report)).not.toMatch(/"start"|b-lun|b-jue/);
    expect(formatReport(report)).toMatch(/hitRate[\s\S]*falseAlarmRate[\s\S]*brier[\s\S]*timingMarginMin/);
  });

  it('node scripts/backtest.js --input <csv> imprime las 4 métricas', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rdj-backtest-'));
    const csvPath = path.join(dir, 'historial.csv');
    const { outages } = loadInput(FIXTURE_B);
    const lines = outages.map(o => `"${new Date(o.start)}","${new Date(o.end)}","${o.duration_minutes}","corte",""`);
    fs.writeFileSync(csvPath, [HEADER, ...lines].join('\n'));
    try {
      const output = execFileSync(process.execPath,
        [path.join(ROOT, 'scripts', 'backtest.js'), '--input', csvPath, '--from', '2026-02-09', '--to', '2026-02-12'],
        { encoding: 'utf8', env: { ...process.env, TZ: 'UTC' } });
      ['hitRate', 'falseAlarmRate', 'brier', 'timingMarginMin'].forEach(metric => {
        expect(output).toMatch(new RegExp(`^${metric}\\s+\\S`, 'm'));
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
