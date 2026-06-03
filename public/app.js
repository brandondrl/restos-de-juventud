const ICONS = {
    bolt:     `<svg viewBox="0 0 24 24"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    boltOff:  `<svg viewBox="0 0 24 24"><line x1="2" y1="2" x2="22" y2="22"/><path d="M11.5 4H13L12 10h7L12 21v-7H5z"/></svg>`,
    bulb:     `<svg viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/></svg>`,
    dashboard:`<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    plus:     `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
    chart:    `<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    history:  `<svg viewBox="0 0 24 24"><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/></svg>`,
    users:    `<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    trash:    `<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
    zap:      `<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    chevDown: `<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>`,
    chevUp:   `<svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>`,
    close:    `<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    download: `<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    clock:    `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    plugOff:  `<svg viewBox="0 0 24 24"><path d="M12 22V11M5 11l-.75-3M19 11l.75-3M8 11V5h8v6"/><line x1="3" y1="3" x2="21" y2="21"/></svg>`,
    logout:   `<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
};

const MOOD_OPTIONS = [
    { value: 1, emoji: '😡', label: 'Arrecho',   color: '#ef4444' },
    { value: 2, emoji: '😢', label: 'Triste',    color: '#f97316' },
    { value: 3, emoji: '😤', label: 'Frustrado', color: '#f59e0b' },
    { value: 4, emoji: '😐', label: 'Normal',    color: '#84cc16' },
    { value: 5, emoji: '😊', label: 'Feliz',     color: '#22c55e' },
];

const HISTORY_PAGE_SIZE = 20;
const ZONE_OPTIONS = ['Norte', 'Centro', 'Sur', 'Este', 'Oeste'];

function generateId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function formatDuration(totalMinutes) {
    if (!totalMinutes || totalMinutes <= 0) return '0m';
    const total   = Math.round(totalMinutes);
    const hours   = Math.floor(total / 60);
    const minutes = total % 60;
    if (hours && minutes) return `${hours}h ${minutes}m`;
    return hours ? `${hours}h` : `${minutes}m`;
}
function formatDate(isoString) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' });
}
function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return `${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
}
function getTodayDate() {
    const d = new Date();
    return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}
function getCurrentTime() {
    const d = new Date();
    return `${padZero(d.getHours())}:${padZero(d.getMinutes())}`;
}
function buildZoneSelect(stateExpr, currentValue) {
    const opts = `<option value="">Sin zona</option>` +
        ZONE_OPTIONS.map(z => `<option value="${z}"${currentValue === z ? ' selected' : ''}>${z}</option>`).join('');
    return `<select onchange="${stateExpr} = this.value">${opts}</select>`;
}

const http = {
    get:    url       => fetch(url, { credentials: 'same-origin' }).then(r => { if (!r.ok) throw r; return r.json(); }),
    post:   (url, b)  => fetch(url, { credentials: 'same-origin', method: 'POST',   headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }),
    put:    (url, b)  => fetch(url, { credentials: 'same-origin', method: 'PUT',    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }),
    delete: url       => fetch(url, { credentials: 'same-origin', method: 'DELETE' }),
};

let authState = {
    isLoading:    true,
    currentUser:  null,
    activeTab:    'login',
    errorMessage: '',
    loginForm:    { username: '', password: '' },
    registerForm: { username: '', password: '', city: '', zone: '' },
};

let appState = {
    outages:       [],
    activeOutage:  null,
    currentTab:    'dashboard',
    isLoading:     true,
    startDate:     getTodayDate(),
    startTime:     getCurrentTime(),
    endDate:       getTodayDate(),
    endTime:       getCurrentTime(),
    showManualForm:   false,
    manualDate:       getTodayDate(),
    manualStartTime:  '00:00',
    manualEndTime:    '00:00',
    confirmDeleteId:  null,
    historyPage:      1,
    selectedMood:     null,
};

let profileState = {
    isOpen:          false,
    profileData:     null,
    isLoading:       false,
    editCity:        '',
    editZone:        '',
    isPublic:        true,
    currentPassword: '',
    newPassword:     '',
    passwordError:   '',
    passwordUpdated: false,
    changesSaved:    false,
    confirmDelete:   false,
};

let communityState = {
    isLoading: false,
    data:      null,
};

function buildTimePicker(stateKey, currentValue) {
    const parts       = (currentValue || '00:00').split(':');
    const currentHour = parts[0] || '00';
    const currentMin  = parts[1] || '00';

    return `<div class="time-picker">
        <input type="number" min="0" max="23" value="${currentHour}"
            onchange="setTimeHour('${stateKey}', padZero(Math.min(23,Math.max(0,+this.value))))">
        <span>:</span>
        <input type="number" min="0" max="59" value="${currentMin}"
            onchange="setTimeMinute('${stateKey}', padZero(Math.min(59,Math.max(0,+this.value))))">
    </div>`;
}

function buildMoodPicker() {
    const buttons = MOOD_OPTIONS.map(mood => {
        const isSelected = appState.selectedMood === mood.value;
        const borderColor = isSelected ? mood.color : 'var(--border)';
        const labelColor  = isSelected ? mood.color : 'var(--text3)';
        return `<button class="mood-btn${isSelected ? ' selected' : ''}"
            style="border-color:${borderColor}"
            onclick="appState.selectedMood = appState.selectedMood === ${mood.value} ? null : ${mood.value}; render()">
            <div>${mood.emoji}</div>
            <div style="color:${labelColor}">${mood.label}</div>
        </button>`;
    }).join('');

    return `<div style="margin-bottom:12px">
        <div style="font-size:12px;color:var(--text2);margin-bottom:6px">
            ¿Cómo te sientes con este corte?
        </div>
        <div class="mood-row">${buttons}</div>
    </div>`;
}

function buildMoodGauge(moodData) {
    const cx = 100, cy = 88, outerR = 72, innerR = 50, needleLen = 60;
    const GAP_DEGREES = 2;

    function polarPoint(angleDeg, r) {
        const rad = angleDeg * Math.PI / 180;
        return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
    }

    function arcSegment(startAngle, endAngle, color, opacity) {
        const s1 = startAngle - GAP_DEGREES;
        const e1 = endAngle   + GAP_DEGREES;
        const f  = v => v.toFixed(2);
        const [ox1, oy1] = polarPoint(s1, outerR);
        const [ox2, oy2] = polarPoint(e1, outerR);
        const [ix1, iy1] = polarPoint(s1, innerR);
        const [ix2, iy2] = polarPoint(e1, innerR);
        return `<path d="M ${f(ox1)} ${f(oy1)} A ${outerR} ${outerR} 0 0 0 ${f(ox2)} ${f(oy2)} L ${f(ix2)} ${f(iy2)} A ${innerR} ${innerR} 0 0 1 ${f(ix1)} ${f(iy1)} Z" fill="${color}" opacity="${opacity}"/>`;
    }

    const opacity  = moodData ? '0.92' : '0.18';
    const segments = MOOD_OPTIONS.map((mood, i) =>
        arcSegment(180 - i * 36, 180 - (i + 1) * 36, mood.color, opacity)
    ).join('');

    if (!moodData) {
        return `<svg viewBox="0 0 200 125" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:240px;display:block;margin:0 auto">
            ${segments}
            <circle cx="${cx}" cy="${cy}" r="5" fill="#1e293b" stroke="#334155" stroke-width="2"/>
            <text x="${cx}" y="108" text-anchor="middle" fill="#475569" font-size="12" font-family="system-ui">Sin datos aún</text>
            <text x="${cx}" y="122" text-anchor="middle" fill="#334155" font-size="10" font-family="system-ui">Registra tu estado de ánimo para verlo aquí</text>
        </svg>`;
    }

    const { average, totalCount } = moodData;
    const needleAngle = 180 - ((average - 1) / 4) * 180;
    const [nx, ny]    = polarPoint(needleAngle, needleLen);
    const moodIndex   = Math.min(4, Math.max(0, Math.round(average) - 1));
    const displayValue = Math.round(((average - 1) / 4) * 100);
    const currentMood  = MOOD_OPTIONS[moodIndex];
    const countLabel   = `${totalCount} registro${totalCount !== 1 ? 's' : ''}`;
    const f = v => v.toFixed(2);

    return `<svg viewBox="0 0 200 125" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:240px;display:block;margin:0 auto">
        ${segments}
        <line x1="${cx}" y1="${cy}" x2="${f(nx)}" y2="${f(ny)}" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="${cx}" cy="${cy}" r="5" fill="white"/>
        <text x="${cx}" y="108" text-anchor="middle" fill="white" font-size="26" font-weight="700" font-family="system-ui">${displayValue}</text>
        <text x="${cx}" y="122" text-anchor="middle" fill="${currentMood.color}" font-size="12" font-weight="600" font-family="system-ui">${currentMood.label} &middot; <tspan fill="#475569" font-weight="400">${countLabel}</tspan></text>
    </svg>`;
}

async function initialize() {
    try {
        const user = await http.get('/api/auth/me');
        authState.currentUser = user;
        authState.isLoading   = false;
        await loadApplicationData();
    } catch {
        authState.isLoading = false;
        render();
    }
}

let lastNotifiedHour = -1;

function checkRiskNotification() {
    if (!appState.outages.length || appState.activeOutage) return;
    if (Notification.permission !== 'granted') return;
    const now  = new Date();
    const hour = now.getHours();
    if (hour === lastNotifiedHour) return;
    const heatmap = buildHeatmap(appState.outages);
    if (!heatmap) return;
    const slot = heatmap[`${now.getDay()}_${hour}`] || { probability: 0, confidence: 0 };
    const prob = adjustedProbability(slot.probability, slot.confidence);
    if (prob >= 0.18) {
        lastNotifiedHour = hour;
        new Notification('⚡ Riesgo de corte', {
            body: `${Math.round(prob * 100)}% de probabilidad esta hora según tu historial.`,
            tag:  'riesgo-corte',
        });
    }
}

async function loadApplicationData() {
    appState.isLoading = true;
    render();
    const [outages, activeOutage] = await Promise.all([
        http.get('/api/outages'),
        http.get('/api/active'),
    ]);
    appState.outages      = outages;
    appState.activeOutage = activeOutage;
    appState.isLoading    = false;
    if (activeOutage) {
        appState.endDate = getTodayDate();
        appState.endTime = getCurrentTime();
    }
    render();
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    checkRiskNotification();
    setInterval(() => {
        if (appState.activeOutage) render();
        checkRiskNotification();
    }, 30000);
}

async function login() {
    authState.errorMessage = '';
    const response = await http.post('/api/auth/login', authState.loginForm);
    const body     = await response.json();
    if (!response.ok) { authState.errorMessage = body.error; render(); return; }
    authState.currentUser = body.user;
    await loadApplicationData();
}

async function register() {
    authState.errorMessage = '';
    const response = await http.post('/api/auth/register', authState.registerForm);
    const body     = await response.json();
    if (!response.ok) { authState.errorMessage = body.error; render(); return; }
    authState.currentUser = body.user;
    await loadApplicationData();
}

async function logout() {
    await http.post('/api/auth/logout', {});
    authState.currentUser = null;
    appState.outages      = [];
    appState.activeOutage = null;
    profileState.isOpen   = false;
    render();
}

async function startOutage() {
    const startISO  = new Date(`${appState.startDate}T${appState.startTime}`).toISOString();
    const newOutage = { id: generateId(), start: startISO };
    await http.post('/api/active', newOutage);
    appState.activeOutage = newOutage;
    appState.endDate      = getTodayDate();
    appState.endTime      = getCurrentTime();
    render();
}

async function endOutage() {
    if (!appState.activeOutage) return;
    if (!appState.selectedMood) { alert('Selecciona cómo te sientes antes de registrar el regreso.'); return; }
    const endTime   = new Date(`${appState.endDate}T${appState.endTime}`);
    const startTime = new Date(appState.activeOutage.start);
    if (endTime <= startTime) {
        alert(`La hora de regreso (${appState.endTime}) debe ser posterior a la salida (${formatTime(appState.activeOutage.start)}). Usa el botón "Ahora".`);
        return;
    }
    const completedOutage = {
        ...appState.activeOutage,
        end:              endTime.toISOString(),
        duration_minutes: (endTime - startTime) / 60000,
        type:             'corte',
        mood:             appState.selectedMood || null,
    };
    const response = await http.post('/api/outages', completedOutage);
    if (!response.ok) { alert('Error al guardar. Reintenta.'); return; }
    await http.delete('/api/active');
    appState.outages.unshift(completedOutage);
    appState.activeOutage = null;
    appState.endDate      = getTodayDate();
    appState.endTime      = getCurrentTime();
    appState.selectedMood = null;
    render();
}

async function recordFluctuation() {
    if (appState.activeOutage) { alert('No es posible registrar una fluctuación mientras hay un corte activo.'); return; }
    const isoTime     = new Date(`${appState.startDate}T${appState.startTime}`).toISOString();
    const fluctuation = { id: generateId(), start: isoTime, end: isoTime, duration_minutes: 0, type: 'fluctuacion' };
    const response    = await http.post('/api/outages', fluctuation);
    if (!response.ok) { alert('Error al registrar. Reintenta.'); return; }
    appState.outages.unshift(fluctuation);
    appState.outages.sort((a, b) => new Date(b.start) - new Date(a.start));
    const button = document.getElementById('fluctuation-button');
    if (button) {
        button.textContent = '✓ Registrada';
        button.disabled    = true;
        button.style.opacity = '0.6';
        setTimeout(render, 1200);
    } else {
        render();
    }
}

async function saveManualOutage() {
    const { manualDate, manualStartTime, manualEndTime } = appState;
    if (!manualDate) { alert('Completa todos los campos'); return; }
    if (!appState.selectedMood) { alert('Selecciona cómo te sientes antes de guardar.'); return; }
    const startTime = new Date(`${manualDate}T${manualStartTime}`);
    const endTime   = new Date(`${manualDate}T${manualEndTime}`);
    if (isNaN(startTime) || isNaN(endTime) || endTime <= startTime) {
        alert('La hora de fin debe ser posterior al inicio');
        return;
    }
    const outage = {
        id:               generateId(),
        start:            startTime.toISOString(),
        end:              endTime.toISOString(),
        duration_minutes: (endTime - startTime) / 60000,
        type:             'corte',
        mood:             appState.selectedMood || null,
    };
    const response = await http.post('/api/outages', outage);
    if (!response.ok) { alert('Error al guardar. Reintenta.'); return; }
    appState.outages.unshift(outage);
    appState.outages.sort((a, b) => new Date(b.start) - new Date(a.start));
    appState.manualStartTime = '00:00';
    appState.manualEndTime   = '00:00';
    appState.showManualForm  = false;
    appState.selectedMood    = null;
    render();
}

async function deleteOutage(id) {
    const response = await http.delete(`/api/outages/${id}`);
    if (!response.ok) { alert('Error al borrar. Reintenta.'); return; }
    appState.outages       = appState.outages.filter(o => o.id !== id);
    appState.confirmDeleteId = null;
    render();
}

async function openProfile() {
    profileState.isOpen        = true;
    profileState.isLoading     = true;
    profileState.passwordError  = '';
    profileState.passwordUpdated = false;
    profileState.changesSaved   = false;
    profileState.confirmDelete  = false;
    render();
    const data = await http.get('/api/profile');
    profileState.profileData = data;
    profileState.editCity    = data.city;
    profileState.editZone    = data.zone;
    profileState.isPublic    = data.is_public;
    profileState.isLoading   = false;
    render();
}

async function saveProfile() {
    profileState.changesSaved   = false;
    profileState.passwordError  = '';
    const payload = { city: profileState.editCity, zone: profileState.editZone, is_public: profileState.isPublic };
    if (profileState.newPassword) {
        payload.currentPassword = profileState.currentPassword;
        payload.newPassword     = profileState.newPassword;
    }
    const response = await http.put('/api/profile', payload);
    const body     = await response.json();
    if (!response.ok) { profileState.passwordError = body.error; render(); return; }
    profileState.currentPassword = '';
    profileState.newPassword     = '';
    profileState.passwordError   = '';
    profileState.passwordUpdated = !!payload.newPassword;
    profileState.changesSaved    = true;
    if (authState.currentUser) {
        authState.currentUser.city = profileState.editCity;
        authState.currentUser.zone = profileState.editZone;
    }
    render();
}

async function deleteAccount() {
    if (!profileState.confirmDelete) { profileState.confirmDelete = true; render(); return; }
    const response = await http.delete('/api/account');
    if (!response.ok) { alert('Error al borrar la cuenta. Reintenta.'); return; }
    authState.currentUser = null;
    appState.outages      = [];
    appState.activeOutage = null;
    profileState.isOpen   = false;
    render();
}

async function refreshCommunity() {
    communityState.isLoading = true;
    render();
    communityState.data      = await http.get('/api/community');
    communityState.isLoading = false;
    render();
}

function render() {
    const container = document.getElementById('app');
    if (authState.isLoading) {
        container.innerHTML = '<div class="empty" style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center"><p>Cargando...</p></div>';
        return;
    }
    container.innerHTML = authState.currentUser ? renderApp() : renderAuthScreen();
}

function renderAuthScreen() {
    const isLoginTab   = authState.activeTab === 'login';
    const errorBanner  = authState.errorMessage
        ? `<div class="auth-err">${authState.errorMessage}</div>`
        : '';

    const loginForm = `
        <div class="field"><label>Usuario</label>
            <input autocomplete="username" placeholder="tu_usuario" value="${authState.loginForm.username}"
                oninput="authState.loginForm.username = this.value">
        </div>
        <div class="field"><label>Contraseña</label>
            <input type="password" autocomplete="current-password" value="${authState.loginForm.password}"
                oninput="authState.loginForm.password = this.value"
                onkeydown="if (event.key === 'Enter') login()">
        </div>
        <button class="bmain bdanger" style="margin-top:4px" onclick="login()">${ICONS.bolt}Entrar</button>`;

    const registerForm = `
        <div class="field"><label>Usuario</label>
            <input autocomplete="username" placeholder="mi_usuario" value="${authState.registerForm.username}"
                oninput="authState.registerForm.username = this.value">
        </div>
        <div class="field"><label>Contraseña <span style="color:var(--text3)">(mín. 6 caracteres)</span></label>
            <input type="password" autocomplete="new-password" value="${authState.registerForm.password}"
                oninput="authState.registerForm.password = this.value">
        </div>
        <div class="trow" style="margin-bottom:12px">
            <div class="field" style="margin:0"><label>Ciudad</label>
                <input placeholder="Caracas" value="${authState.registerForm.city}" oninput="authState.registerForm.city = this.value">
            </div>
            <div class="field" style="margin:0"><label>Zona <span style="color:var(--text3)">(opcional)</span></label>
                ${buildZoneSelect('authState.registerForm.zone', authState.registerForm.zone)}
            </div>
        </div>
        <button class="bmain bsuccess" onclick="register()">${ICONS.bolt}Crear cuenta</button>
        <p class="auth-note">Tu actividad será visible en Comunidad si mantienes el perfil público.</p>`;

    return `<div class="auth-wrap"><div class="auth-card">
        <div class="auth-logo">
            <svg viewBox="0 0 24 24" style="width:26px;height:26px;stroke:#f59e0b;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <div>
                <div class="auth-title">Restos de Juventud</div>
                <div style="font-size:12px;color:var(--text2)">Monitor de cortes eléctricos</div>
            </div>
        </div>
        <div class="auth-tabs">
            <button class="auth-tab ${isLoginTab ? 'active' : ''}" onclick="updateAuthState('activeTab', 'login')">Entrar</button>
            <button class="auth-tab ${!isLoginTab ? 'active' : ''}" onclick="updateAuthState('activeTab', 'register')">Registrarse</button>
        </div>
        ${errorBanner}
        ${isLoginTab ? loginForm : registerForm}
    </div></div>`;
}

function renderApp() {
    const now = new Date();
    const { outages, activeOutage, currentTab } = appState;
    const minutesWithoutPower = activeOutage ? (now - new Date(activeOutage.start)) / 60000 : 0;

    const heatmap          = buildHeatmap(outages);
    const statistics       = computeStatistics(outages);
    const moodData         = computeAverageMood(outages);
    const todayPredictions = heatmap
        ? Array.from({ length: 24 }, (_, hour) => ({ hour, ...(heatmap[`${now.getDay()}_${hour}`] || { probability: 0, confidence: 0 }) }))
        : [];
    window._activeOutage = activeOutage;
    const forecast = heatmap ? getDayForecast(todayPredictions, outages) : { type: 'nodata' };

    const navTabs = [
        { id: 'dashboard', icon: ICONS.dashboard, label: 'Panel' },
        { id: 'log',       icon: ICONS.plus,      label: 'Registrar' },
        { id: 'predict',   icon: ICONS.chart,     label: 'Predicción' },
        { id: 'community', icon: ICONS.users,     label: 'Comunidad' },
        { id: 'history',   icon: ICONS.history,   label: 'Historial' },
    ];

    const tabButtons = navTabs.map(tab =>
        `<button class="tab ${currentTab === tab.id ? 'active' : ''}" onclick="setCurrentTab('${tab.id}')">${tab.icon}${tab.label}</button>`
    ).join('');

    const badgeClass = activeOutage ? 'badge boff' : 'badge bon';
    const badgeText  = activeOutage ? `Sin luz &middot; ${formatDuration(minutesWithoutPower)}` : 'Con luz';

    let tabContent = '';
    if (currentTab === 'dashboard') tabContent = renderDashboardTab(now, heatmap, statistics, moodData, todayPredictions, forecast, minutesWithoutPower);
    if (currentTab === 'log')       tabContent = renderLogTab(minutesWithoutPower);
    if (currentTab === 'predict')   tabContent = renderPredictTab(now, heatmap, todayPredictions);
    if (currentTab === 'community') tabContent = renderCommunityTab(now);
    if (currentTab === 'history')   tabContent = renderHistoryTab(now);

    const profileOverlay = profileState.isOpen ? renderProfileOverlay() : '';

    const activeBanner = activeOutage ? `
        <div class="active-banner">
            <span>⚡ CORTE ACTIVO — ¿Ya regresó la luz?</span>
            <button onclick="setCurrentTab('log')">Registrar →</button>
        </div>` : '';

    return `
        <div class="header">
            <div class="hleft">
                <svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:#f59e0b;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <div>
                    <div class="htitle">Monitor de Cortes</div>
                    <div class="hsub">${now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                </div>
            </div>
            <div class="hright">
                <div class="${badgeClass}"><div class="dot"></div>${badgeText}</div>
                <button class="profile-btn" onclick="openProfile()">@${authState.currentUser.username}</button>
            </div>
        </div>
        <div class="tabs">${tabButtons}</div>
        ${activeBanner}
        <div class="content">
            ${tabContent}
        </div>
        ${profileOverlay}`;
}

function renderDashboardTab(now, heatmap, statistics, moodData, todayPredictions, forecast, minutesWithoutPower) {
    const dayName = DAYS_FULL[now.getDay()].toUpperCase();
    const tomorrowForecast = getTomorrowForecast(appState.outages);

    let forecastContent;
    if (forecast.type === 'nodata') {
        const progress = computeTrainingProgress(appState.outages);
        if (progress.weeks === 0) {
            forecastContent = `<div style="font-size:13px;color:var(--text3)">Registra tu primer corte para empezar a calibrar el modelo.</div>`;
        } else {
            const weeksLeft = Math.max(0, WEEKS_FOR_FULL_CONFIDENCE - progress.weeks);
            forecastContent = `<div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                    <span style="font-size:13px;color:var(--text2)">Calibrando el modelo…</span>
                    <span style="font-size:13px;font-weight:600;color:var(--amber)">${progress.percent}%</span>
                </div>
                <div style="height:6px;background:var(--bg3);border-radius:3px;overflow:hidden">
                    <div style="height:100%;width:${progress.percent}%;background:var(--amber);border-radius:3px"></div>
                </div>
                <div style="font-size:11px;color:var(--text3);margin-top:5px">
                    Semana ${progress.weeks} de ${WEEKS_FOR_FULL_CONFIDENCE} — faltan ~${weeksLeft} semana${weeksLeft !== 1 ? 's' : ''} para predicciones confiables
                </div>
            </div>`;
        }
    } else if (forecast.type === 'safe') {
        forecastContent = `<div style="font-size:14px;color:var(--grn-t)">&#10003; Sin periodos de riesgo significativo para hoy.</div>`;
    } else if (forecast.type === 'already_hit') {
        if (forecast.active) {
            forecastContent = `<div style="font-size:15px;font-weight:600;color:var(--red-t);margin-bottom:4px">⚡ Sin luz ahora mismo.</div>
                <div style="font-size:13px;color:var(--text2)">Respira. Lo más probable es que no se vaya de nuevo hoy una vez que regrese.</div>`;
        } else {
            const totalHoy = appState.outages
                .filter(o => o.end && (o.type || 'corte') === 'corte' && new Date(o.start) >= new Date(new Date().setHours(0,0,0,0)))
                .reduce((s, o) => s + (o.duration_minutes || 0), 0);
            forecastContent = `<div style="font-size:15px;font-weight:600;color:var(--grn-t);margin-bottom:4px">&#10003; Ya se fue. Ya volvió. Fresco.</div>
                <div style="font-size:13px;color:var(--text2)">Hoy ya estuviste ${formatDuration(totalHoy)} sin luz. Lo más probable es que no se vaya de nuevo hoy.</div>`;
        }
    } else if (forecast.type === 'missed') {
        const rangeTexts = forecast.ranges.map(([a, b]) =>
            a === b ? `${padZero(a)}:00` : `${padZero(a)}:00–${padZero(b+1)}:00`
        ).join(' y ');
        forecastContent = `<div style="font-size:15px;font-weight:600;margin-bottom:4px">Era probable que se fuera entre las ${rangeTexts}…</div>
            <div style="font-size:13px;color:var(--text2)">pero no se fue. Sospechoso 👀 — igual podría irse a otra hora, estate pendiente.</div>`;
    } else {
        const levelColor = forecast.peakLevel === 'alto' ? 'var(--red-t)' : '#fdba74';
        const durationLine = forecast.estimatedMinutes
            ? `<div style="font-size:12px;color:var(--text2)">Duración esperada: <strong style="color:var(--text)">${formatDuration(forecast.estimatedMinutes)}</strong> (promedio histórico)</div>`
            : '';
        forecastContent = `
            <div style="font-size:15px;font-weight:600;margin-bottom:6px">${forecast.message}</div>
            <div style="font-size:12px;color:${levelColor};margin-bottom:${forecast.estimatedMinutes ? '4px' : '0'}">
                A las: ${padZero(forecast.peakHour)}:00 &middot; ${forecast.peakPercent}% &middot; riesgo ${forecast.peakLevel}
            </div>
            ${durationLine}`;
    }

    const statCards = [
        { label: 'Esta semana', value: formatDuration(statistics.weekMinutes),  sub: `${statistics.weekCount} cortes` },
        { label: 'Este mes',    value: formatDuration(statistics.monthMinutes), sub: `${statistics.monthCount} cortes` },
        { label: 'Este año',    value: formatDuration(statistics.yearMinutes),  sub: `${statistics.yearCount} cortes` },
        { label: 'Prom. diario',value: formatDuration(statistics.dailyAverage), sub: 'histórico' },
    ];
    const statsGrid = statCards.map(c =>
        `<div class="scard"><div class="sval">${c.value}</div><div class="slb">${c.label}</div><div class="ssub">${c.sub}</div></div>`
    ).join('');

    const fluctCards = [
        { label: 'Hoy',    value: statistics.fluctuationsToday },
        { label: 'Semana', value: statistics.fluctuationsThisWeek },
        { label: 'Mes',    value: statistics.fluctuationsThisMonth },
    ];
    const fluctGrid = fluctCards.map(c =>
        `<div class="scard"><div class="sval-ora">${c.value}</div><div class="slb">${c.label}</div></div>`
    ).join('');

    let recordCards = '';
    if (statistics.longestOutage || statistics.worstDay || statistics.peakHour !== null) {
        const longestCard = statistics.longestOutage ? `<div class="rcard">
            <div class="slabel">CORTE MÁS LARGO</div>
            <div class="rval">${formatDuration(statistics.longestOutage.duration_minutes)}</div>
            <div class="rsub">${formatDate(statistics.longestOutage.start)} &middot; ${formatTime(statistics.longestOutage.start)}&ndash;${formatTime(statistics.longestOutage.end)}</div>
        </div>` : '';

        const worstDayCard = statistics.worstDay ? `<div class="rcard">
            <div class="slabel">DÍA MÁS AFECTADO</div>
            <div class="rval" style="font-size:17px">${statistics.worstDay.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
            <div class="rsub" style="color:var(--amber2)">${formatDuration(statistics.worstDay.minutes)} &middot; ${statistics.worstDay.count} cortes</div>
        </div>` : '';

        const peakHourCard = statistics.peakHour !== null ? `<div class="rcard">
            <div class="slabel">HORA PICO HISTÓRICA</div>
            <div class="rval">${padZero(statistics.peakHour)}:00</div>
            <div class="rsub">más cortes registrados</div>
        </div>` : '';

        recordCards = `<div class="rgrid">${longestCard}${worstDayCard}${peakHourCard}</div>`;
    }

    let hourlyBars = '';
    if (heatmap) {
        const currentSlot = heatmap[`${now.getDay()}_${now.getHours()}`] || { probability: 0, confidence: 0 };
        const currentProb = adjustedProbability(currentSlot.probability, currentSlot.confidence);
        const bars = todayPredictions.map(({ hour, probability, confidence }) => {
            const prob    = adjustedProbability(probability, confidence);
            const isNow   = hour === now.getHours();
            const height  = Math.max(3, prob * 44);
            const bgColor = isNow ? '#f59e0b' : `rgba(239,68,68,${prob * 0.85 + 0.05})`;
            const outline = isNow ? 'outline:2px solid #f59e0b;outline-offset:1px' : '';
            const label   = hour % 6 === 0 ? `<span class="bl">${padZero(hour)}</span>` : '';
            return `<div class="bcol"><div class="b" style="height:${height}px;background:${bgColor};${outline}"></div>${label}</div>`;
        }).join('');

        const confidenceInfo = currentSlot.confidence >= 0.15
            ? ` &middot; ${Math.round(currentProb * 100)}%`
            : '';
        hourlyBars = `<div class="card card-last">
            <div class="slabel">DETALLE POR HORA — HOY</div>
            <div class="barwrap">${bars}</div>
            <div style="margin-top:8px;font-size:12px;color:#94a3b8">
                Ahora (${padZero(now.getHours())}:00):
                <span style="font-weight:600;color:${riskColor(currentProb)}">${riskLabel(currentProb, currentSlot.confidence)}${confidenceInfo}</span>
            </div>
        </div>`;
    }

    const emptyState = appState.outages.length === 0
        ? `<div class="empty">${ICONS.plugOff}<p>Sin registros. Toca + para comenzar.</p></div>`
        : '';

    const floatingButton = `<button class="fab ${appState.activeOutage ? 'fab-off' : 'fab-on'}" onclick="setCurrentTab('log')">${appState.activeOutage ? ICONS.bulb : ICONS.plus}</button>`;

    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowName = DAYS_FULL[tomorrow.getDay()].toUpperCase();
    let tomorrowContent;
    if (!tomorrowForecast) {
        tomorrowContent = `<div style="font-size:12px;color:var(--text3)">Sin datos suficientes.</div>`;
    } else if (tomorrowForecast.type === 'safe') {
        tomorrowContent = `<div style="font-size:13px;color:var(--grn-t)">&#10003; Sin riesgo significativo.</div>`;
    } else {
        const tmLevelColor = tomorrowForecast.peakLevel === 'alto' ? 'var(--red-t)' : '#fdba74';
        tomorrowContent = `
            <div style="font-size:13px;font-weight:600;margin-bottom:4px">${tomorrowForecast.ranges}</div>
            <div style="font-size:11px;color:${tmLevelColor}">${padZero(tomorrowForecast.peakHour)}:00 &middot; ${tomorrowForecast.peakPercent}% &middot; ${tomorrowForecast.peakLevel}</div>`;
    }

    return `
        <div class="forecast-card" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div>
                <div class="slabel">PRONÓSTICO — ${dayName}</div>
                ${forecastContent}
            </div>
            <div style="border-left:1px solid var(--border);padding-left:16px">
                <div class="slabel">MAÑANA — ${tomorrowName}</div>
                ${tomorrowContent}
            </div>
        </div>
        <div class="sgrid">${statsGrid}</div>
        <div class="card card-ora" style="margin-bottom:12px">
            <div class="slabel" style="color:var(--ora-t)">FLUCTUACIONES</div>
            <div class="sgrid3">${fluctGrid}</div>
        </div>
        ${recordCards}
        <div class="card" style="margin-bottom:12px">
            <div class="slabel">ÍNDICE DE ÁNIMO ANTE CORTES</div>
            ${buildMoodGauge(moodData)}
        </div>
        ${hourlyBars}
        ${emptyState}
        <div class="disclaimer">
            Herramienta independiente de uso personal. Los datos registrados son exclusivamente tuyos, cifrados en la base de datos y no se cruzan con ningún otro registro. Esta app no pertenece a ningún estudio sociológico, institución ni entidad gubernamental. La precisión de las predicciones mejora con la cantidad de datos registrados.
        </div>
        <div class="disclaimer" style="margin-top:8px;text-align:center">
            ¿Prefieres registrar desde el teléfono? Usa el bot de Telegram:
            <a href="https://t.me/RestosDeJuventudBot" target="_blank" style="color:var(--amber);text-decoration:none;font-weight:600">@RestosDeJuventudBot</a>
        </div>
        ${floatingButton}`;
}

function renderLogTab(minutesWithoutPower) {
    const { activeOutage, startDate, startTime, endDate, endTime, showManualForm, manualDate, manualStartTime, manualEndTime } = appState;

    const startCard = `<div class="card card-red">
        <div class="slabel">REGISTRAR SALIDA DE LUZ</div>
        <div class="trow">
            <div class="ff"><label>Fecha</label><input type="date" value="${startDate}" onchange="updateAppState('startDate', this.value)"></div>
            <div class="ff"><label>Hora</label>${buildTimePicker('startTime', startTime)}</div>
        </div>
        <button class="bmain bdanger" onclick="startOutage()">${ICONS.boltOff}Se fue la luz</button>
    </div>`;

    const endCard = `<div class="card card-red">
        <div class="abanner">
            <div class="al">Corte activo desde las ${formatTime(activeOutage ? activeOutage.start : '')}</div>
            <div class="ad">${formatDuration(minutesWithoutPower)} sin luz</div>
        </div>
        <div class="slabel">REGISTRAR REGRESO DE LUZ</div>
        <div class="trow-now">
            <div class="ff input-fecha">
                <label>Fecha</label>
                <input type="date" value="${endDate}" onchange="updateAppState('endDate', this.value)">
            </div>
            <div class="ff">
                <label>Hora</label>
                <div class="hora-action-group">
                    ${buildTimePicker('endTime', endTime)}
                    <button class="bnow" onclick="syncEndTimeToNow()">${ICONS.clock}Ahora</button>
                </div>
            </div>
        </div>
        ${buildMoodPicker()}
        <button class="bmain bsuccess" onclick="endOutage()">${ICONS.bulb}Volvió la luz</button>
    </div>`;

    let survivalCard = '';
    if (activeOutage) {
        const survivalData = computeSurvivalCurve(appState.outages);
        if (survivalData) {
            const { lambda, n } = survivalData;
            const pct     = Math.min((minutesWithoutPower / lambda) * 100, 100);
            const overdue = minutesWithoutPower > lambda;
            const checkpoints = [
                { label: '30 min', t: 30 },
                { label: '1h',     t: 60 },
                { label: '2h',     t: 120 },
                { label: '3h',     t: 180 },
                { label: '4h',     t: 240 },
                { label: '5h',     t: 300 },
            ];
            const cells = checkpoints.map(({ label, t }) => {
                const p     = Math.round((1 - Math.exp(-t / lambda)) * 100);
                const color = p >= 70 ? 'var(--grn-t)' : p >= 40 ? 'var(--amber2)' : 'var(--text2)';
                return `<div style="text-align:center;padding:8px 4px;background:var(--bg3);border-radius:var(--rs)">
                    <div style="font-size:15px;font-weight:700;color:${color}">${p}%</div>
                    <div style="font-size:10px;color:var(--text3);margin-top:2px">${label}</div>
                </div>`;
            }).join('');
            survivalCard = `<div class="card" style="margin-bottom:12px">
                <div class="slabel">ESTIMACIÓN DE RETORNO</div>
                <div style="margin-bottom:10px">
                    <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-bottom:5px">
                        <span>${overdue ? '⚠ Superó el promedio histórico' : 'Tiempo actual vs. duración promedio'}</span>
                        <span style="color:${overdue ? 'var(--red-t)' : 'var(--text2)'}">${formatDuration(minutesWithoutPower)} / ~${formatDuration(lambda)}</span>
                    </div>
                    <div style="height:8px;background:var(--bg3);border-radius:4px;overflow:hidden">
                        <div style="height:100%;width:${Math.min(pct, 100)}%;background:${overdue ? 'var(--red-bd)' : 'var(--amber)'};border-radius:4px"></div>
                    </div>
                </div>
                <div style="font-size:11px;color:var(--text2);margin-bottom:7px;font-weight:600;letter-spacing:.05em">PROBABILIDAD DE QUE VUELVA EN LOS PRÓXIMOS</div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px">${cells}</div>
                <div style="font-size:10px;color:var(--text3);line-height:1.5">Sin importar cuánto lleves esperando, estas probabilidades no cambian. · ${n} corte${n !== 1 ? 's' : ''} en historial.</div>
            </div>`;
        }
    }

    const fluctuationDisabled = !!activeOutage;
    const disabledWarning = `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(239,68,68,.1);border-radius:var(--rs);margin-bottom:10px;font-size:13px;color:var(--red-t)">
        <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.5;flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        No se pueden registrar fluctuaciones con un corte activo.
    </div>`;
    const fluctuationFields = `<p style="font-size:13px;color:var(--text2);margin-bottom:10px">Bajón, pico o microcorte que disparó el protector (&lt;1 min).</p>
        <div class="trow">
            <div class="ff"><label>Fecha</label><input type="date" value="${startDate}" onchange="updateAppState('startDate', this.value)"></div>
            <div class="ff"><label>Hora</label>${buildTimePicker('startTime', startTime)}</div>
        </div>`;

    const fluctuationCard = `<div class="card card-ora" style="${fluctuationDisabled ? 'opacity:.6' : ''}">
        <div class="slabel" style="color:var(--ora-t)">REGISTRAR FLUCTUACIÓN</div>
        ${fluctuationDisabled ? disabledWarning : fluctuationFields}
        <button id="fluctuation-button" class="bmain borange" ${fluctuationDisabled ? 'disabled' : 'onclick="recordFluctuation()"'}>${ICONS.zap}Registrar fluctuación</button>
    </div>`;

    let manualFormContent = '';
    if (showManualForm) {
        const manualStart    = new Date(`${manualDate}T${manualStartTime}`);
        const manualEnd      = new Date(`${manualDate}T${manualEndTime}`);
        const duration       = !isNaN(manualStart) && !isNaN(manualEnd) ? (manualEnd - manualStart) / 60000 : 0;
        const durationPreview = duration > 0
            ? `<div style="font-size:12px;color:#94a3b8;margin-bottom:10px">Duración: ${formatDuration(duration)}</div>`
            : '';
        manualFormContent = `<div style="margin-top:14px">
            <div class="trow3">
                <div class="field" style="margin:0"><label>Fecha</label><input type="date" value="${manualDate}" onchange="updateAppState('manualDate', this.value)"></div>
                <div class="field" style="margin:0"><label>Inicio</label>${buildTimePicker('manualStartTime', manualStartTime)}</div>
                <div class="field" style="margin:0"><label>Fin</label>${buildTimePicker('manualEndTime', manualEndTime)}</div>
            </div>
            ${durationPreview}
            ${buildMoodPicker()}
            <button class="bsm" onclick="saveManualOutage()">Guardar</button>
        </div>`;
    }

    const toggleIcon = showManualForm ? ICONS.chevUp : ICONS.chevDown;
    const manualCard = `<div class="card card-last">
        <button class="bghost" onclick="appState.showManualForm = !appState.showManualForm; render()">${toggleIcon}Registrar corte pasado completo</button>
        ${manualFormContent}
    </div>`;

    return (activeOutage ? endCard : startCard) + survivalCard + fluctuationCard + manualCard;
}

function renderPredictTab(now, heatmap, todayPredictions) {
    if (!heatmap) {
        return `<div class="empty">${ICONS.chart}<p>Necesitas al menos 1 corte para ver predicciones.</p></div>`;
    }

    const dayName = DAYS_FULL[now.getDay()].toUpperCase();

    const hourRows = todayPredictions
        .filter(p => p.hour >= 5 && p.hour <= 23)
        .map(({ hour, probability, confidence }) => {
            const prob          = adjustedProbability(probability, confidence);
            const isCurrentHour = hour === now.getHours();
            const percentText   = probability > 0 && confidence >= 0.15 ? `${Math.round(prob * 100)}%` : '—';
            return `<div class="prow ${isCurrentHour ? 'now' : ''}">
                <div class="phour ${isCurrentHour ? 'now' : ''}">${padZero(hour)}:00${isCurrentHour ? ' ◀' : ''}</div>
                <div class="ptrack"><div class="pfill" style="width:${Math.round(prob * 100)}%;background:${riskColor(prob)}"></div></div>
                <div class="ppct">${percentText}</div>
                <div class="plabel" style="color:${riskColor(prob)}">${riskLabel(prob, confidence)}</div>
            </div>`;
        }).join('');

    const heatmapRows = DAYS_SHORT.map((dayName, dayIndex) => {
        const isToday = dayIndex === now.getDay();
        const cells   = Array.from({ length: 24 }, (_, hour) => {
            const slot    = heatmap[`${dayIndex}_${hour}`] || { probability: 0, confidence: 0 };
            const prob    = adjustedProbability(slot.probability, slot.confidence);
            const isNow   = isToday && hour === now.getHours();
            const bgColor = prob < 0.03 ? 'rgba(255,255,255,.05)' : `rgba(239,68,68,${Math.min(prob * 2, 0.9)})`;
            const title   = `${dayName} ${padZero(hour)}:00 — ${Math.round(prob * 100)}%`;
            return `<div class="hmcell ${isNow ? 'now' : ''}" title="${title}" style="background:${bgColor}"></div>`;
        }).join('');
        return `<div class="hmrow">
            <div class="hmday ${isToday ? 'today' : ''}">${dayName}</div>
            <div class="hmcells">${cells}</div>
        </div>`;
    }).join('');

    const legendItems = [['Bajo', '0.2'], ['Medio', '0.5'], ['Alto', '0.85']].map(([label, opacity]) =>
        `<div style="display:flex;align-items:center;gap:3px">
            <div class="legbox" style="background:rgba(239,68,68,${opacity})"></div>
            <span style="font-size:10px;color:#475569">${label}</span>
        </div>`
    ).join('');

    return `<div class="card">
        <div class="slabel">HOY — ${dayName} — RIESGO POR HORA</div>
        ${hourRows}
    </div>
    <div class="card card-last">
        <div class="slabel">MAPA DE CALOR SEMANAL</div>
        <div class="hmwrap"><div class="hm">
            <div class="hmhours">${[0, 4, 8, 12, 16, 20].map(h => `<span>${padZero(h)}</span>`).join('')}</div>
            ${heatmapRows}
            <div class="hmleg"><span style="font-size:10px;color:#475569">Riesgo:</span>${legendItems}</div>
            <div class="infobox">Solo cortes alimentan el modelo. La columna derecha muestra duración estimada en horas de riesgo real.</div>
            <div class="infobox" style="margin-top:4px">El modelo considera los últimos 3 meses de registros para mantener los patrones actualizados.</div>
        </div></div>
    </div>`;
}

function renderCommunityTab(now) {
    if (!communityState.data && !communityState.isLoading) {
        refreshCommunity();
        return `<div class="empty"><p>Cargando...</p></div>`;
    }
    if (communityState.isLoading) return `<div class="empty"><p>Cargando...</p></div>`;

    const { active: activeUsers, todayOutages, totals } = communityState.data;
    const myCity = authState.currentUser?.city || '';

    const totalsGrid = `<div class="community-totals-grid">
        <div class="scard"><div class="sval-grn">${totals.total_users}</div><div class="slb">Usuarios registrados</div></div>
        <div class="scard"><div class="${totals.active_now > 0 ? 'sval-ora' : 'sval-grn'}">${totals.active_now}</div><div class="slb">Sin luz ahora</div></div>
    </div>`;

    let activeUsersCard;
    if (activeUsers.length > 0) {
        const userRows = activeUsers.map(user => {
            const minutesActive = (now - new Date(user.start_time)) / 60000;
            const isMe = user.username === authState.currentUser?.username;
            const meTag = isMe ? ' <span class="community-me-tag">(tú)</span>' : '';
            return `<div class="comm-user">
                <div class="comm-dot"></div>
                <div class="community-user-info">
                    <div class="community-user-name">@${user.username}${meTag}</div>
                    <div class="community-user-location">${user.city}${user.zone ? ' · ' + user.zone : ''}</div>
                </div>
                <div class="community-user-elapsed">${formatDuration(minutesActive)}</div>
            </div>`;
        }).join('');
        activeUsersCard = `<div class="card" style="margin-bottom:12px"><div class="slabel">SIN LUZ AHORA</div>${userRows}</div>`;
    } else {
        activeUsersCard = `<div class="card card-grn" style="margin-bottom:12px"><div style="font-size:14px;color:var(--grn-t)">&#10003; Nadie sin luz ahora mismo.</div></div>`;
    }

    let cityTimelineCard = '';
    if (todayOutages && todayOutages.length > 0) {
        const grouped = {};
        todayOutages.forEach(row => {
            const key = `${row.city}||${row.zone}`;
            if (!grouped[key]) grouped[key] = { city: row.city, zone: row.zone, outages: [] };
            grouped[key].outages.push(row);
        });

        const cityZoneKeys = Object.keys(grouped).sort((a, b) => {
            const cityA = grouped[a].city, cityB = grouped[b].city;
            if (cityA === myCity && cityB !== myCity) return -1;
            if (cityB === myCity && cityA !== myCity) return 1;
            return cityA.localeCompare(cityB);
        });

        const citiesMap = {};
        const cityOrder = [];
        cityZoneKeys.forEach(key => {
            const { city, zone, outages } = grouped[key];
            if (!citiesMap[city]) { citiesMap[city] = []; cityOrder.push(city); }
            citiesMap[city].push({ zone, outages });
        });

        const blocks = cityOrder.map(city => {
            const isMyCity = city === myCity;
            const zoneBlocks = citiesMap[city].map(({ zone, outages }) => {
                const totalMins = outages.reduce((s, o) => s + (o.duration_minutes || 0), 0);
                const outageItems = outages.map(o =>
                    `<div class="community-outage-item">
                        <span class="community-outage-time">${formatTime(o.start_time)} – ${formatTime(o.end_time)}</span>
                        <span class="community-outage-dur">${formatDuration(o.duration_minutes)}</span>
                    </div>`
                ).join('');
                return `<div class="community-zone-block">
                    <div class="community-zone-header">
                        <span class="community-zone-name">${zone}</span>
                        <span class="community-zone-summary">${outages.length} corte${outages.length !== 1 ? 's' : ''} · ${formatDuration(totalMins)}</span>
                    </div>
                    <div class="community-outage-list">${outageItems}</div>
                </div>`;
            }).join('');
            return `<div class="community-city-block">
                <div class="community-city-name ${isMyCity ? 'community-city-mine' : ''}">${isMyCity ? '📍 ' : ''}${city}</div>
                ${zoneBlocks}
            </div>`;
        }).join('');

        cityTimelineCard = `<div class="card card-last"><div class="slabel">HOY POR CIUDAD Y ZONA</div>${blocks}</div>`;
    }

    return totalsGrid + activeUsersCard + cityTimelineCard + `<button class="bmore" onclick="refreshCommunity()">&#8635; Actualizar</button>`;
}

function renderHistoryTab(now) {
    const completedOutages = appState.outages.filter(o => o.end && (o.type || 'corte') === 'corte');
    const fluctuations     = appState.outages.filter(o => (o.type || 'corte') === 'fluctuacion');
    const totalMinutes     = completedOutages.reduce((sum, o) => sum + (o.duration_minutes || 0), 0);

    const summary = `<div style="font-size:13px;color:#94a3b8;margin-bottom:12px">
        ${completedOutages.length} corte${completedOutages.length !== 1 ? 's' : ''}
        &middot; ${formatDuration(totalMinutes)} sin luz
        &middot; ${fluctuations.length} fluctuación${fluctuations.length !== 1 ? 'es' : ''}
    </div>`;

    if (appState.outages.length === 0) {
        return summary + `<div class="empty">${ICONS.history}<p>Sin registros aún.</p></div>`;
    }

    const visibleOutages = appState.outages.slice(0, appState.historyPage * HISTORY_PAGE_SIZE);
    const hasMorePages   = appState.outages.length > visibleOutages.length;
    const remainingCount = appState.outages.length - visibleOutages.length;

    const outageRows = visibleOutages.map(outage => {
        const isFluctuation   = (outage.type || 'corte') === 'fluctuacion';
        const isActive        = appState.activeOutage && outage.id === appState.activeOutage.id;
        const activeMinutes   = isActive ? (now - new Date(outage.start)) / 60000 : 0;
        const moodOption      = outage.mood ? MOOD_OPTIONS.find(m => m.value === outage.mood) : null;
        const isPendingDelete = appState.confirmDeleteId === outage.id;

        const moodEmoji    = moodOption ? `<span title="${moodOption.label}" style="font-size:14px">${moodOption.emoji}</span>` : '';
        const fluctuationTag = isFluctuation ? `<span class="tag tag-fluc">FLUCTUACIÓN</span>` : '';
        const timeRange    = isFluctuation ? '' : ` &ndash; ${outage.end ? formatTime(outage.end) : 'en curso'}`;
        const durationText = isFluctuation
            ? `<div class="hdur-fluc">&#9889;</div>`
            : `<div class="hdur">
                ${outage.end ? formatDuration(outage.duration_minutes) : formatDuration(activeMinutes)}
                ${!outage.end ? '<div class="hactive">en curso</div>' : ''}
              </div>`;

        const deleteControls = isPendingDelete
            ? `<div style="display:flex;gap:4px">
                <button class="byes" onclick="deleteOutage('${outage.id}')">Sí</button>
                <button class="bno" onclick="cancelDeleteRequest()">No</button>
              </div>`
            : `<button class="bicon" onclick="requestDeleteConfirmation('${outage.id}')">${ICONS.trash}</button>`;

        return `<div class="hitem ${isFluctuation ? 'hitem-fluc' : ''}">
            <div class="hmeta">
                <div class="hdate">${formatDate(outage.start)}${fluctuationTag}${moodEmoji}</div>
                <div class="htime">${formatTime(outage.start)}${timeRange}</div>
            </div>
            ${durationText}
            ${deleteControls}
        </div>`;
    }).join('');

    const loadMoreButton = hasMorePages
        ? `<button class="bmore" onclick="appState.historyPage++; render()">Cargar ${Math.min(remainingCount, HISTORY_PAGE_SIZE)} más &middot; ${remainingCount} restantes</button>`
        : '';

    return summary + `<div class="hlist">${outageRows}</div>` + loadMoreButton;
}

function renderProfileOverlay() {
    const stats = profileState.profileData?.stats;

    let content;
    if (profileState.isLoading) {
        content = `<p style="color:var(--text3);font-size:14px">Cargando...</p>`;
    } else if (profileState.profileData) {
        const savedMessage    = profileState.changesSaved   ? `<div style="color:var(--grn-t);font-size:13px;margin-bottom:10px">&#10003; Cambios guardados</div>` : '';
        const passwordSuccess = profileState.passwordUpdated ? `<div style="color:var(--grn-t);font-size:13px;margin-bottom:8px">&#10003; Contraseña actualizada</div>` : '';
        const passwordError   = profileState.passwordError   ? `<div class="auth-err">${profileState.passwordError}</div>` : '';
        const deleteConfirm   = profileState.confirmDelete
            ? `<div style="font-size:13px;color:var(--red-t);margin-bottom:8px;font-weight:600">¿Seguro? Se borrarán ${stats.total_cortes} cortes y ${stats.total_flucs} fluctuaciones.</div>
               <div style="display:flex;gap:8px">
                   <button class="byes" onclick="deleteAccount()">Sí, borrar todo</button>
                   <button class="bno" onclick="profileState.confirmDelete = false; render()">Cancelar</button>
               </div>`
            : `<button class="bdel-account" onclick="deleteAccount()">Borrar mi cuenta</button>`;

        content = `<div class="sgrid3" style="margin-bottom:16px">
            <div class="scard"><div class="sval" style="font-size:16px">${stats.total_cortes}</div><div class="slb">Cortes</div></div>
            <div class="scard"><div class="sval" style="font-size:16px">${formatDuration(stats.total_mins)}</div><div class="slb">Sin luz</div></div>
            <div class="scard"><div class="sval-ora" style="font-size:16px">${stats.total_flucs}</div><div class="slb">Fluctuac.</div></div>
        </div>
        <div class="trow" style="margin-bottom:12px">
            <div class="field" style="margin:0"><label>Ciudad</label>
                <input value="${profileState.editCity}" oninput="profileState.editCity = this.value" placeholder="Caracas">
            </div>
            <div class="field" style="margin:0"><label>Zona</label>
                ${buildZoneSelect('profileState.editZone', profileState.editZone)}
            </div>
        </div>
        <div class="toggle-row" style="margin-bottom:14px">
            <div>
                <div style="font-size:14px">Perfil público</div>
                <div style="font-size:12px;color:var(--text2)">Tu actividad es visible en Comunidad</div>
            </div>
            <button class="toggle ${profileState.isPublic ? 'on' : 'off'}" onclick="profileState.isPublic = !profileState.isPublic; render()"></button>
        </div>
        <details style="margin-bottom:14px">
            <summary style="cursor:pointer;font-size:13px;color:var(--text2);padding:8px 0">Cambiar contraseña</summary>
            <div style="margin-top:10px">
                <div class="field"><label>Contraseña actual</label>
                    <input type="password" value="${profileState.currentPassword}" oninput="profileState.currentPassword = this.value">
                </div>
                <div class="field"><label>Nueva contraseña</label>
                    <input type="password" value="${profileState.newPassword}" oninput="profileState.newPassword = this.value">
                </div>
                ${passwordError}${passwordSuccess}
            </div>
        </details>
        ${savedMessage}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <button class="bsm" onclick="saveProfile()">Guardar cambios</button>
            <a class="bsm" href="/api/export" download>${ICONS.download}Exportar CSV</a>
            <button class="bsm" style="color:var(--red-t);border-color:var(--red-bd)" onclick="logout()">${ICONS.logout}Cerrar sesión</button>
            ${authState.currentUser?.username === 'brandon' ? `<a class="bsm" href="/api/admin" target="_blank" style="color:var(--amber);border-color:var(--amber)"><svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Admin</a>` : ''}
        </div>
        <div class="danger-zone">
            <div class="danger-title">ZONA DE PELIGRO</div>
            <div class="danger-desc">Borra tu cuenta y todos tus registros permanentemente. Sin vuelta atrás.</div>
            ${deleteConfirm}
        </div>`;
    }

    return `<div class="overlay" onclick="if (event.target.classList.contains('overlay')) { profileState.isOpen = false; render(); }">
        <div class="overlay-card">
            <div class="overlay-header">
                <div class="overlay-title">@${authState.currentUser.username}</div>
                <button class="bicon" onclick="profileState.isOpen = false; render()">${ICONS.close}</button>
            </div>
            ${content}
        </div>
    </div>`;
}

function setCurrentTab(tab) {
    appState.currentTab      = tab;
    appState.confirmDeleteId = null;
    appState.historyPage     = 1;
    appState.startDate       = getTodayDate();
    appState.startTime       = getCurrentTime();
    if (tab === 'community' && !communityState.data) refreshCommunity();
    render();
}

function updateAppState(key, value) {
    appState[key] = value;
    render();
}

function updateAuthState(key, value) {
    authState[key]        = value;
    authState.errorMessage = '';
    render();
}

function setTimeHour(stateKey, hour) {
    const parts       = (appState[stateKey] || '00:00').split(':');
    appState[stateKey] = `${hour}:${parts[1] || '00'}`;
    render();
}

function setTimeMinute(stateKey, minute) {
    const parts       = (appState[stateKey] || '00:00').split(':');
    appState[stateKey] = `${parts[0] || '00'}:${minute}`;
    render();
}

function requestDeleteConfirmation(id) {
    appState.confirmDeleteId = id;
    render();
}

function cancelDeleteRequest() {
    appState.confirmDeleteId = null;
    render();
}

function syncEndTimeToNow() {
    appState.endDate = getTodayDate();
    appState.endTime = getCurrentTime();
    render();
}

window.addEventListener('beforeunload', e => {
    if (appState.activeOutage) { e.preventDefault(); e.returnValue = ''; }
});

initialize();
