const TZ = 'America/Caracas';

function _getOffsetH(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(new Date());
    const v = parts.find(p => p.type === 'timeZoneName');
    if (v) {
      const m = String(v.value).match(/GMT([+-])(\d{2}):(\d{2})/);
      if (m) return (m[1] === '-' ? -1 : 1) * parseInt(m[2], 10);
    }
  } catch (e) { /* Intl not available */ }
  return -4;
}

function _getDateParts(tz) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return {
    y: parseInt(parts.find(p => p.type === 'year').value, 10),
    m: parseInt(parts.find(p => p.type === 'month').value, 10),
    d: parseInt(parts.find(p => p.type === 'day').value, 10),
  };
}

function getTodayStartISO(tz) {
  tz = tz || TZ;
  const { y, m, d } = _getDateParts(tz);
  const offsetH = _getOffsetH(tz);
  return new Date(Date.UTC(y, m - 1, d, -offsetH, 0, 0)).toISOString();
}

function getDaysAgoUTC(n, tz) {
  tz = tz || TZ;
  const { y, m, d } = _getDateParts(tz);
  const offsetH = _getOffsetH(tz);
  const todayStart = Date.UTC(y, m - 1, d, -offsetH, 0, 0);
  return new Date(todayStart - n * 86400000);
}

module.exports = { TZ, getTodayStartISO, getDaysAgoUTC };
