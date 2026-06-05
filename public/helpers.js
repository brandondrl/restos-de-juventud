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
