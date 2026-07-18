var DEFAULT_TZ = 'America/Caracas';

function tzComponents(date, tz) {
    tz = tz || DEFAULT_TZ;
    var fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, weekday: 'short',
    });
    var parts = fmt.formatToParts(date);
    function p(type) { return parseInt(parts.find(function(x) { return x.type === type; }).value, 10); }
    var wd = parts.find(function(x) { return x.type === 'weekday'; }).value;
    var weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
        year: p('year'), month: p('month'), day: p('day'),
        hour: p('hour'), minute: p('minute'), second: p('second'),
        dayOfWeek: weekdayMap[wd],
    };
}

function tzOffsetMs(date, tz) {
    tz = tz || DEFAULT_TZ;
    try {
        var parts = new Intl.DateTimeFormat('en', {
            timeZone: tz,
            timeZoneName: 'longOffset',
        }).formatToParts(date);
        var v = parts.find(function(x) { return x.type === 'timeZoneName'; });
        if (v) {
            var m = String(v.value).match(/GMT([+-])(\d{2}):(\d{2})/);
            if (m) {
                var sign = m[1] === '+' ? 1 : -1;
                return sign * (parseInt(m[2], 10) * 3600 + parseInt(m[3], 10) * 60) * 1000;
            }
        }
    } catch (e) {}
    return -4 * 3600000;
}

function tzGetDay(date, tz) { return tzComponents(date, tz).dayOfWeek; }
function tzGetHours(date, tz) { return tzComponents(date, tz).hour; }
function tzGetDate(date, tz) { return tzComponents(date, tz).day; }
function tzGetMonth(date, tz) { return tzComponents(date, tz).month - 1; }
function tzGetFullYear(date, tz) { return tzComponents(date, tz).year; }
function tzGetMinutes(date, tz) { return tzComponents(date, tz).minute; }
function tzLocaleDateStr(date, locale, options, tz) {
    tz = tz || DEFAULT_TZ;
    var opts = {};
    if (options) { for (var k in options) { if (options.hasOwnProperty(k)) opts[k] = options[k]; } }
    opts.timeZone = tz;
    return new Intl.DateTimeFormat(locale, opts).format(date);
}

function caracasComponents(date) { return tzComponents(date, 'America/Caracas'); }
function caracasGetDay(date) { return tzGetDay(date, 'America/Caracas'); }
function caracasGetHours(date) { return tzGetHours(date, 'America/Caracas'); }
function caracasGetDate(date) { return tzGetDate(date, 'America/Caracas'); }
function caracasGetMonth(date) { return tzGetMonth(date, 'America/Caracas'); }
function caracasGetFullYear(date) { return tzGetFullYear(date, 'America/Caracas'); }
function caracasGetMinutes(date) { return tzGetMinutes(date, 'America/Caracas'); }
function caracasLocaleDateStr(date, locale, options) { return tzLocaleDateStr(date, locale, options, 'America/Caracas'); }

function caracasNow() {
    var c = caracasComponents(new Date());
    return new Date(c.year, c.month - 1, c.day, c.hour, c.minute, c.second);
}

function getStartOfDayUTC(date, tz) {
    tz = tz || DEFAULT_TZ;
    var c = tzComponents(date, tz);
    var offsetHours = -tzOffsetMs(date, tz) / 3600000;
    return new Date(Date.UTC(c.year, c.month - 1, c.day, offsetHours, 0, 0));
}

function getWeekStartUTC(tz) {
    tz = tz || DEFAULT_TZ;
    var now = new Date();
    var c = tzComponents(now, tz);
    var daysBack = c.dayOfWeek === 0 ? 6 : c.dayOfWeek - 1;
    var mondayDay = c.day - daysBack;
    var offsetHours = -tzOffsetMs(now, tz) / 3600000;
    return new Date(Date.UTC(c.year, c.month - 1, mondayDay, offsetHours, 0, 0));
}

function getTodayStartUTC(tz) {
    return getStartOfDayUTC(new Date(), tz);
}

function getMonthStartUTC(tz) {
    tz = tz || DEFAULT_TZ;
    var now = new Date();
    var c = tzComponents(now, tz);
    var offsetHours = -tzOffsetMs(now, tz) / 3600000;
    return new Date(Date.UTC(c.year, c.month - 1, 1, offsetHours, 0, 0));
}

function getYearStartUTC(tz) {
    tz = tz || DEFAULT_TZ;
    var now = new Date();
    var c = tzComponents(now, tz);
    var offsetHours = -tzOffsetMs(now, tz) / 3600000;
    return new Date(Date.UTC(c.year, 0, 1, offsetHours, 0, 0));
}

function caracasToDateString(date) {
    var c = caracasComponents(date);
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return days[c.dayOfWeek] + ' ' + months[c.month - 1] + ' ' + String(c.day).padStart(2, '0') + ' ' + c.year;
}

function caracasDateStr(date) {
    var c = caracasComponents(date);
    return c.year + '-' + String(c.month).padStart(2, '0') + '-' + String(c.day).padStart(2, '0');
}

function caracasTimeStr(date) {
    var c = caracasComponents(date);
    return String(c.hour).padStart(2, '0') + ':' + String(c.minute).padStart(2, '0');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DEFAULT_TZ,
        tzComponents, tzOffsetMs, tzGetDay, tzGetHours, tzGetDate,
        tzGetMonth, tzGetFullYear, tzGetMinutes, tzLocaleDateStr,
        getStartOfDayUTC, getWeekStartUTC, getTodayStartUTC,
        getMonthStartUTC, getYearStartUTC,
        caracasComponents, caracasGetDay, caracasGetHours, caracasGetDate,
        caracasGetMonth, caracasGetFullYear, caracasGetMinutes,
        caracasNow, caracasToDateString, caracasDateStr, caracasTimeStr, caracasLocaleDateStr,
    };
}

if (typeof global !== 'undefined' && typeof global.global !== 'undefined') {
    global.DEFAULT_TZ = DEFAULT_TZ;
    global.tzComponents = tzComponents;
    global.caracasGetDay = caracasGetDay;
    global.caracasGetHours = caracasGetHours;
    global.caracasGetDate = caracasGetDate;
    global.caracasGetMonth = caracasGetMonth;
    global.caracasGetFullYear = caracasGetFullYear;
    global.caracasGetMinutes = caracasGetMinutes;
    global.caracasNow = caracasNow;
    global.caracasToDateString = caracasToDateString;
    global.caracasDateStr = caracasDateStr;
    global.caracasTimeStr = caracasTimeStr;
    global.caracasLocaleDateStr = caracasLocaleDateStr;
    global.getWeekStartUTC = getWeekStartUTC;
    global.getTodayStartUTC = getTodayStartUTC;
    global.getMonthStartUTC = getMonthStartUTC;
    global.getYearStartUTC = getYearStartUTC;
}