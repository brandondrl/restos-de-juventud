function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setNestedValue(path, value) {
    const parts = path.split('.');
    let obj = window;
    for (let i = 0; i < parts.length - 1; i++) {
        obj = obj[parts[i]];
        if (!obj) return;
    }
    obj[parts[parts.length - 1]] = value;
}

function buildCitySelect(stateExpr, currentValue) {
    const escaped = escapeHtml(currentValue || '');
    return `<div class="city-select-wrap" data-expr="${stateExpr}">
        <input type="text" class="city-input"
            placeholder="Buscar ciudad..."
            value="${escaped}"
            autocomplete="off"
            spellcheck="false"
            oninput="onCityInput(this)"
            onfocus="onCityFocus(this)"
            onblur="onCityBlur(this)">
        <div class="city-dropdown" style="display:none"></div>
    </div>`;
}

function onCityInput(input) {
    const wrap    = input.closest('.city-select-wrap');
    const drop    = wrap.querySelector('.city-dropdown');
    const query   = input.value.trim().toLowerCase();
    setNestedValue(wrap.dataset.expr, input.value);
    if (query.length < 1) { drop.style.display = 'none'; return; }
    const results = VENEZUELA_CITIES.filter(c => c.toLowerCase().includes(query)).slice(0, 10);
    if (!results.length) {
        drop.innerHTML = `<div class="city-no-results">Sin resultados</div>`;
        drop.style.display = 'block';
        return;
    }
    drop.innerHTML = results.map(c =>
        `<div class="city-option" data-city="${escapeHtml(c)}" onmousedown="onCitySelect(this)">${escapeHtml(c)}</div>`
    ).join('');
    drop.style.display = 'block';
}

function onCityFocus(input) {
    if (input.value.trim().length >= 1) onCityInput(input);
}

function onCityBlur(input) {
    const wrap = input.closest('.city-select-wrap');
    const drop = wrap.querySelector('.city-dropdown');
    setTimeout(() => {
        drop.style.display = 'none';
        const value = input.value.trim();
        if (value && !VENEZUELA_CITIES.includes(value)) {
            input.value = '';
            setNestedValue(wrap.dataset.expr, '');
        }
    }, 200);
}

function onCitySelect(optionEl) {
    const wrap  = optionEl.closest('.city-select-wrap');
    const input = wrap.querySelector('.city-input');
    const drop  = wrap.querySelector('.city-dropdown');
    const city  = optionEl.dataset.city;
    input.value = city;
    drop.style.display = 'none';
    setNestedValue(wrap.dataset.expr, city);
}

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
