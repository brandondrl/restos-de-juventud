function buildMoodPicker() {
    const buttons = MOOD_OPTIONS.map(mood => {
        const isSelected  = appState.selectedMood === mood.value;
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
        <div style="font-size:12px;color:var(--text2);margin-bottom:6px">¿Cómo te sientes con este corte?</div>
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
        const s1 = startAngle - GAP_DEGREES, e1 = endAngle + GAP_DEGREES;
        const f  = v => v.toFixed(2);
        const [ox1,oy1] = polarPoint(s1, outerR), [ox2,oy2] = polarPoint(e1, outerR);
        const [ix1,iy1] = polarPoint(s1, innerR),  [ix2,iy2] = polarPoint(e1, innerR);
        return `<path d="M ${f(ox1)} ${f(oy1)} A ${outerR} ${outerR} 0 0 0 ${f(ox2)} ${f(oy2)} L ${f(ix2)} ${f(iy2)} A ${innerR} ${innerR} 0 0 1 ${f(ix1)} ${f(iy1)} Z" fill="${color}" opacity="${opacity}"/>`;
    }
    const opacity  = moodData ? '0.92' : '0.18';
    const segments = MOOD_OPTIONS.map((mood, i) => arcSegment(180 - i * 36, 180 - (i + 1) * 36, mood.color, opacity)).join('');
    if (!moodData) {
        return `<svg viewBox="0 0 200 125" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:240px;display:block;margin:0 auto">
            ${segments}
            <circle cx="${cx}" cy="${cy}" r="5" fill="#1e293b" stroke="#334155" stroke-width="2"/>
            <text x="${cx}" y="108" text-anchor="middle" fill="#475569" font-size="12" font-family="system-ui">Sin datos aún</text>
            <text x="${cx}" y="122" text-anchor="middle" fill="#334155" font-size="10" font-family="system-ui">Registra tu estado de ánimo para verlo aquí</text>
        </svg>`;
    }
    const { average, totalCount } = moodData;
    const needleAngle  = 180 - ((average - 1) / 4) * 180;
    const [nx, ny]     = polarPoint(needleAngle, needleLen);
    const moodIndex    = Math.min(4, Math.max(0, Math.round(average) - 1));
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

function buildConsecutiveOutageCard(outages) {
    const status = getConsecutiveOutageStatus(outages);
    if (!status) return '';
    const color = status.level === 'bajo' ? 'var(--grn-t)' : status.level === 'moderado' ? 'var(--amber2)' : 'var(--red-t)';
    return `<div class="card" style="margin-bottom:12px">
        <div class="slabel">RIESGO DE DOBLE CORTE</div>
        <div style="display:flex;align-items:baseline;gap:8px">
            <span style="font-size:28px;font-weight:700;color:${color}">${status.percent}%</span>
            <span style="font-size:12px;color:var(--text2)">de otro corte en las próximas ${status.hoursAhead}h</span>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">Basado en tus últimos ${status.sampleSize} cortes consecutivos</div>
    </div>`;
}

function buildRiskCurve(todayPredictions, now) {
    const W = 320, H = 90, pad = 4;
    const max = Math.max(0.05, ...todayPredictions.map(p => adjustedProbability(p.probability, p.confidence)));
    const points = todayPredictions.map((p, i) => ({
        x: pad + i * (W - 2 * pad) / 23,
        y: H - pad - (adjustedProbability(p.probability, p.confidence) / max) * (H - 2 * pad),
    }));
    let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
        const mx = (points[i - 1].x + points[i].x) / 2;
        const my = (points[i - 1].y + points[i].y) / 2;
        path += ` Q ${points[i - 1].x.toFixed(1)} ${points[i - 1].y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
    }
    path += ` T ${points[points.length - 1].x.toFixed(1)} ${points[points.length - 1].y.toFixed(1)}`;
    const areaPath = `${path} L ${points[points.length - 1].x.toFixed(1)} ${H - pad} L ${points[0].x.toFixed(1)} ${H - pad} Z`;
    const peakIndex = todayPredictions.reduce((peak, p, i) =>
        adjustedProbability(p.probability, p.confidence) > adjustedProbability(todayPredictions[peak].probability, todayPredictions[peak].confidence) ? i : peak, 0);
    const peakPoint = points[peakIndex];
    const nowPoint = points[now.getHours()];
    const hourLabels = [0, 6, 12, 18].map(h =>
        `<text x="${(pad + h * (W - 2 * pad) / 23).toFixed(1)}" y="${H + 10}" fill="#475569" font-size="9" text-anchor="middle">${padZero(h)}</text>`
    ).join('');
    return `<svg viewBox="0 0 ${W} ${H + 16}" style="width:100%;display:block">
        <defs><linearGradient id="riskCurveGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
        </linearGradient></defs>
        <path d="${areaPath}" fill="url(#riskCurveGradient)"/>
        <path d="${path}" fill="none" stroke="#f59e0b" stroke-width="2"/>
        <line x1="${nowPoint.x.toFixed(1)}" y1="${pad}" x2="${nowPoint.x.toFixed(1)}" y2="${H - pad}" stroke="#475569" stroke-width="1" stroke-dasharray="2,2"/>
        <circle cx="${peakPoint.x.toFixed(1)}" cy="${peakPoint.y.toFixed(1)}" r="3.5" fill="#e24b4a"/>
        ${hourLabels}
    </svg>`;
}

function buildTelegramSection() {
    const { profileData, telegramToken, telegramTokenExpiry, telegramTokenLoading } = profileState;
    if (!profileData) return '';
    if (profileData.has_telegram) {
        return `<div class="toggle-row">
            <div>
                <div style="font-size:14px;color:var(--grn-t)">&#10003; Telegram vinculado</div>
                <div style="font-size:12px;color:var(--text3)">@RestosDeJuventudBot</div>
            </div>
            <button class="bno" style="font-size:12px;padding:5px 12px" onclick="unlinkTelegram()">Desvincular</button>
        </div>`;
    }
    if (telegramToken) {
        const expiryText = telegramTokenExpiry
            ? telegramTokenExpiry.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
            : '';
        const deepLink = `https://t.me/RestosDeJuventudBot?start=${telegramToken}`;
        return `<div style="padding:12px 0;border-bottom:1px solid var(--border)">
            <div style="font-size:12px;color:var(--text2);margin-bottom:8px">
                Código de vinculación
                <span style="color:var(--text3);margin-left:6px">expira a las ${expiryText}</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                <div style="font-size:26px;font-weight:700;letter-spacing:6px;color:var(--amber);font-family:monospace">${escapeHtml(telegramToken)}</div>
                <button class="bsm" onclick="navigator.clipboard.writeText('${escapeHtml(telegramToken)}').then(() => { this.textContent = '✓ Copiado'; setTimeout(() => this.textContent = 'Copiar', 1500) })">Copiar</button>
            </div>
            <a class="bsm" href="${deepLink}" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
                Abrir bot en Telegram
            </a>
            <div style="font-size:11px;color:var(--text3);margin-top:6px">Al abrir el bot, el código se enviará automáticamente.</div>
        </div>`;
    }
    return `<div style="padding:12px 0;border-bottom:1px solid var(--border)">
        <button class="bsm" onclick="generateTelegramToken()" ${telegramTokenLoading ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
            ${telegramTokenLoading ? 'Generando...' : 'Vincular Telegram'}
        </button>
        <div style="font-size:11px;color:var(--text3);margin-top:5px">Recibe alertas y registra cortes sin abrir la app.</div>
    </div>`;
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
    if (authState.resetMode) {
        const resetErrorBanner = authState.resetError
            ? `<div class="auth-err">${escapeHtml(authState.resetError)}</div>`
            : '';
        return `<div class="auth-wrap"><div class="auth-card">
            <div class="auth-logo">
                <svg viewBox="0 0 24 24" style="width:26px;height:26px;stroke:#f59e0b;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <div>
                    <div class="auth-title">Nueva contraseña</div>
                    <div style="font-size:12px;color:var(--text2)">Restos de Juventud</div>
                </div>
            </div>
            ${resetErrorBanner}
            <div class="field"><label>Contraseña nueva <span style="color:var(--text3)">(mín. 6 caracteres)</span></label>
                <div style="position:relative">
                    <input id="reset-pass" type="password" value="${escapeHtml(authState.resetPassword)}"
                        oninput="authState.resetPassword = this.value"
                        onkeydown="if (event.key === 'Enter') resetPassword()"
                        style="padding-right:40px;width:100%">
                    <button type="button" class="bicon" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);border:none;background:none;width:28px;height:28px"
                        onclick="togglePasswordVisibility('reset-pass')">${ICONS.eye}</button>
                </div>
            </div>
            <button class="bmain bdanger" onclick="resetPassword()">${ICONS.bolt}Cambiar contraseña</button>
        </div></div>`;
    }
    const isLoginTab  = authState.activeTab === 'login';
    const errorBanner = authState.errorMessage
        ? `<div class="auth-err">${escapeHtml(authState.errorMessage)}</div>`
        : '';
    const loginForm = `
        <div class="field"><label>Usuario</label>
            <input autocomplete="username" placeholder="tu_usuario" value="${escapeHtml(authState.loginForm.username)}"
                oninput="authState.loginForm.username = this.value">
        </div>
        <div class="field"><label>Contraseña</label>
            <div style="position:relative">
                <input id="login-pass" type="password" autocomplete="current-password" value="${escapeHtml(authState.loginForm.password)}"
                    oninput="authState.loginForm.password = this.value"
                    onkeydown="if (event.key === 'Enter') login()"
                    style="padding-right:40px;width:100%">
                <button type="button" class="bicon" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);border:none;background:none;width:28px;height:28px"
                    onclick="togglePasswordVisibility('login-pass')">${ICONS.eye}</button>
            </div>
        </div>
        <button class="bmain bdanger" style="margin-top:4px" onclick="login()">${ICONS.bolt}Entrar</button>`;
    const registerForm = `
        <div class="field"><label>Usuario</label>
            <input autocomplete="username" placeholder="mi_usuario" value="${escapeHtml(authState.registerForm.username)}"
                oninput="authState.registerForm.username = this.value">
        </div>
        <div class="field"><label>Contraseña <span style="color:var(--text3)">(mín. 6 caracteres)</span></label>
            <div style="position:relative">
                <input id="reg-pass" type="password" autocomplete="new-password" value="${escapeHtml(authState.registerForm.password)}"
                    oninput="authState.registerForm.password = this.value"
                    style="padding-right:40px;width:100%">
                <button type="button" class="bicon" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);border:none;background:none;width:28px;height:28px"
                    onclick="togglePasswordVisibility('reg-pass')">${ICONS.eye}</button>
            </div>
        </div>
        <div class="trow" style="margin-bottom:12px">
            <div class="field" style="margin:0"><label>Ciudad</label>
                ${buildCitySelect('authState.registerForm.city', authState.registerForm.city)}
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
        ${authState.resetSuccess ? `<div style="background:var(--grn-bg);border:1px solid var(--grn-bd);color:var(--grn-t);padding:8px 12px;border-radius:var(--rs);font-size:13px;margin-bottom:12px">&#10003; Contraseña actualizada. Ya puedes entrar.</div>` : ''}
        ${errorBanner}
        ${isLoginTab ? loginForm : registerForm}
        <p class="auth-note" style="margin-top:18px">
            ¿Olvidaste tu contraseña? Usa /resetpass en <a href="https://t.me/RestosDeJuventudBot" target="_blank" style="color:var(--amber)">@RestosDeJuventudBot</a>
            <br>¿Algún problema? <a href="https://t.me/RestosDeJuventudBot" target="_blank" style="color:var(--text2)">Contáctame por Telegram</a>
        </p>
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
    const tabButtons  = navTabs.map(tab =>
        `<button class="tab ${currentTab === tab.id ? 'active' : ''}" onclick="setCurrentTab('${tab.id}')">${tab.icon}${tab.label}</button>`
    ).join('');
    const badgeClass  = activeOutage ? 'badge boff' : 'badge bon';
    const badgeText   = activeOutage ? `Sin luz &middot; ${formatDuration(minutesWithoutPower)}` : 'Con luz';
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
                <button class="profile-btn" onclick="openProfile()">@${escapeHtml(authState.currentUser.username)}</button>
            </div>
        </div>
        <div class="tabs">${tabButtons}</div>
        ${activeBanner}
        <div class="content">${tabContent}</div>
        ${profileOverlay}`;
}

function renderDashboardTab(now, heatmap, statistics, moodData, todayPredictions, forecast, minutesWithoutPower) {
    const dayName          = DAYS_FULL[now.getDay()].toUpperCase();
    const tomorrowForecast = getTomorrowForecast(appState.outages);
    let forecastContent;
    if (forecast.type === 'nodata') {
        const progress  = computeTrainingProgress(appState.outages);
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
            <div style="font-size:13px;color:var(--text2)">pero no se fue. Sospechoso 👀 — igual podría irse a otra hora.</div>`;
    } else {
        const levelColor  = forecast.peakLevel === 'alto' ? 'var(--red-t)' : '#fdba74';
        const durationLine = forecast.estimatedMinutes
            ? `<div style="font-size:12px;color:var(--text2)">Duración esperada: <strong style="color:var(--text)">${formatDuration(forecast.estimatedMinutes)}</strong> (promedio histórico)</div>`
            : '';
        forecastContent = `
            <div style="font-size:15px;font-weight:600;margin-bottom:6px">${escapeHtml(forecast.message)}</div>
            <div style="font-size:12px;color:${levelColor};margin-bottom:${forecast.estimatedMinutes ? '4px' : '0'}">
                A las: ${padZero(forecast.peakHour)}:00 &middot; ${forecast.peakPercent}% &middot; riesgo ${forecast.peakLevel}
            </div>
            ${durationLine}
            ${forecast.onsetHint ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">La mayoría empezó en: ${forecast.onsetHint}</div>` : ''}
            ${forecast.marginOfError != null ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">±${forecast.marginOfError}% de margen de error · detectado ${forecast.peakHits} de ${forecast.peakObservations} semanas</div>` : ''}`;
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
        const confidenceInfo = currentSlot.confidence >= 0.15 ? ` &middot; ${Math.round(currentProb * 100)}%` : '';
        hourlyBars = `<div class="card card-last">
            <div class="slabel">DETALLE POR HORA — HOY</div>
            <div class="barwrap">${buildRiskCurve(todayPredictions, now)}</div>
            <div style="margin-top:8px;font-size:12px;color:#94a3b8">
                Ahora (${padZero(now.getHours())}:00):
                <span style="font-weight:600;color:${riskColor(currentProb)}">${riskLabel(currentProb, currentSlot.confidence)}${confidenceInfo}</span>
            </div>
        </div>`;
    }
    const emptyState     = appState.outages.length === 0
        ? `<div class="empty">${ICONS.plugOff}<p>Sin registros. Toca + para comenzar.</p></div>` : '';
    const floatingButton = `<button class="fab ${appState.activeOutage ? 'fab-off' : 'fab-on'}" onclick="setCurrentTab('log')">${appState.activeOutage ? ICONS.bulb : ICONS.plus}</button>`;
    const tomorrow     = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
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
        ${buildConsecutiveOutageCard(appState.outages)}
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
            Herramienta independiente de uso personal. Los datos registrados son exclusivamente tuyos, cifrados en la base de datos y no se cruzan con ningún otro registro. Esta app no pertenece a ningún estudio sociológico, institución ni entidad gubernamental.
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
        <textarea class="notes-input" maxlength="120" placeholder="Nota opcional..."
            oninput="appState.endNotes = this.value">${escapeHtml(appState.endNotes)}</textarea>
        <button class="bmain bsuccess" style="margin-top:10px" onclick="endOutage()">${ICONS.bulb}Volvió la luz</button>
    </div>`;
    let survivalCard = '';
    if (activeOutage) {
        const survivalData = computeSurvivalCurve(appState.outages);
        if (survivalData) {
            const { lambda, n } = survivalData;
            const pct     = Math.min((minutesWithoutPower / lambda) * 100, 100);
            const overdue = minutesWithoutPower > lambda;
            const checkpoints = [
                { label: '30 min', t: 30 }, { label: '1h', t: 60 }, { label: '2h', t: 120 },
                { label: '3h', t: 180 },    { label: '4h', t: 240 }, { label: '5h', t: 300 },
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
        const manualStart     = new Date(`${manualDate}T${manualStartTime}`);
        const manualEnd       = new Date(`${manualDate}T${manualEndTime}`);
        const duration        = !isNaN(manualStart) && !isNaN(manualEnd) ? (manualEnd - manualStart) / 60000 : 0;
        const durationPreview = duration > 0
            ? `<div style="font-size:12px;color:#94a3b8;margin-bottom:10px">Duración: ${formatDuration(duration)}</div>` : '';
        manualFormContent = `<div style="margin-top:14px">
            <div class="trow3">
                <div class="field" style="margin:0"><label>Fecha</label><input type="date" value="${manualDate}" onchange="updateAppState('manualDate', this.value)"></div>
                <div class="field" style="margin:0"><label>Inicio</label>${buildTimePicker('manualStartTime', manualStartTime)}</div>
                <div class="field" style="margin:0"><label>Fin</label>${buildTimePicker('manualEndTime', manualEndTime)}</div>
            </div>
            ${durationPreview}
            ${buildMoodPicker()}
            <textarea class="notes-input" maxlength="120" placeholder="Nota opcional..."
                oninput="appState.manualNotes = this.value">${escapeHtml(appState.manualNotes)}</textarea>
            <button class="bsm" style="margin-top:10px" onclick="saveManualOutage()">Guardar</button>
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
    const dayName  = DAYS_FULL[now.getDay()].toUpperCase();
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
    const heatmapRows = DAYS_SHORT.map((dayLabel, dayIndex) => {
        const isToday = dayIndex === now.getDay();
        const cells   = Array.from({ length: 24 }, (_, hour) => {
            const slot    = heatmap[`${dayIndex}_${hour}`] || { probability: 0, confidence: 0 };
            const prob    = adjustedProbability(slot.probability, slot.confidence);
            const isNow   = isToday && hour === now.getHours();
            const bgColor = prob < 0.03 ? 'rgba(255,255,255,.05)' : `rgba(239,68,68,${Math.min(prob * 2, 0.9)})`;
            return `<div class="hmcell ${isNow ? 'now' : ''}" title="${dayLabel} ${padZero(hour)}:00 — ${Math.round(prob * 100)}%" style="background:${bgColor}"></div>`;
        }).join('');
        return `<div class="hmrow">
            <div class="hmday ${isToday ? 'today' : ''}">${dayLabel}</div>
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
            <div class="hmhours">${[0,4,8,12,16,20].map(h => `<span>${padZero(h)}</span>`).join('')}</div>
            ${heatmapRows}
            <div class="hmleg"><span style="font-size:10px;color:#475569">Riesgo:</span>${legendItems}</div>
            <div class="infobox">Solo cortes alimentan el modelo. El modelo considera los últimos 3 meses de registros.</div>
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
            const isMe  = user.username === authState.currentUser?.username;
            const meTag = isMe ? ' <span class="community-me-tag">(tú)</span>' : '';
            return `<div class="comm-user">
                <div class="comm-dot"></div>
                <div class="community-user-info">
                    <div class="community-user-name">@${escapeHtml(user.username)}${meTag}</div>
                    <div class="community-user-location">${escapeHtml(user.city)}${user.zone ? ' · ' + escapeHtml(user.zone) : ''}</div>
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
        const citiesMap = {}, cityOrder = [];
        cityZoneKeys.forEach(key => {
            const { city, zone, outages } = grouped[key];
            if (!citiesMap[city]) { citiesMap[city] = []; cityOrder.push(city); }
            citiesMap[city].push({ zone, outages });
        });
        const blocks = cityOrder.map(city => {
            const isMyCity   = city === myCity;
            const zoneBlocks = citiesMap[city].map(({ zone, outages }) => {
                const totalMins   = outages.reduce((s, o) => s + (o.duration_minutes || 0), 0);
                const outageItems = outages.map(o =>
                    `<div class="community-outage-item">
                        <span class="community-outage-time">${formatTime(o.start_time)} – ${formatTime(o.end_time)}</span>
                        <span class="community-outage-dur">${formatDuration(o.duration_minutes)}</span>
                    </div>`
                ).join('');
                return `<div class="community-zone-block">
                    <div class="community-zone-header">
                        <span class="community-zone-name">${escapeHtml(zone)}</span>
                        <span class="community-zone-summary">${outages.length} corte${outages.length !== 1 ? 's' : ''} · ${formatDuration(totalMins)}</span>
                    </div>
                    <div class="community-outage-list">${outageItems}</div>
                </div>`;
            }).join('');
            return `<div class="community-city-block">
                <div class="community-city-name ${isMyCity ? 'community-city-mine' : ''}">${isMyCity ? '📍 ' : ''}${escapeHtml(city)}</div>
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
        const isEditing       = appState.editOutageId === outage.id;
        const moodEmoji       = moodOption ? `<span title="${escapeHtml(moodOption.label)}" style="font-size:14px">${moodOption.emoji}</span>` : '';
        const fluctuationTag  = isFluctuation ? `<span class="tag tag-fluc">FLUCTUACIÓN</span>` : '';
        const timeRange       = isFluctuation ? '' : ` &ndash; ${outage.end ? formatTime(outage.end) : 'en curso'}`;
        const durationText    = isFluctuation
            ? `<div class="hdur-fluc">&#9889;</div>`
            : `<div class="hdur">
                ${outage.end ? formatDuration(outage.duration_minutes) : formatDuration(activeMinutes)}
                ${!outage.end ? '<div class="hactive">en curso</div>' : ''}
              </div>`;
        const canEdit = !isFluctuation && !isActive && outage.end;
        const deleteControls = isPendingDelete
            ? `<div style="display:flex;gap:4px">
                <button class="byes" onclick="deleteOutage('${escapeHtml(outage.id)}')">Sí</button>
                <button class="bno"  onclick="cancelDeleteRequest()">No</button>
              </div>`
            : `<div style="display:flex;gap:4px">
                ${canEdit ? `<button class="bicon" onclick="startEditOutage(JSON.parse(decodeURIComponent('${encodeURIComponent(JSON.stringify(outage))}')))">${ICONS.pencil}</button>` : ''}
                <button class="bicon" onclick="requestDeleteConfirmation('${escapeHtml(outage.id)}')">${ICONS.trash}</button>
              </div>`;

        if (isEditing) {
            const editMoodButtons = MOOD_OPTIONS.map(mood => {
                const sel = appState.editMood === mood.value;
                return `<button class="mood-btn${sel ? ' selected' : ''}"
                    style="border-color:${sel ? mood.color : 'var(--border)'}"
                    onclick="appState.editMood = appState.editMood === ${mood.value} ? null : ${mood.value}; render()">
                    <div>${mood.emoji}</div>
                    <div style="color:${sel ? mood.color : 'var(--text3)'}">${mood.label}</div>
                </button>`;
            }).join('');
            return `<div class="hitem">
                <div style="width:100%">
                    <div class="trow3">
                        <div class="field" style="margin:0"><label>Fecha</label><input type="date" value="${appState.editDate}" onchange="appState.editDate = this.value; render()"></div>
                        <div class="field" style="margin:0"><label>Inicio</label>${buildTimePicker('editStartTime', appState.editStartTime)}</div>
                        <div class="field" style="margin:0"><label>Fin</label>${buildTimePicker('editEndTime', appState.editEndTime)}</div>
                    </div>
                    <div class="mood-row">${editMoodButtons}</div>
                    <textarea class="notes-input" placeholder="Nota opcional..." maxlength="120" oninput="appState.editNotes = this.value">${escapeHtml(appState.editNotes)}</textarea>
                    <div style="display:flex;gap:8px;margin-top:10px">
                        <button class="bsm" onclick="saveEditOutage()">Guardar</button>
                        <button class="bno" onclick="cancelEdit()">Cancelar</button>
                    </div>
                </div>
            </div>`;
        }

        return `<div class="hitem ${isFluctuation ? 'hitem-fluc' : ''}">
            <div class="hmeta">
                <div class="hdate">${formatDate(outage.start)}${fluctuationTag}${moodEmoji}</div>
                <div class="htime">${formatTime(outage.start)}${timeRange}</div>
                ${outage.notes ? `<div class="hnotes">${escapeHtml(outage.notes)}</div>` : ''}
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
        const savedMessage    = profileState.changesSaved    ? `<div style="color:var(--grn-t);font-size:13px;margin-bottom:10px">&#10003; Cambios guardados</div>` : '';
        const passwordSuccess = profileState.passwordUpdated ? `<div style="color:var(--grn-t);font-size:13px;margin-bottom:8px">&#10003; Contraseña actualizada</div>` : '';
        const passwordError   = profileState.passwordError   ? `<div class="auth-err">${escapeHtml(profileState.passwordError)}</div>` : '';
        const deleteConfirm   = profileState.confirmDelete
            ? `<div style="font-size:13px;color:var(--red-t);margin-bottom:8px;font-weight:600">¿Seguro? Se borrarán ${stats.total_cortes} cortes y ${stats.total_flucs} fluctuaciones.</div>
               <div style="display:flex;gap:8px">
                   <button class="byes" onclick="deleteAccount()">Sí, borrar todo</button>
                   <button class="bno"  onclick="profileState.confirmDelete = false; render()">Cancelar</button>
               </div>`
            : `<button class="bdel-account" onclick="deleteAccount()">Borrar mi cuenta</button>`;
        content = `<div class="sgrid3" style="margin-bottom:16px">
            <div class="scard"><div class="sval" style="font-size:16px">${stats.total_cortes}</div><div class="slb">Cortes</div></div>
            <div class="scard"><div class="sval" style="font-size:16px">${formatDuration(stats.total_mins)}</div><div class="slb">Sin luz</div></div>
            <div class="scard"><div class="sval-ora" style="font-size:16px">${stats.total_flucs}</div><div class="slb">Fluctuac.</div></div>
        </div>
        <div class="trow" style="margin-bottom:12px">
            <div class="field" style="margin:0"><label>Ciudad</label>
                ${buildCitySelect('profileState.editCity', profileState.editCity)}
            </div>
            <div class="field" style="margin:0"><label>Zona</label>
                ${buildZoneSelect('profileState.editZone', profileState.editZone)}
            </div>
        </div>
        <div class="toggle-row">
            <div>
                <div style="font-size:14px">Perfil público</div>
                <div style="font-size:12px;color:var(--text2)">Tu actividad es visible en Comunidad</div>
            </div>
            <button class="toggle ${profileState.isPublic ? 'on' : 'off'}" onclick="profileState.isPublic = !profileState.isPublic; render()"></button>
        </div>
        ${buildTelegramSection()}
        <details style="margin-bottom:14px">
            <summary style="cursor:pointer;font-size:13px;color:var(--text2);padding:8px 0">Cambiar contraseña</summary>
            <div style="margin-top:10px">
                <div class="field"><label>Contraseña actual</label>
                    <input type="password" value="${escapeHtml(profileState.currentPassword)}" oninput="profileState.currentPassword = this.value">
                </div>
                <div class="field"><label>Nueva contraseña</label>
                    <input type="password" value="${escapeHtml(profileState.newPassword)}" oninput="profileState.newPassword = this.value">
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
                <div class="overlay-title">@${escapeHtml(authState.currentUser.username)}</div>
                <button class="bicon" onclick="profileState.isOpen = false; render()">${ICONS.close}</button>
            </div>
            ${content}
        </div>
    </div>`;
}
