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

function checkRiskNotification() {
    if (!appState.outages.length || appState.activeOutage) return;
    if (Notification.permission !== 'granted') return;
    const now  = new Date();
    const hour = now.getHours();
    if (hour === lastNotifiedHour) return;
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const hadOutageToday = appState.outages.some(o =>
        o.end && (o.type || 'corte') === 'corte' && new Date(o.start) >= startOfToday
    );
    if (hadOutageToday) return;
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
        notes:            appState.endNotes.trim() || null,
    };
    const response = await http.post('/api/outages', completedOutage);
    if (!response.ok) { alert('Error al guardar. Reintenta.'); return; }
    await http.delete('/api/active');
    appState.outages.unshift(completedOutage);
    appState.activeOutage = null;
    appState.endDate      = getTodayDate();
    appState.endTime      = getCurrentTime();
    appState.selectedMood = null;
    appState.endNotes     = '';
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
        notes:            appState.manualNotes.trim() || null,
    };
    const response = await http.post('/api/outages', outage);
    if (!response.ok) { alert('Error al guardar. Reintenta.'); return; }
    appState.outages.unshift(outage);
    appState.outages.sort((a, b) => new Date(b.start) - new Date(a.start));
    appState.manualStartTime = '00:00';
    appState.manualEndTime   = '00:00';
    appState.showManualForm  = false;
    appState.selectedMood    = null;
    appState.manualNotes     = '';
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
    profileState.isOpen               = true;
    profileState.isLoading            = true;
    profileState.passwordError        = '';
    profileState.passwordUpdated      = false;
    profileState.changesSaved         = false;
    profileState.confirmDelete        = false;
    profileState.telegramToken        = null;
    profileState.telegramTokenExpiry  = null;
    profileState.telegramTokenLoading = false;
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

async function generateTelegramToken() {
    profileState.telegramTokenLoading = true;
    render();
    const response = await http.post('/api/auth/telegram-token', {});
    if (response.ok) {
        const body = await response.json();
        profileState.telegramToken       = body.token;
        profileState.telegramTokenExpiry = new Date(body.expiresAt);
    }
    profileState.telegramTokenLoading = false;
    render();
}

async function unlinkTelegram() {
    const response = await http.post('/api/auth/telegram-unlink', {});
    if (!response.ok) { alert('Error al desvincular. Reintenta.'); return; }
    profileState.profileData.has_telegram = false;
    profileState.telegramToken            = null;
    profileState.telegramTokenExpiry      = null;
    render();
}

async function refreshCommunity() {
    communityState.isLoading = true;
    render();
    communityState.data      = await http.get('/api/community');
    communityState.isLoading = false;
    render();
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

function updateAppState(key, value) { appState[key] = value; render(); }
function updateAuthState(key, value) { authState[key] = value; authState.errorMessage = ''; render(); }

function setTimeHour(stateKey, hour) {
    const parts = (appState[stateKey] || '00:00').split(':');
    appState[stateKey] = `${hour}:${parts[1] || '00'}`;
    render();
}

function setTimeMinute(stateKey, minute) {
    const parts = (appState[stateKey] || '00:00').split(':');
    appState[stateKey] = `${parts[0] || '00'}:${minute}`;
    render();
}

function requestDeleteConfirmation(id) { appState.confirmDeleteId = id; render(); }
function cancelDeleteRequest() { appState.confirmDeleteId = null; render(); }
function syncEndTimeToNow() { appState.endDate = getTodayDate(); appState.endTime = getCurrentTime(); render(); }

window.addEventListener('beforeunload', e => {
    if (appState.activeOutage) { e.preventDefault(); e.returnValue = ''; }
});

initialize();
