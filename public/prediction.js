const DAYS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const DAYS_FULL  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

function getHourlySlots(outage) {
  const slots = [];
  const cursor = new Date(outage.start);
  cursor.setMinutes(0, 0, 0);
  const end = new Date(outage.end);
  while (cursor < end) {
    slots.push({ day: cursor.getDay(), hour: cursor.getHours() });
    cursor.setHours(cursor.getHours() + 1);
  }
  return slots;
}

function buildHeatmap(outages) {
  const completed = outages.filter(o => o.start && o.end && (o.type || 'corte') === 'corte');
  if (!completed.length) return null;

  const allDates = completed.flatMap(o => [new Date(o.start), new Date(o.end)]);
  const earliest = new Date(Math.min(...allDates.map(d => d.getTime())));

  const observed = {};
  const hits     = {};

  const cursor = new Date(earliest);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= new Date()) {
    for (let h = 0; h < 24; h++) {
      const key = `${cursor.getDay()}_${h}`;
      observed[key] = (observed[key] || 0) + 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  completed.forEach(o => {
    getHourlySlots(o).forEach(({ day, hour }) => {
      const key = `${day}_${hour}`;
      hits[key] = (hits[key] || 0) + 1;
    });
  });

  const OBSERVATIONS_FOR_FULL_CONFIDENCE = 4;

  const heatmap = {};
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const key = `${d}_${h}`;
      const ob  = observed[key] || 0;
      const hi  = hits[key]    || 0;
      heatmap[key] = {
        prob: ob > 0 ? (hi + 0.5) / (ob + 1) : 0,
        conf: Math.min(ob / OBSERVATIONS_FOR_FULL_CONFIDENCE, 1),
        hits: hi,
        obs:  ob,
      };
    }
  }
  return heatmap;
}

function avgDurByHour(outages) {
  const completed = outages.filter(o => o.start && o.end && (o.type || 'corte') === 'corte' && o.duration_minutes > 0);
  const grouped = {};
  completed.forEach(o => {
    const h = new Date(o.start).getHours();
    if (!grouped[h]) grouped[h] = [];
    grouped[h].push(o.duration_minutes);
  });
  const result = {};
  Object.entries(grouped).forEach(([h, arr]) => {
    result[+h] = arr.reduce((a, b) => a + b, 0) / arr.length;
  });
  return result;
}

const adjProb   = (prob, conf) => conf < 0.15 ? 0 : prob * conf;
const riskColor = p => p < 0.05 ? '#475569' : p < 0.2 ? '#639922' : p < 0.4 ? '#d97706' : p < 0.6 ? '#e24b4a' : '#b91c1c';
const riskLabel = (p, conf) => conf < 0.15 ? 'Sin datos' : p < 0.05 ? 'Sin riesgo' : p < 0.2 ? 'Bajo' : p < 0.4 ? 'Moderado' : p < 0.6 ? 'Alto' : 'Muy alto';

function getDayForecast(predictions, outages) {
  if (!predictions.some(p => p.conf >= 0.15)) return { type: 'nodata' };

  const risky = predictions.filter(({ prob, conf }) => adjProb(prob, conf) >= 0.18);
  if (!risky.length) return { type: 'safe' };

  const ranges = [];
  let rs = null, re = null;
  risky.forEach(({ hour }) => {
    if (rs === null)        { rs = hour; re = hour; }
    else if (hour === re+1) { re = hour; }
    else { ranges.push([rs, re]); rs = hour; re = hour; }
  });
  if (rs !== null) ranges.push([rs, re]);

  const peak    = risky.reduce((mx, p) => adjProb(p.prob, p.conf) > adjProb(mx.prob, mx.conf) ? p : mx, risky[0]);
  const rText   = ranges.map(([s, e]) => s === e ? `las ${pad(s)}:00` : `las ${pad(s)}:00–${pad(e+1)}:00`);
  const joined  = rText.length === 1 ? rText[0] : rText.slice(0,-1).join(', ') + ' y ' + rText.slice(-1);
  const durByH  = avgDurByHour(outages);
  const durs    = risky.map(p => p.hour).filter(h => durByH[h]).map(h => durByH[h]);
  const avgDur  = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : null;

  return {
    type: 'risk',
    text: `Es probable que se vaya la luz entre ${joined}.`,
    peakH: peak.hour,
    peakP: Math.round(adjProb(peak.prob, peak.conf) * 100),
    peakLevel: peak.prob < 0.4 ? 'moderado' : 'alto',
    avgDur,
  };
}

function calcStats(outages) {
  const now          = new Date();
  const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0,0,0,0);
  const startOfDay   = new Date(now); startOfDay.setHours(0,0,0,0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const completed = outages.filter(o => o.start && o.end && (o.type || 'corte') === 'corte' && o.duration_minutes != null);
  const flucs     = outages.filter(o => (o.type || 'corte') === 'fluctuacion');
  const sum       = arr => arr.reduce((s, o) => s + (o.duration_minutes || 0), 0);

  const week   = completed.filter(o => new Date(o.start) >= startOfWeek);
  const month  = completed.filter(o => new Date(o.start) >= startOfMonth);
  const year   = completed.filter(o => new Date(o.start) >= new Date(now.getFullYear(), 0, 1));
  const longest = completed.reduce((mx, o) => (o.duration_minutes || 0) > (mx?.duration_minutes || 0) ? o : mx, null);

  const byDay = {};
  completed.forEach(o => {
    const key = new Date(o.start).toDateString();
    if (!byDay[key]) byDay[key] = { mins: 0, count: 0, date: new Date(o.start) };
    byDay[key].mins  += o.duration_minutes || 0;
    byDay[key].count += 1;
  });
  const worstDay   = Object.values(byDay).sort((a, b) => b.mins - a.mins)[0] || null;
  const slotCounts = {};
  completed.forEach(o => getHourlySlots(o).forEach(({ hour }) => { slotCounts[hour] = (slotCounts[hour] || 0) + 1; }));
  const peakEntry  = Object.entries(slotCounts).sort((a, b) => b[1] - a[1])[0];
  const totalDays  = completed.length > 0
    ? Math.max(1, Math.ceil((now - new Date(Math.min(...completed.map(o => new Date(o.start).getTime())))) / 86400000))
    : 1;

  return {
    weekMins:   sum(week),   weekCount:  week.length,
    monthMins:  sum(month),  monthCount: month.length,
    yearMins:   sum(year),   yearCount:  year.length,
    longest, worstDay,
    peakHour:   peakEntry ? +peakEntry[0] : null,
    dailyAvg:   sum(completed) / totalDays,
    flucsToday: flucs.filter(o => new Date(o.start) >= startOfDay).length,
    flucsWeek:  flucs.filter(o => new Date(o.start) >= startOfWeek).length,
    flucsMonth: flucs.filter(o => new Date(o.start) >= startOfMonth).length,
  };
}

function calcAvgMood(outages) {
  const withMood = outages.filter(o => o.mood && o.end && (o.type || 'corte') === 'corte');
  if (!withMood.length) return null;
  const recent = withMood.slice(0, 20);
  return { avg: recent.reduce((s, o) => s + o.mood, 0) / recent.length, count: withMood.length };
}

function calcTrainingProgress(outages) {
  const completed = outages.filter(o => o.start && o.end && (o.type || 'corte') === 'corte');
  if (!completed.length) return { weeks: 0, percent: 0, enough: false };
  const earliest  = new Date(Math.min(...completed.map(o => new Date(o.start).getTime())));
  const weeks     = (new Date() - earliest) / (7 * 24 * 3600 * 1000);
  const TARGET    = 4;
  const percent   = Math.min(Math.round((weeks / TARGET) * 100), 100);
  return { weeks: Math.floor(weeks), percent, enough: weeks >= TARGET };
}
