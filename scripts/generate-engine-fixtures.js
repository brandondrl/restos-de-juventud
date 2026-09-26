// Genera los fixtures deterministas del motor en api/__tests__/fixtures/.
// Uso: node scripts/generate-engine-fixtures.js
// Todas las horas se escriben en VET (UTC-4) y se convierten a UTC.

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'api', '__tests__', 'fixtures');
const VET_OFFSET_HOURS = 4;
const DAY_MS = 86400000;

function vet(year, month, day, hour, minute) {
    return new Date(Date.UTC(year, month - 1, day, hour + VET_OFFSET_HOURS, minute, 0));
}

function corte(id, start, minutes, extra = {}) {
    const end = new Date(start.getTime() + minutes * 60000);
    return {
        id, start: start.toISOString(), end: end.toISOString(),
        duration_minutes: minutes, type: 'corte', mood: 3, notes: '', ...extra,
    };
}

function fluctuacion(id, at) {
    const iso = at.toISOString();
    return { id, start: iso, end: iso, duration_minutes: 0, type: 'fluctuacion', mood: null, notes: '' };
}

function addDays(date, days) {
    return new Date(date.getTime() + days * DAY_MS);
}

// (a) Usuario nuevo con 3 cortes en sus primeros días.
function fixtureA() {
    return {
        description: 'Usuario nuevo con 3 cortes',
        now: vet(2026, 3, 12, 10, 0).toISOString(),
        activeOutage: null,
        outages: [
            corte('a1', vet(2026, 3, 9, 14, 20), 85),
            corte('a2', vet(2026, 3, 10, 18, 5), 85),
            corte('a3', vet(2026, 3, 11, 9, 10), 170),
        ],
    };
}

// (b) 6 semanas regulares: lunes 14:10 (90 min) y jueves 10:40 (200 min).
function fixtureB() {
    const outages = [];
    for (let week = 0; week < 6; week++) {
        outages.push(corte(`b-lun${week}`, addDays(vet(2026, 1, 5, 14, 10), week * 7), 90));
        outages.push(corte(`b-jue${week}`, addDays(vet(2026, 1, 8, 10, 40), week * 7), 200));
    }
    return {
        description: '6 semanas regulares (lunes tarde + jueves mediodía)',
        now: vet(2026, 2, 16, 8, 0).toISOString(),
        activeOutage: null,
        outages,
    };
}

// (c) 120 días: 60 de cortes de mañana (07:15, 120 min) y luego 60 de tarde (15:30, 150 min).
// Se salta un día de cada 7 para que no sea trivial.
function fixtureC() {
    const outages = [];
    const first = vet(2026, 1, 1, 0, 0);
    for (let day = 0; day < 120; day++) {
        if (day % 7 === 3) continue;
        const base = addDays(first, day);
        const start = day < 60
            ? new Date(base.getTime() + (7 * 60 + 15) * 60000)
            : new Date(base.getTime() + (15 * 60 + 30) * 60000);
        outages.push(corte(`c${day}`, start, day < 60 ? 120 : 150));
    }
    return {
        description: '120 días con cambio de patrón (mañana → tarde) a mitad',
        now: vet(2026, 5, 1, 6, 0).toISOString(),
        activeOutage: null,
        outages,
    };
}

// (d) Cortes que cruzan medianoche: viernes 22:30 (165 min), sábado 23:40 (150 min),
// y algunos martes 23:50 (30 min).
function fixtureD() {
    const outages = [];
    for (let week = 0; week < 6; week++) {
        outages.push(corte(`d-vie${week}`, addDays(vet(2026, 4, 3, 22, 30), week * 7), 165));
        if (week < 5) outages.push(corte(`d-sab${week}`, addDays(vet(2026, 4, 4, 23, 40), week * 7), 150));
    }
    outages.push(corte('d-mar0', vet(2026, 4, 7, 23, 50), 30));
    outages.push(corte('d-mar2', vet(2026, 4, 21, 23, 50), 30));
    return {
        description: 'Cortes que cruzan medianoche',
        now: vet(2026, 5, 9, 11, 0).toISOString(),
        activeOutage: null,
        outages,
    };
}

// (e) Historial con fluctuaciones mezcladas: martes 19:00 (60 min), miércoles 19:30 (45 min),
// fluctuaciones casi diarias, un corte sin campo type (cuenta como corte), un corte el lunes
// anterior y un corte activo el martes de la fecha de referencia.
function fixtureE() {
    const outages = [];
    for (let week = 0; week < 5; week++) {
        outages.push(corte(`e-mar${week}`, addDays(vet(2026, 7, 7, 19, 0), week * 7), 60));
        outages.push(corte(`e-mie${week}`, addDays(vet(2026, 7, 8, 19, 30), week * 7), 45));
    }
    for (let day = 0; day < 35; day++) {
        if (day % 5 === 4) continue;
        const hour = 6 + ((day * 7) % 16);
        const minute = (day * 13) % 60;
        outages.push(fluctuacion(`e-f${day}`, addDays(vet(2026, 7, 6, hour, minute), day)));
    }
    const untyped = corte('e-sin-tipo', vet(2026, 7, 25, 13, 5), 40);
    delete untyped.type;
    outages.push(untyped);
    outages.push(corte('e-lun', vet(2026, 8, 10, 12, 0), 50));
    const active = { id: 'e-activo', start: vet(2026, 8, 11, 9, 30).toISOString(), end: null, duration_minutes: null, type: 'corte', mood: null, notes: '' };
    outages.push(active);
    return {
        description: 'Historial con fluctuaciones mezcladas, corte sin tipo y corte activo',
        now: vet(2026, 8, 11, 10, 0).toISOString(),
        activeOutage: active,
        outages,
    };
}

const FIXTURES = { a: fixtureA, b: fixtureB, c: fixtureC, d: fixtureD, e: fixtureE };
const NAMES = {
    a: 'a-usuario-nuevo', b: 'b-seis-semanas', c: 'c-cambio-patron',
    d: 'd-cruce-medianoche', e: 'e-fluctuaciones',
};

if (require.main === module) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    Object.entries(FIXTURES).forEach(([key, build]) => {
        const file = path.join(OUT_DIR, `${NAMES[key]}.json`);
        fs.writeFileSync(file, JSON.stringify(build(), null, 2) + '\n');
        console.log(`✓ ${path.relative(process.cwd(), file)}`);
    });
}

module.exports = { FIXTURES, NAMES };
