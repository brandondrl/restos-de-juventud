const icons = {
  bolt:`<svg viewBox="0 0 24 24"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  boltOff:`<svg viewBox="0 0 24 24"><line x1="2" y1="2" x2="22" y2="22"/><path d="M11.5 4H13L12 10h7L12 21v-7H5z"/></svg>`,
  bulb:`<svg viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/></svg>`,
  dash:`<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  plus:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  predict:`<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  history:`<svg viewBox="0 0 24 24"><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/></svg>`,
  users:`<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  trash:`<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
  zap:`<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  chevD:`<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>`,
  chevU:`<svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>`,
  x:`<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  download:`<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  clock:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  plugX:`<svg viewBox="0 0 24 24"><path d="M12 22V11M5 11l-.75-3M19 11l.75-3M8 11V5h8v6"/><line x1="3" y1="3" x2="21" y2="21"/></svg>`,
  logout:`<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  warn:`<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
};

const MOODS = [
  { value:1, emoji:'😡', label:'Arrecho',   color:'#ef4444' },
  { value:2, emoji:'😢', label:'Triste',    color:'#f97316' },
  { value:3, emoji:'😤', label:'Frustrado', color:'#f59e0b' },
  { value:4, emoji:'😐', label:'Normal',    color:'#84cc16' },
  { value:5, emoji:'😊', label:'Feliz',     color:'#22c55e' },
];

const PAGE_SIZE = 20;

const pad = n => String(n).padStart(2,'0');
const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const fmtDur = m => { if(!m||m<=0)return'0m'; const h=Math.floor(m/60),mn=Math.round(m%60); return h&&mn?`${h}h ${mn}m`:h?`${h}h`:`${mn}m`; };
const fmtDate = iso => { if(!iso)return''; return new Date(iso).toLocaleDateString('es-ES',{weekday:'short',day:'2-digit',month:'2-digit',year:'2-digit'}); };
const fmtTime = iso => { if(!iso)return''; const d=new Date(iso); return`${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const todayDate = () => { const d=new Date(); return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const nowTime = () => { const d=new Date(); return`${pad(d.getHours())}:${pad(d.getMinutes())}`; };

const FETCH_OPTS = { credentials:'same-origin' };
const api = {
  get:  url      => fetch(url,FETCH_OPTS).then(r=>{ if(!r.ok)throw r; return r.json(); }),
  post: (url,b)  => fetch(url,{...FETCH_OPTS,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}),
  put:  (url,b)  => fetch(url,{...FETCH_OPTS,method:'PUT', headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}),
  del:  url      => fetch(url,{...FETCH_OPTS,method:'DELETE'}),
};

let authState = {
  checking:true, user:null, tab:'login', error:'',
  register:{ username:'', password:'', city:'', zone:'' },
  login:{ username:'', password:'' },
};
let appState = {
  outages:[], active:null, tab:'dashboard', loading:true,
  startDate:todayDate(), startTime:nowTime(),
  endDate:todayDate(), endTime:nowTime(),
  showManual:false, manualDate:todayDate(), manualStart:'00:00', manualEnd:'00:00',
  deleteId:null, histPage:1, selectedMood:null,
};
let profileState = {
  open:false, data:null, loading:false,
  editCity:'', editZone:'', editPublic:true,
  pwCurrent:'', pwNew:'', pwErr:'', pwOk:false, saveOk:false, confirmDelete:false,
};
let communityState = { loading:false, data:null };


function renderTimePicker(stateKey, currentVal) {
  const [hh,mm] = (currentVal||'00:00').split(':');
  const hours   = Array.from({length:24},(_,i)=>{ const v=pad(i); return`<option value="${v}"${v===hh?' selected':''}>${v}</option>`; }).join('');
  const minutes = Array.from({length:60},(_,i)=>{ const v=pad(i); return`<option value="${v}"${v===mm?' selected':''}>${v}</option>`; }).join('');
  return `<div class="time-picker">
    <select onchange="setTimeHour('${stateKey}',this.value)">${hours}</select>
    <span>:</span>
    <select onchange="setTimeMin('${stateKey}',this.value)">${minutes}</select>
  </div>`;
}

function renderMoodPicker() {
  return `<div style="margin-bottom:12px">
    <div style="font-size:12px;color:var(--text2);margin-bottom:6px">¿Cómo te sientes? <span style="color:var(--text3)">(opcional)</span></div>
    <div class="mood-row">
      ${MOODS.map(m=>`<button class="mood-btn${appState.selectedMood===m.value?' selected':''}" onclick="appState.selectedMood=appState.selectedMood===${m.value}?null:${m.value};render()">
        <div>${m.emoji}</div><div>${m.label}</div>
      </button>`).join('')}
    </div>
  </div>`;
}

function renderMoodGauge(moodData) {
  const cx=100, cy=98, rOuter=75, rInner=52, needleLen=64;
  const pt = (deg,r) => { const rad=deg*Math.PI/180; return [cx+r*Math.cos(rad), cy-r*Math.sin(rad)]; };
  const seg = (a1,a2,color) => {
    const f = v => v.toFixed(2);
    const [ox1,oy1]=pt(a1,rOuter),[ox2,oy2]=pt(a2,rOuter);
    const [ix1,iy1]=pt(a1,rInner),[ix2,iy2]=pt(a2,rInner);
    return `<path d="M ${f(ox1)} ${f(oy1)} A ${rOuter} ${rOuter} 0 0 0 ${f(ox2)} ${f(oy2)} L ${f(ix2)} ${f(iy2)} A ${rInner} ${rInner} 0 0 1 ${f(ix1)} ${f(iy1)} Z" fill="${color}" opacity="${moodData?'0.9':'0.2'}"/>`;
  };
  const segs = MOODS.map((m,i) => seg(180-i*36, 180-(i+1)*36, m.color)).join('');

  if(!moodData) return `<svg viewBox="0 0 200 115" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:220px;display:block;margin:0 auto">
    ${segs}
    <circle cx="${cx}" cy="${cy}" r="5" fill="#334155"/>
    <text x="${cx}" y="78" text-anchor="middle" fill="#475569" font-size="13" font-family="system-ui">Sin datos aún</text>
    <text x="${cx}" y="93" text-anchor="middle" fill="#334155" font-size="10" font-family="system-ui">Registra tu estado al guardar cortes</text>
  </svg>`;

  const { avg, count } = moodData;
  const needleAngle = 180 - ((avg-1)/4)*180;
  const [nx,ny] = pt(needleAngle, needleLen);
  const moodIdx = Math.min(4, Math.max(0, Math.round(avg)-1));
  const displayVal = Math.round(((avg-1)/4)*100);
  const f = v => v.toFixed(2);

  return `<svg viewBox="0 0 200 115" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:220px;display:block;margin:0 auto">
    ${segs}
    <line x1="${cx}" y1="${cy}" x2="${f(nx)}" y2="${f(ny)}" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    <text x="${cx}" y="76" text-anchor="middle" fill="white" font-size="24" font-weight="700" font-family="system-ui">${displayVal}</text>
    <text x="${cx}" y="92" text-anchor="middle" fill="${MOODS[moodIdx].color}" font-size="11" font-weight="600" font-family="system-ui">${MOODS[moodIdx].label}</text>
    <circle cx="${cx}" cy="${cy}" r="5" fill="white"/>
    <text x="${cx}" y="112" text-anchor="middle" fill="#475569" font-size="9" font-family="system-ui">${count} registro${count!==1?'s':''}</text>
  </svg>`;
}

async function init() {
  try { const user=await api.get('/api/auth/me'); authState.user=user; authState.checking=false; await loadApp(); }
  catch { authState.checking=false; render(); }
}

async function loadApp() {
  appState.loading=true; render();
  const [outages,active] = await Promise.all([api.get('/api/outages'), api.get('/api/active')]);
  appState.outages=outages; appState.active=active; appState.loading=false;
  if(active) { appState.endDate=todayDate(); appState.endTime=nowTime(); }
  render();
  setInterval(()=>{ if(appState.active) render(); }, 30000);
}

async function doLogin() {
  authState.error='';
  const r=await api.post('/api/auth/login',authState.login);
  const j=await r.json();
  if(!r.ok){authState.error=j.error;render();return;}
  authState.user=j.user; await loadApp();
}

async function doRegister() {
  authState.error='';
  const r=await api.post('/api/auth/register',authState.register);
  const j=await r.json();
  if(!r.ok){authState.error=j.error;render();return;}
  authState.user=j.user; await loadApp();
}

async function doLogout() {
  await api.post('/api/auth/logout',{});
  authState.user=null; appState.outages=[]; appState.active=null; profileState.open=false; render();
}

async function startOutage() {
  const iso = new Date(`${appState.startDate}T${appState.startTime}`).toISOString();
  const outage = { id:uuid(), start:iso };
  await api.post('/api/active', outage);
  appState.active=outage; appState.endDate=todayDate(); appState.endTime=nowTime(); render();
}

async function endOutage() {
  if(!appState.active) return;
  const end=new Date(`${appState.endDate}T${appState.endTime}`);
  const start=new Date(appState.active.start);
  if(end<=start) return alert(`La hora de regreso (${appState.endTime}) debe ser posterior a la salida (${fmtTime(appState.active.start)}). Usa el botón "Ahora".`);
  const completed = { ...appState.active, end:end.toISOString(), duration_minutes:(end-start)/60000, type:'corte', mood:appState.selectedMood||null };
  const r=await api.post('/api/outages',completed);
  if(!r.ok){alert('Error al guardar. Reintenta.');return;}
  await api.del('/api/active');
  appState.outages.unshift(completed); appState.active=null;
  appState.endDate=todayDate(); appState.endTime=nowTime(); appState.selectedMood=null;
  render();
}

async function logFluc() {
  if(appState.active){alert('No es posible registrar una fluctuación mientras hay un corte activo.');return;}
  const iso=new Date(`${appState.startDate}T${appState.startTime}`).toISOString();
  const outage={id:uuid(),start:iso,end:iso,duration_minutes:0,type:'fluctuacion'};
  const r=await api.post('/api/outages',outage);
  if(!r.ok){alert('Error al registrar. Reintenta.');return;}
  appState.outages.unshift(outage); appState.outages.sort((a,b)=>new Date(b.start)-new Date(a.start));
  const btn=document.getElementById('fluc-btn');
  if(btn){btn.textContent='✓ Registrada';btn.disabled=true;btn.style.opacity='.6';setTimeout(render,1200);}else render();
}

async function addManual() {
  const {manualDate:d,manualStart:st,manualEnd:en} = appState;
  if(!d) return alert('Completa todos los campos');
  const start=new Date(`${d}T${st}`), end=new Date(`${d}T${en}`);
  if(isNaN(start)||isNaN(end)||end<=start) return alert('La hora de fin debe ser posterior al inicio');
  const outage={id:uuid(),start:start.toISOString(),end:end.toISOString(),duration_minutes:(end-start)/60000,type:'corte',mood:appState.selectedMood||null};
  const r=await api.post('/api/outages',outage);
  if(!r.ok){alert('Error al guardar. Reintenta.');return;}
  appState.outages.unshift(outage); appState.outages.sort((a,b)=>new Date(b.start)-new Date(a.start));
  appState.manualStart='00:00'; appState.manualEnd='00:00'; appState.showManual=false; appState.selectedMood=null;
  render();
}

async function deleteOutage(id) {
  const r=await api.del(`/api/outages/${id}`);
  if(!r.ok){alert('Error al borrar. Reintenta.');return;}
  appState.outages=appState.outages.filter(o=>o.id!==id); appState.deleteId=null; render();
}

async function openProfile() {
  profileState.open=true; profileState.loading=true; profileState.pwErr=''; profileState.pwOk=false; profileState.saveOk=false; profileState.confirmDelete=false; render();
  const data=await api.get('/api/profile');
  profileState.data=data; profileState.editCity=data.city; profileState.editZone=data.zone; profileState.editPublic=data.is_public; profileState.loading=false; render();
}

async function saveProfile() {
  profileState.saveOk=false; profileState.pwErr='';
  const body={city:profileState.editCity,zone:profileState.editZone,is_public:profileState.editPublic};
  if(profileState.pwNew){body.currentPassword=profileState.pwCurrent;body.newPassword=profileState.pwNew;}
  const r=await api.put('/api/profile',body); const j=await r.json();
  if(!r.ok){profileState.pwErr=j.error;render();return;}
  profileState.pwCurrent=''; profileState.pwNew=''; profileState.pwErr=''; profileState.pwOk=!!body.newPassword; profileState.saveOk=true;
  if(authState.user){authState.user.city=profileState.editCity;authState.user.zone=profileState.editZone;}
  render();
}

async function deleteAccount() {
  if(!profileState.confirmDelete){profileState.confirmDelete=true;render();return;}
  const r=await api.del('/api/account');
  if(!r.ok){alert('Error al borrar la cuenta. Reintenta.');return;}
  authState.user=null; appState.outages=[]; appState.active=null; profileState.open=false; render();
}

async function loadCommunity() {
  communityState.loading=true; render();
  communityState.data=await api.get('/api/community'); communityState.loading=false; render();
}

function render() {
  const app=document.getElementById('app');
  if(authState.checking){app.innerHTML='<div class="empty" style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center"><p>Cargando...</p></div>';return;}
  app.innerHTML = authState.user ? renderApp() : renderAuth();
}

function renderAuth() {
  const isLogin = authState.tab==='login';
  return `<div class="auth-wrap"><div class="auth-card">
    <div class="auth-logo">
      <svg viewBox="0 0 24 24" style="width:26px;height:26px;stroke:#f59e0b;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      <div><div class="auth-title">Restos de Juventud</div><div style="font-size:12px;color:var(--text2)">Monitor de cortes eléctricos</div></div>
    </div>
    <div class="auth-tabs">
      <button class="auth-tab ${isLogin?'active':''}" onclick="setAuth('tab','login')">Entrar</button>
      <button class="auth-tab ${!isLogin?'active':''}" onclick="setAuth('tab','register')">Registrarse</button>
    </div>
    ${authState.error?`<div class="auth-err">${authState.error}</div>`:''}
    ${isLogin?`
      <div class="field"><label>Usuario</label><input autocomplete="username" placeholder="tu_usuario" value="${authState.login.username}" oninput="authState.login.username=this.value"></div>
      <div class="field"><label>Contraseña</label><input type="password" autocomplete="current-password" value="${authState.login.password}" oninput="authState.login.password=this.value" onkeydown="if(event.key==='Enter')doLogin()"></div>
      <button class="bmain bdanger" style="margin-top:4px" onclick="doLogin()">${icons.bolt}Entrar</button>
    `:`
      <div class="field"><label>Usuario</label><input autocomplete="username" placeholder="mi_usuario" value="${authState.register.username}" oninput="authState.register.username=this.value"></div>
      <div class="field"><label>Contraseña <span style="color:var(--text3)">(mín. 6 caracteres)</span></label><input type="password" autocomplete="new-password" value="${authState.register.password}" oninput="authState.register.password=this.value"></div>
      <div class="trow" style="margin-bottom:12px">
        <div class="field" style="margin:0"><label>Ciudad</label><input placeholder="Caracas" value="${authState.register.city}" oninput="authState.register.city=this.value"></div>
        <div class="field" style="margin:0"><label>Zona <span style="color:var(--text3)">(opcional)</span></label><input placeholder="Zona Norte" value="${authState.register.zone}" oninput="authState.register.zone=this.value"></div>
      </div>
      <button class="bmain bsuccess" onclick="doRegister()">${icons.bolt}Crear cuenta</button>
      <p class="auth-note">Tu actividad será visible en Comunidad si mantienes el perfil público.</p>
    `}
  </div></div>`;
}

function renderApp() {
  const now=new Date();
  const {outages,active,tab,showManual,deleteId} = appState;
  const activeMins = active?(now-new Date(active.start))/60000:0;
  const heatmap = buildHeatmap(outages);
  const modelProgress = getModelProgress(outages);
  const stats = calcStats(outages);
  const moodData = calcAvgMood(outages);
  const todayPreds = heatmap ? Array.from({length:24},(_,h)=>({hour:h,...(heatmap[`${now.getDay()}_${h}`]||{prob:0,conf:0})})) : [];
  const forecast = heatmap ? getDayForecast(todayPreds,outages) : {type:'nodata'};
  const durByH = avgDurByHour(outages);

  let h=`
  <div class="header">
    <div class="hleft">
      <svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:#f59e0b;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      <div><div class="htitle">Monitor de Cortes</div><div class="hsub">${now.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}</div></div>
    </div>
    <div class="hright">
      <div class="badge ${active?'boff':'bon'}"><div class="dot"></div>${active?`Sin luz &middot; ${fmtDur(activeMins)}`:'Con luz'}</div>
      <button class="profile-btn" onclick="openProfile()">@${authState.user.username}</button>
    </div>
  </div>
  <div class="tabs">
    ${[['dashboard',icons.dash,'Panel'],['log',icons.plus,'Registrar'],['predict',icons.predict,'Predicción'],['community',icons.users,'Comunidad'],['history',icons.history,'Historial']]
      .map(([id,svg,lb])=>`<button class="tab ${tab===id?'active':''}" onclick="setTab('${id}')">${svg}${lb}</button>`).join('')}
  </div>
  <div class="content">`;

  if(tab==='dashboard') {
    h+=`<div class="forecast-card"><div class="slabel">PRONÓSTICO — ${DAYS_FULL[now.getDay()].toUpperCase()}</div>`;
    if(forecast.type==='nodata') {
      const progress = calcTrainingProgress(outages);
      if(progress.weeks === 0) {
        h+=`<div style="font-size:13px;color:var(--text3)">Registra tu primer corte para empezar a calibrar el modelo.</div>`;
      } else {
        h+=`<div style="margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:13px;color:var(--text2)">Calibrando el modelo…</span>
            <span style="font-size:13px;font-weight:600;color:var(--amber)">${progress.percent}%</span>
          </div>
          <div style="height:6px;background:var(--bg3);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${progress.percent}%;background:var(--amber);border-radius:3px"></div>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:5px">Semana ${progress.weeks} de 4 — el modelo necesita ver patrones repetirse para predecir</div>
        </div>`;
      }
    }
    else if(forecast.type==='safe') h+=`<div style="font-size:14px;color:var(--grn-t)">&#10003; Sin periodos de riesgo significativo para hoy.</div>`;
    else {
      const lc=forecast.peakLevel==='alto'?'var(--red-t)':'#fdba74';
      h+=`<div style="font-size:15px;font-weight:600;margin-bottom:6px">${forecast.text}</div>
          <div style="font-size:12px;color:${lc};margin-bottom:${forecast.avgDur?'4px':'0'}">Pico: ${pad(forecast.peakH)}:00 &middot; ${forecast.peakP}% &middot; riesgo ${forecast.peakLevel}</div>`;
      if(forecast.avgDur) h+=`<div style="font-size:12px;color:var(--text2)">Duración esperada: <strong style="color:var(--text)">${fmtDur(forecast.avgDur)}</strong> (promedio histórico)</div>`;
    }
    ${modelProgress.pct < 100 ? `<div style="font-size:11px;color:var(--text3);margin-top:10px;display:flex;align-items:center;gap:8px">
      <div style="flex:1;height:3px;background:var(--bg3);border-radius:2px;overflow:hidden"><div style="width:${modelProgress.pct}%;height:100%;background:var(--amber);border-radius:2px"></div></div>
      <span>Modelo aprendiendo &middot; ${modelProgress.pct}% (~${Math.ceil((4 - modelProgress.weeks))} sem. restantes)</span>
    </div>` : ''}
    </div>
    <div class="sgrid">
      ${[['Esta semana',fmtDur(stats.weekMins),`${stats.weekCount} cortes`],['Este mes',fmtDur(stats.monthMins),`${stats.monthCount} cortes`],['Este año',fmtDur(stats.yearMins),`${stats.yearCount} cortes`],['Prom. diario',fmtDur(stats.dailyAvg),'histórico']]
        .map(([lb,val,sub])=>`<div class="scard"><div class="sval">${val}</div><div class="slb">${lb}</div><div class="ssub">${sub}</div></div>`).join('')}
    </div>
    <div class="card card-ora" style="margin-bottom:12px">
      <div class="slabel" style="color:var(--ora-t)">FLUCTUACIONES</div>
      <div class="sgrid3">${[['Hoy',stats.flucsToday],['Semana',stats.flucsWeek],['Mes',stats.flucsMonth]].map(([lb,n])=>`<div class="scard"><div class="sval-ora">${n}</div><div class="slb">${lb}</div></div>`).join('')}</div>
    </div>`;

    if(stats.longest||stats.worstDay||stats.peakHour!==null) {
      h+=`<div class="rgrid">`;
      if(stats.longest) h+=`<div class="rcard"><div class="slabel">CORTE MÁS LARGO</div><div class="rval">${fmtDur(stats.longest.duration_minutes)}</div><div class="rsub">${fmtDate(stats.longest.start)} &middot; ${fmtTime(stats.longest.start)}&ndash;${fmtTime(stats.longest.end)}</div></div>`;
      if(stats.worstDay) h+=`<div class="rcard"><div class="slabel">DÍA MÁS AFECTADO</div><div class="rval" style="font-size:17px">${stats.worstDay.date.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'short'})}</div><div class="rsub" style="color:var(--amber2)">${fmtDur(stats.worstDay.mins)} &middot; ${stats.worstDay.count} cortes</div></div>`;
      if(stats.peakHour!==null) h+=`<div class="rcard"><div class="slabel">HORA PICO HISTÓRICA</div><div class="rval">${pad(stats.peakHour)}:00</div><div class="rsub">más cortes registrados</div></div>`;
      h+=`</div>`;
    }

    h+=`<div class="card" style="margin-bottom:12px">
      <div class="slabel">ÍNDICE DE ÁNIMO ANTE CORTES</div>
      ${renderMoodGauge(moodData)}
    </div>`;

    if(heatmap) {
      const cur=heatmap[`${now.getDay()}_${now.getHours()}`]||{prob:0,conf:0};
      const p0=adjProb(cur.prob,cur.conf);
      h+=`<div class="card card-last"><div class="slabel">DETALLE POR HORA — HOY</div>
        <div class="barwrap">${todayPreds.map(({hour,prob,conf})=>{const p=adjProb(prob,conf),isN=hour===now.getHours();return`<div class="bcol"><div class="b" style="height:${Math.max(3,p*44)}px;background:${isN?'#f59e0b':`rgba(239,68,68,${p*0.85+0.05})`};${isN?'outline:2px solid #f59e0b;outline-offset:1px':''}"></div>${hour%6===0?`<span class="bl">${pad(hour)}</span>`:''}</div>`;}).join('')}</div>
        <div style="margin-top:8px;font-size:12px;color:#94a3b8">Ahora (${pad(now.getHours())}:00): <span style="font-weight:600;color:${riskColor(p0)}">${riskLabel(p0,cur.conf)}${cur.conf>=0.15?' &middot; '+Math.round(p0*100)+'%':''}</span></div>
      </div>`;
    }

    if(!outages.length) h+=`<div class="empty">${icons.plugX}<p>Sin registros. Toca + para comenzar.</p></div>`;

    h+=`<div class="disclaimer">
      Herramienta independiente de uso personal. Los datos registrados son exclusivamente tuyos, cifrados en la base de datos y no se cruzan con ningún otro registro. Esta app no pertenece a ningún estudio sociológico, institución ni entidad gubernamental. La precisión de las predicciones mejora con la cantidad de datos registrados.
    </div>`;

    h+=`<button class="fab ${active?'fab-off':'fab-on'}" onclick="setTab('log')">${active?icons.bulb:icons.plus}</button>`;
  }

  if(tab==='log') {
    if(!active) {
      h+=`<div class="card card-red"><div class="slabel">REGISTRAR SALIDA DE LUZ</div>
        <div class="trow">
          <div class="ff"><label>Fecha</label><input type="date" value="${appState.startDate}" onchange="setApp('startDate',this.value)"></div>
          <div class="ff"><label>Hora</label>${renderTimePicker('startTime',appState.startTime)}</div>
        </div>
        <button class="bmain bdanger" onclick="startOutage()">${icons.boltOff}Se fue la luz</button>
      </div>`;
    } else {
      h+=`<div class="card card-red">
        <div class="abanner"><div class="al">Corte activo desde las ${fmtTime(active.start)}</div><div class="ad">${fmtDur(activeMins)} sin luz</div></div>
        <div class="slabel">REGISTRAR REGRESO DE LUZ</div>
        <div class="trow-now">
          <div class="ff"><label>Fecha</label><input type="date" value="${appState.endDate}" onchange="setApp('endDate',this.value)"></div>
          <div class="ff"><label>Hora</label>${renderTimePicker('endTime',appState.endTime)}</div>
          <button class="bnow" onclick="syncNow()">${icons.clock}Ahora</button>
        </div>
        ${renderMoodPicker()}
        <button class="bmain bsuccess" onclick="endOutage()">${icons.bulb}Volvió la luz</button>
      </div>`;
    }

    const flucDisabled=!!active;
    h+=`<div class="card card-ora" style="${flucDisabled?'opacity:.6':''}">
      <div class="slabel" style="color:var(--ora-t)">REGISTRAR FLUCTUACIÓN</div>
      ${flucDisabled
        ?`<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(239,68,68,.1);border-radius:var(--rs);margin-bottom:10px;font-size:13px;color:var(--red-t)">
            <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.5;flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            No se pueden registrar fluctuaciones con un corte activo.
          </div>`
        :`<p style="font-size:13px;color:var(--text2);margin-bottom:10px">Bajón, pico o microcorte que disparó el protector (&lt;1 min).</p>
          <div class="trow">
            <div class="ff"><label>Fecha</label><input type="date" value="${appState.startDate}" onchange="setApp('startDate',this.value)"></div>
            <div class="ff"><label>Hora</label>${renderTimePicker('startTime',appState.startTime)}</div>
          </div>`}
      <button id="fluc-btn" class="bmain borange" ${flucDisabled?'disabled':'onclick="logFluc()"'}>${icons.zap}Registrar fluctuación</button>
    </div>
    <div class="card card-last">
      <button class="bghost" onclick="appState.showManual=!appState.showManual;render()">${showManual?icons.chevU:icons.chevD}Registrar corte pasado completo</button>`;

    if(showManual) {
      const dur = appState.manualStart&&appState.manualEnd&&appState.manualDate
        ? (new Date(`${appState.manualDate}T${appState.manualEnd}`)-new Date(`${appState.manualDate}T${appState.manualStart}`))/60000
        : 0;
      h+=`<div style="margin-top:14px">
        <div class="trow3">
          <div class="field" style="margin:0"><label>Fecha</label><input type="date" value="${appState.manualDate}" onchange="setApp('manualDate',this.value)"></div>
          <div class="field" style="margin:0"><label>Inicio</label>${renderTimePicker('manualStart',appState.manualStart)}</div>
          <div class="field" style="margin:0"><label>Fin</label>${renderTimePicker('manualEnd',appState.manualEnd)}</div>
        </div>
        ${dur>0?`<div style="font-size:12px;color:#94a3b8;margin-bottom:10px">Duración: ${fmtDur(dur)}</div>`:''}
        ${renderMoodPicker()}
        <button class="bsm" onclick="addManual()">Guardar</button>
      </div>`;
    }
    h+=`</div>`;
  }

  if(tab==='predict') {
    if(!heatmap) h+=`<div class="empty">${icons.predict}<p>Necesitas al menos 1 corte para ver predicciones.</p></div>`;
    else {
      h+=`<div class="card"><div class="slabel">HOY — ${DAYS_FULL[now.getDay()].toUpperCase()} — RIESGO POR HORA</div>`;
      todayPreds.filter(p=>p.hour>=5&&p.hour<=23).forEach(({hour,prob,conf})=>{
        const p=adjProb(prob,conf),isN=hour===now.getHours(),estDur=durByH[hour];
        h+=`<div class="prow ${isN?'now':''}">
          <div class="phour ${isN?'now':''}">${pad(hour)}:00${isN?' ◀':''}</div>
          <div class="ptrack"><div class="pfill" style="width:${Math.round(p*100)}%;background:${riskColor(p)}"></div></div>
          <div class="ppct">${prob>0&&conf>=0.15?Math.round(p*100)+'%':'—'}</div>
          <div class="plabel" style="color:${riskColor(p)}">${riskLabel(p,conf)}${estDur&&p>=0.18?` ~${fmtDur(estDur)}`:''}</div>
        </div>`;
      });
      h+=`</div>
      <div class="card card-last"><div class="slabel">MAPA DE CALOR SEMANAL</div>
        <div class="hmwrap"><div class="hm">
          <div class="hmhours">${[0,4,8,12,16,20].map(x=>`<span>${pad(x)}</span>`).join('')}</div>
          ${DAYS_SHORT.map((day,di)=>`<div class="hmrow"><div class="hmday ${di===now.getDay()?'today':''}">${day}</div><div class="hmcells">${Array.from({length:24},(_,h2)=>{const d=heatmap[`${di}_${h2}`]||{prob:0,conf:0},p=adjProb(d.prob,d.conf),isN=di===now.getDay()&&h2===now.getHours();return`<div class="hmcell ${isN?'now':''}" title="${day} ${pad(h2)}:00 — ${Math.round(p*100)}%" style="background:${p<0.03?'rgba(255,255,255,.05)':`rgba(239,68,68,${Math.min(p*2,0.9)})`}"></div>`;}).join('')}</div></div>`).join('')}
          <div class="hmleg"><span style="font-size:10px;color:#475569">Riesgo:</span>${[['Bajo','0.2'],['Medio','0.5'],['Alto','0.85']].map(([l,o])=>`<div style="display:flex;align-items:center;gap:3px"><div class="legbox" style="background:rgba(239,68,68,${o})"></div><span style="font-size:10px;color:#475569">${l}</span></div>`).join('')}</div>
          <div class="infobox">Solo cortes alimentan el modelo. La columna derecha muestra duración estimada en horas de riesgo real.</div>
        </div></div>
      </div>`;
    }
  }

  if(tab==='community') {
    if(!communityState.data&&!communityState.loading){loadCommunity();h+=`<div class="empty"><p>Cargando...</p></div>`;}
    else if(communityState.loading) h+=`<div class="empty"><p>Cargando...</p></div>`;
    else {
      const {active:ca,todayByCity,totals}=communityState.data, myCity=authState.user?.city||'';
      h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div class="scard"><div class="sval-grn">${totals.total_users}</div><div class="slb">Usuarios registrados</div></div>
        <div class="scard"><div class="${totals.active_now>0?'sval-ora':'sval-grn'}">${totals.active_now}</div><div class="slb">Sin luz ahora</div></div>
      </div>`;
      if(ca.length) {
        h+=`<div class="card" style="margin-bottom:12px"><div class="slabel">SIN LUZ AHORA</div>`;
        ca.forEach(u=>{const mins=(now-new Date(u.start_time))/60000;h+=`<div class="comm-user"><div class="comm-dot"></div><div style="flex:1"><div style="font-size:14px;font-weight:600">@${u.username}${u.username===authState.user?.username?' <span style="color:var(--amber);font-size:11px">(tú)</span>':''}</div><div style="font-size:12px;color:var(--text2)">${u.city}${u.zone?' &middot; '+u.zone:''}</div></div><div style="font-size:13px;font-weight:600;color:var(--red-t)">${fmtDur(mins)}</div></div>`;});
        h+=`</div>`;
      } else {
        h+=`<div class="card card-grn" style="margin-bottom:12px"><div style="font-size:14px;color:var(--grn-t)">&#10003; Nadie sin luz ahora mismo.</div></div>`;
      }
      if(todayByCity.length) {
        const maxMins=Math.max(...todayByCity.map(r=>r.total_mins));
        h+=`<div class="card card-last"><div class="slabel">HOY POR CIUDAD</div>`;
        todayByCity.forEach(r=>{h+=`<div class="comm-city-row"><div style="width:80px;font-size:13px;font-weight:${r.city===myCity?700:400};color:${r.city===myCity?'var(--amber)':'var(--text)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.city}</div><div class="comm-bar-track"><div class="comm-bar-fill" style="width:${maxMins>0?Math.round(r.total_mins/maxMins*100):0}%"></div></div><div style="width:58px;text-align:right;font-size:12px;color:var(--text2)">${fmtDur(r.total_mins)}</div><div style="width:52px;text-align:right;font-size:11px;color:var(--text3)">${r.cortes} corte${r.cortes!==1?'s':''}</div></div>`;});
        h+=`</div>`;
      }
    }
    h+=`<button class="bmore" onclick="loadCommunity()">&#8635; Actualizar</button>`;
  }

  if(tab==='history') {
    const cortes=outages.filter(o=>o.end&&(o.type||'corte')==='corte');
    const flucs=outages.filter(o=>(o.type||'corte')==='fluctuacion');
    const totalMins=cortes.reduce((s,o)=>s+(o.duration_minutes||0),0);
    h+=`<div style="font-size:13px;color:#94a3b8;margin-bottom:12px">${cortes.length} corte${cortes.length!==1?'s':''} &middot; ${fmtDur(totalMins)} sin luz &nbsp;&middot;&nbsp; ${flucs.length} fluctuación${flucs.length!==1?'es':''}</div>`;
    if(!outages.length) h+=`<div class="empty">${icons.history}<p>Sin registros aún.</p></div>`;
    else {
      const visible=outages.slice(0,appState.histPage*PAGE_SIZE), hasMore=outages.length>visible.length;
      h+=`<div class="hlist">`;
      visible.forEach(o=>{
        const isFluc=(o.type||'corte')==='fluctuacion';
        const am=active&&o.id===active.id?(now-new Date(o.start))/60000:0;
        const moodInfo=o.mood?MOODS.find(m=>m.value===o.mood):null;
        h+=`<div class="hitem ${isFluc?'hitem-fluc':''}">
          <div class="hmeta">
            <div class="hdate">
              ${fmtDate(o.start)}
              ${isFluc?`<span class="tag tag-fluc">FLUCTUACIÓN</span>`:''}
              ${moodInfo?`<span title="${moodInfo.label}" style="font-size:14px">${moodInfo.emoji}</span>`:''}
            </div>
            <div class="htime">${fmtTime(o.start)}${!isFluc?` &ndash; ${o.end?fmtTime(o.end):'en curso'}`:''}</div>
          </div>
          ${isFluc?`<div class="hdur-fluc">&#9889;</div>`:`<div class="hdur">${o.end?fmtDur(o.duration_minutes):fmtDur(am)}${!o.end?'<div class="hactive">en curso</div>':''}</div>`}
          ${deleteId===o.id
            ?`<div style="display:flex;gap:4px"><button class="byes" onclick="deleteOutage('${o.id}')">Sí</button><button class="bno" onclick="cancelDel()">No</button></div>`
            :`<button class="bicon" onclick="askDel('${o.id}')">${icons.trash}</button>`}
        </div>`;
      });
      h+=`</div>`;
      if(hasMore) h+=`<button class="bmore" onclick="appState.histPage++;render()">Cargar ${Math.min(outages.length-visible.length,PAGE_SIZE)} más &nbsp;&middot;&nbsp; ${outages.length-visible.length} restantes</button>`;
    }
  }

  h+=`</div>`;

  if(profileState.open) {
    h+=`<div class="overlay" onclick="if(event.target.classList.contains('overlay')){profileState.open=false;render()}">
      <div class="overlay-card">
        <div class="overlay-header"><div class="overlay-title">@${authState.user.username}</div><button class="bicon" onclick="profileState.open=false;render()">${icons.x}</button></div>`;
    if(profileState.loading) h+=`<p style="color:var(--text3);font-size:14px">Cargando...</p>`;
    else if(profileState.data) {
      const st=profileState.data.stats;
      h+=`<div class="sgrid3" style="margin-bottom:16px">
        <div class="scard"><div class="sval" style="font-size:16px">${st.total_cortes}</div><div class="slb">Cortes</div></div>
        <div class="scard"><div class="sval" style="font-size:16px">${fmtDur(st.total_mins)}</div><div class="slb">Sin luz</div></div>
        <div class="scard"><div class="sval-ora" style="font-size:16px">${st.total_flucs}</div><div class="slb">Fluctuac.</div></div>
      </div>
      <div class="trow" style="margin-bottom:12px">
        <div class="field" style="margin:0"><label>Ciudad</label><input value="${profileState.editCity}" oninput="profileState.editCity=this.value" placeholder="Caracas"></div>
        <div class="field" style="margin:0"><label>Zona</label><input value="${profileState.editZone}" oninput="profileState.editZone=this.value" placeholder="Zona Norte"></div>
      </div>
      <div class="toggle-row" style="margin-bottom:14px">
        <div><div style="font-size:14px">Perfil público</div><div style="font-size:12px;color:var(--text2)">Tu actividad es visible en Comunidad</div></div>
        <button class="toggle ${profileState.editPublic?'on':'off'}" onclick="profileState.editPublic=!profileState.editPublic;render()"></button>
      </div>
      <details style="margin-bottom:14px"><summary style="cursor:pointer;font-size:13px;color:var(--text2);padding:8px 0">Cambiar contraseña</summary>
        <div style="margin-top:10px">
          <div class="field"><label>Contraseña actual</label><input type="password" value="${profileState.pwCurrent}" oninput="profileState.pwCurrent=this.value"></div>
          <div class="field"><label>Nueva contraseña</label><input type="password" value="${profileState.pwNew}" oninput="profileState.pwNew=this.value"></div>
          ${profileState.pwErr?`<div class="auth-err">${profileState.pwErr}</div>`:''}
          ${profileState.pwOk?`<div style="color:var(--grn-t);font-size:13px;margin-bottom:8px">&#10003; Contraseña actualizada</div>`:''}
        </div>
      </details>
      ${profileState.saveOk?`<div style="color:var(--grn-t);font-size:13px;margin-bottom:10px">&#10003; Cambios guardados</div>`:''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px">
        <button class="bsm" onclick="saveProfile()">Guardar cambios</button>
        <a class="bsm" href="/api/export" download>${icons.download}Exportar CSV</a>
        <button class="bsm" style="color:var(--red-t);border-color:var(--red-bd)" onclick="doLogout()">${icons.logout}Cerrar sesión</button>
      </div>
      <div class="danger-zone">
        <div class="danger-title">ZONA DE PELIGRO</div>
        <div class="danger-desc">Borra tu cuenta y todos tus registros permanentemente. Sin vuelta atrás.</div>
        ${profileState.confirmDelete
          ?`<div style="font-size:13px;color:var(--red-t);margin-bottom:8px;font-weight:600">¿Seguro? Se borrarán ${st.total_cortes} cortes y ${st.total_flucs} fluctuaciones.</div>
            <div style="display:flex;gap:8px"><button class="byes" onclick="deleteAccount()">Sí, borrar todo</button><button class="bno" onclick="profileState.confirmDelete=false;render()">Cancelar</button></div>`
          :`<button class="bdel-account" onclick="deleteAccount()">Borrar mi cuenta</button>`}
      </div>`;
    }
    h+=`</div></div>`;
  }

  return h;
}

function setTab(t) { appState.tab=t; appState.deleteId=null; appState.histPage=1; appState.startDate=todayDate(); appState.startTime=nowTime(); if(t==='community'&&!communityState.data) loadCommunity(); render(); }
function setApp(k,v) { appState[k]=v; render(); }
function setAuth(k,v) { authState[k]=v; authState.error=''; render(); }
function setTimeHour(key,h) { const p=(appState[key]||'00:00').split(':'); appState[key]=`${h}:${p[1]||'00'}`; render(); }
function setTimeMin(key,m) { const p=(appState[key]||'00:00').split(':'); appState[key]=`${p[0]||'00'}:${m}`; render(); }
function askDel(id) { appState.deleteId=id; render(); }
function cancelDel() { appState.deleteId=null; render(); }
function syncNow() { appState.endDate=todayDate(); appState.endTime=nowTime(); render(); }

init();
