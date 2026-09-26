#!/usr/bin/env node
// Backtest walk-forward del motor de predicción.
//
// Uso:
//   node scripts/backtest.js --input scripts/data/historial.csv
//   node scripts/backtest.js --input api/__tests__/fixtures/c-cambio-patron.json --threshold 0.16
//
// Opciones:
//   --input <ruta>      CSV exportado desde la app (api/export.js) o fixture JSON (obligatorio)
//   --window <días>     ventana del heatmap (por defecto 84)
//   --threshold <p>     umbral de riesgo (por defecto RISK_THRESHOLD = 0.13)
//   --mode <modo>       fixed84 (por defecto). 'decay' llega en la fase 2.5
//   --half-life <días>  vida media del modo decay (solo con --mode decay)
//   --from / --to       rango de días a evaluar (YYYY-MM-DD, VET)
//   --output <ruta>     guarda las métricas en JSON (sin datos crudos)
//   --json              imprime el resultado en JSON en vez de texto
//
// Los datos reales van en scripts/data/ (ignorado por git) y nunca se suben al repo.

const fs = require('fs');
const path = require('path');

require('../public/timezone.js');
const engine = require('../public/prediction.js');
const { walkForward } = require('../public/backtest-core.js');

const MODES = ['fixed84', 'decay'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseArgs(argv) {
    const args = {
        input: null, window: engine.HEATMAP_WINDOW_DAYS, threshold: engine.RISK_THRESHOLD,
        mode: 'fixed84', halfLife: null, from: null, to: null, output: null, json: false,
    };
    const takeValue = (flag, index) => {
        const value = argv[index + 1];
        if (value === undefined || value.startsWith('--')) throw new Error(`Falta el valor de ${flag}`);
        return value;
    };
    for (let i = 0; i < argv.length; i++) {
        const flag = argv[i];
        switch (flag) {
            case '--input': args.input = takeValue(flag, i); i++; break;
            case '--window': args.window = Number(takeValue(flag, i)); i++; break;
            case '--threshold': args.threshold = Number(takeValue(flag, i)); i++; break;
            case '--mode': args.mode = takeValue(flag, i); i++; break;
            case '--half-life': args.halfLife = Number(takeValue(flag, i)); i++; break;
            case '--from': args.from = takeValue(flag, i); i++; break;
            case '--to': args.to = takeValue(flag, i); i++; break;
            case '--output': args.output = takeValue(flag, i); i++; break;
            case '--json': args.json = true; break;
            default: throw new Error(`Opción desconocida: ${flag}`);
        }
    }

    if (!args.input) throw new Error('Falta --input <csv|json>');
    if (!Number.isInteger(args.window) || args.window < 1) throw new Error('--window debe ser un entero positivo de días');
    if (!(args.threshold > 0 && args.threshold < 1)) throw new Error('--threshold debe estar entre 0 y 1');
    if (!MODES.includes(args.mode)) throw new Error(`--mode debe ser uno de: ${MODES.join(', ')}`);
    if (args.mode === 'decay') throw new Error("--mode decay aún no existe en el motor (se implementa en la fase 2.5)");
    if (args.halfLife !== null && !(args.halfLife > 0)) throw new Error('--half-life debe ser un número positivo de días');
    if (args.from && !DATE_PATTERN.test(args.from)) throw new Error('--from debe tener formato YYYY-MM-DD');
    if (args.to && !DATE_PATTERN.test(args.to)) throw new Error('--to debe tener formato YYYY-MM-DD');
    return args;
}

// CSV con campos entre comillas, comas y saltos de línea dentro de las notas, y "" como comilla escapada.
function parseCsvRows(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    const source = text.replace(/^﻿/, '');
    for (let i = 0; i < source.length; i++) {
        const char = source[i];
        if (quoted) {
            if (char === '"' && source[i + 1] === '"') { field += '"'; i++; }
            else if (char === '"') quoted = false;
            else field += char;
        } else if (char === '"') quoted = true;
        else if (char === ',') { row.push(field); field = ''; }
        else if (char === '\n' || char === '\r') {
            if (char === '\r' && source[i + 1] === '\n') i++;
            row.push(field); rows.push(row); row = []; field = '';
        } else field += char;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(cell => cell !== ''));
}

// Convierte el CSV de api/export.js (Inicio, Fin, Duración (min), Tipo, Notas) en eventos del motor.
function parseExportCsv(text) {
    const [header, ...rows] = parseCsvRows(text);
    if (!header || header.length < 4 || !/inicio/i.test(header[0])) {
        throw new Error('El CSV no tiene el encabezado de la exportación (Inicio,Fin,Duración (min),Tipo,Notas)');
    }
    const outages = [];
    let skipped = 0;
    rows.forEach((cells, index) => {
        const start = new Date(cells[0]);
        const end = cells[1] ? new Date(cells[1]) : null;
        if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime()))) { skipped++; return; }
        outages.push({
            id: `csv-${index}`,
            start: start.toISOString(),
            end: end ? end.toISOString() : null,
            duration_minutes: Number(cells[2]) || 0,
            type: cells[3] || 'corte',
        });
    });
    return { outages, skipped };
}

function loadInput(filePath) {
    const text = fs.readFileSync(filePath, 'utf8');
    if (path.extname(filePath).toLowerCase() === '.json') {
        const data = JSON.parse(text);
        const outages = Array.isArray(data) ? data : data.outages;
        if (!Array.isArray(outages)) throw new Error('El JSON debe ser una lista de eventos o { outages: [...] }');
        return { outages, skipped: 0, now: Array.isArray(data) ? null : data.now || null };
    }
    return { ...parseExportCsv(text), now: null };
}

const round = (value, digits) => value === null ? null : Number(value.toFixed(digits));

function runBacktest(args) {
    const { outages, skipped, now } = loadInput(args.input);
    const result = walkForward(outages, {
        from: args.from, to: args.to, now,
        threshold: args.threshold, windowDays: args.window,
    });
    const { summary } = result;
    return {
        generatedAt: new Date().toISOString(),
        params: {
            mode: args.mode, window: args.window, threshold: args.threshold,
            halfLife: args.halfLife, marginMinutes: 30,
        },
        period: { from: result.from, to: result.to, days: result.evaluations.length },
        input: {
            cortes: outages.filter(o => (o.type || 'corte') === 'corte').length,
            fluctuaciones: outages.filter(o => o.type === 'fluctuacion').length,
            skippedRows: skipped,
        },
        metrics: {
            hitRate: round(summary.hitRate, 4),
            falseAlarmRate: round(summary.falseAlarmRate, 4),
            brier: round(summary.brier, 5),
            timingMarginMin: round(summary.timingMarginMin, 1),
        },
        extra: {
            accuracy: round(summary.accuracy, 4),
            evaluatedDays: summary.evaluatedDays,
            noDataDays: summary.noDataDays,
            verdicts: summary.verdicts,
        },
    };
}

function formatPercent(value) {
    return value === null ? '—' : `${(value * 100).toFixed(1)} %`;
}

function formatReport(report) {
    const { params, period, input, metrics, extra } = report;
    return [
        `Backtest walk-forward — modo ${params.mode}, ventana ${params.window} d, umbral ${params.threshold}`,
        `Periodo: ${period.from} → ${period.to} (${period.days} días: ${extra.evaluatedDays} evaluados, ${extra.noDataDays} sin datos)`,
        `Entrada: ${input.cortes} cortes, ${input.fluctuaciones} fluctuaciones${input.skippedRows ? `, ${input.skippedRows} filas ignoradas` : ''}`,
        `Veredictos: ${extra.verdicts.hit} aciertos · ${extra.verdicts.false_alarm} falsas alarmas · ${extra.verdicts.missed} sin aviso · ${extra.verdicts.quiet} tranquilos`,
        '',
        `hitRate          ${formatPercent(metrics.hitRate)}`,
        `falseAlarmRate   ${formatPercent(metrics.falseAlarmRate)}`,
        `brier            ${metrics.brier === null ? '—' : metrics.brier.toFixed(4)}`,
        `timingMarginMin  ${metrics.timingMarginMin === null ? '—' : `${metrics.timingMarginMin} min`}`,
    ].join('\n');
}

function main(argv) {
    let args;
    try {
        args = parseArgs(argv);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exitCode = 1;
        return;
    }
    if (args.halfLife !== null && args.mode !== 'decay') {
        console.error('Aviso: --half-life solo aplica con --mode decay; se ignora.');
    }
    const report = runBacktest(args);
    console.log(args.json ? JSON.stringify(report, null, 2) : formatReport(report));
    if (args.output) {
        fs.mkdirSync(path.dirname(args.output), { recursive: true });
        fs.writeFileSync(args.output, JSON.stringify(report, null, 2) + '\n');
        console.error(`Métricas guardadas en ${args.output}`);
    }
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { parseArgs, parseCsvRows, parseExportCsv, loadInput, runBacktest, formatReport };
