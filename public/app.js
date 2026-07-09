async function initialize() {
    const params     = new URLSearchParams(window.location.search);
    const resetToken = params.get('reset');
    if (resetToken) {
        authState.resetToken  = resetToken;
        authState.resetMode   = true;
        authState.isLoading   = false;
        window.history.replaceState({}, '', '/');
        render();
        return;
    }
    try {
        const user = await http.get('/api/auth/me');
        authState.currentUser  = user;
        authState.sessionExpiry = user.expiresAt || null;
        authState.isLoading    = false;
        await loadApplicationData();
    } catch {
        authState.isLoading = false;
        render();
    }
    setInterval(checkSessionExpiry, 60000);
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
        Notification.requestPermission().then(perm => {
            if (perm === 'granted') registerPushSubscription();
        });
    } else if ('Notification' in window && Notification.permission === 'granted') {
        registerPushSubscription();
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
    authState.currentUser  = body.user;
    authState.sessionExpiry = body.expiresAt || null;
    await loadApplicationData();
}

async function register() {
    authState.errorMessage = '';
    const response = await http.post('/api/auth/register', authState.registerForm);
    const body     = await response.json();
    if (!response.ok) { authState.errorMessage = body.error; render(); return; }
    authState.currentUser  = body.user;
    authState.sessionExpiry = body.expiresAt || null;
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
    if (!appState.selectedMood) { showToast('Selecciona cómo te sientes antes de registrar el regreso.', 'warn'); return; }
    const endTime   = new Date(`${appState.endDate}T${appState.endTime}`);
    const startTime = new Date(appState.activeOutage.start);
    if (endTime <= startTime) {
        showToast(`La hora de regreso (${appState.endTime}) debe ser posterior a la salida (${formatTime(appState.activeOutage.start)}). Usa el botón "Ahora".`, 'warn');
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
    if (!response.ok) { showToast('Error al guardar. Reintenta.', 'error'); return; }
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
    if (appState.activeOutage) { showToast('No es posible registrar una fluctuación mientras hay un corte activo.', 'warn'); return; }
    const isoTime     = new Date(`${appState.startDate}T${appState.startTime}`).toISOString();
    const fluctuation = { id: generateId(), start: isoTime, end: isoTime, duration_minutes: 0, type: 'fluctuacion' };
    const response    = await http.post('/api/outages', fluctuation);
    if (!response.ok) { showToast('Error al registrar. Reintenta.', 'error'); return; }
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
    if (!manualDate) { showToast('Completa todos los campos', 'warn'); return; }
    if (!appState.selectedMood) { showToast('Selecciona cómo te sientes antes de guardar.', 'warn'); return; }
    const startTime = new Date(`${manualDate}T${manualStartTime}`);
    let endTime   = new Date(`${manualDate}T${manualEndTime}`);
    if (!isNaN(startTime) && !isNaN(endTime) && endTime <= startTime) {
        const nextDay = new Date(startTime);
        nextDay.setDate(nextDay.getDate() + 1);
        endTime = new Date(`${nextDay.toISOString().slice(0, 10)}T${manualEndTime}`);
    }
    if (isNaN(startTime) || isNaN(endTime) || endTime <= startTime) {
        showToast('La hora de fin debe ser posterior al inicio', 'warn');
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
    if (!response.ok) { showToast('Error al guardar. Reintenta.', 'error'); return; }
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
    if (!response.ok) { showToast('Error al borrar. Reintenta.', 'error'); return; }
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
    profileState.editCity    = VENEZUELA_CITIES.includes(data.city) ? data.city : '';
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
    if (!response.ok) { showToast('Error al borrar la cuenta. Reintenta.', 'error'); return; }
    authState.currentUser = null;
    appState.outages      = [];
    appState.activeOutage = null;
    profileState.isOpen   = false;
    render();
}

async function generateTelegramToken() {
    profileState.telegramTokenLoading = true;
    profileState.telegramToken = '';
    render();
    try {
        const response = await http.post('/api/auth/telegram-token', {});
        profileState.telegramTokenLoading = false;
        if (!response.ok) {
            const body = await response.json();
            profileState.passwordError = body.error || 'Error al generar código';
            render();
            return;
        }
        const body = await response.json();
        profileState.telegramToken = body.token;
        profileState.telegramTokenExpiry = new Date(body.expiresAt);
    } catch {
        profileState.telegramTokenLoading = false;
        profileState.passwordError = 'Error de red. Reintenta.';
    }
    render();
}

async function unlinkTelegram() {
    try {
        const response = await http.post('/api/auth/telegram-unlink', {});
        if (!response.ok) {
            const body = await response.json();
            profileState.passwordError = body.error || 'Error al desvincular';
            render();
            showToast(profileState.passwordError, 'error');
            return;
        }
        profileState.profileData.has_telegram = false;
        profileState.profileData.telegram_chat_id = null;
        profileState.telegramToken = null;
        profileState.telegramTokenExpiry = null;
        profileState.passwordError = '';
        showToast('Telegram desvinculado', 'success');
    } catch {
        profileState.passwordError = 'Error de red. Reintenta.';
        showToast(profileState.passwordError, 'error');
    }
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

function startEditOutage(outage) {
    const s = new Date(outage.start);
    const e = outage.end ? new Date(outage.end) : null;
    appState.editOutageId  = outage.id;
    appState.editDate      = s.toLocaleDateString('en-CA');
    appState.editStartTime = `${padZero(s.getHours())}:${padZero(s.getMinutes())}`;
    appState.editEndTime   = e ? `${padZero(e.getHours())}:${padZero(e.getMinutes())}` : '00:00';
    appState.editMood      = outage.mood || null;
    appState.editNotes     = outage.notes || '';
    appState.confirmDeleteId = null;
    render();
}

function cancelEdit() { appState.editOutageId = null; render(); }

async function saveEditOutage() {
    const { editOutageId, editDate, editStartTime, editEndTime, editMood, editNotes } = appState;
    const startTime = new Date(`${editDate}T${editStartTime}`);
    let endTime = new Date(`${editDate}T${editEndTime}`);
    if (!isNaN(startTime) && !isNaN(endTime) && endTime <= startTime) {
        const nextDay = new Date(startTime);
        nextDay.setDate(nextDay.getDate() + 1);
        endTime = new Date(`${nextDay.toISOString().slice(0, 10)}T${editEndTime}`);
    }
    if (isNaN(startTime) || isNaN(endTime) || endTime <= startTime) {
        showToast('La hora de fin debe ser posterior al inicio', 'warn');
        return;
    }
    const updated = {
        id: editOutageId,
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        duration_minutes: (endTime - startTime) / 60000,
        type: 'corte',
        mood: editMood,
        notes: editNotes.trim() || null,
    };
    const response = await http.post('/api/outages', updated);
    if (!response.ok) { showToast('Error al guardar. Reintenta.', 'error'); return; }
    const idx = appState.outages.findIndex(o => o.id === editOutageId);
    if (idx !== -1) appState.outages[idx] = { ...appState.outages[idx], ...updated };
    appState.editOutageId = null;
    render();
}

function togglePasswordVisibility(id) {
    const input = document.getElementById(id);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
}

async function resetPassword() {
    authState.resetError = '';
    if (!authState.resetPassword || authState.resetPassword.length < 6) {
        authState.resetError = 'Mínimo 6 caracteres';
        render();
        return;
    }
    const response = await http.post('/api/auth/reset-password', {
        token: authState.resetToken,
        password: authState.resetPassword,
    });
    const body = await response.json();
    if (!response.ok) { authState.resetError = body.error; render(); return; }
    authState.resetSuccess = true;
    authState.resetMode    = false;
    authState.resetToken   = '';
    authState.resetPassword = '';
    render();
}

async function refreshToken() {
    try {
        const response = await http.post('/api/auth/refresh', {});
        if (!response.ok) {
            authState.sessionExpiring = true;
            render();
            return false;
        }
        const body = await response.json();
        authState.sessionExpiry   = body.expiresAt;
        authState.sessionExpiring = false;
        authState.sessionExpired  = false;
        render();
        return true;
    } catch {
        authState.sessionExpiring = true;
        render();
        return false;
    }
}

function checkSessionExpiry() {
    if (!authState.sessionExpiry) return;
    const remaining = new Date(authState.sessionExpiry) - Date.now();
    if (remaining <= 0) {
        authState.sessionExpired  = true;
        authState.sessionExpiring = false;
        render();
        return;
    }
    if (remaining < 86400000) {
        if (!authState.sessionExpiring) {
            authState.sessionExpiring = true;
            render();
        }
        refreshToken();
    }
}

window.addEventListener('beforeunload', e => {
    if (appState.activeOutage) { e.preventDefault(); e.returnValue = ''; }
});

async function registerPushSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const VAPID_PUBLIC_KEY = window.VAPID_PUBLIC_KEY;
    if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY === 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY') return;
    try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) return;
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        await http.post('/api/push', { subscription: sub.toJSON() });
    } catch (e) {
        console.error('Push subscription failed', e);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}

async function unsubscribePush() {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
    }
    await http.delete('/api/push');
}

initialize();
