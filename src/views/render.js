import { ACTION_TYPES as A } from '../../constants/actionTypes.js';
import { DAO } from '../dao.js';
import { ts, pct, setText, setAttr, dlFile } from '../../utils.js';
import { dispatch, scheduleRender } from '../reducer.js';

// ═══════════════════════════════════════════════════════════════════
export function render(s) {
  document.documentElement.setAttribute('data-theme', s.highContrast ? 'high-contrast' : 'default');
  renderRole(s);
  renderPanels(s);
  renderAlarmBanner(s);
  renderHUD(s);
  renderCharts(s);
  renderAuditPanel(s);
  renderSafetyPanel(s);
  renderSecondaryStats(s);
  renderDiagnostics(s);
  renderAIPredictions(s);
  renderAnomalyList(s);
  renderCopilotSteps(s);
  renderSystemHealth(s);
  renderCyberPanel(s);
}

export function renderRole(s) {
  setText('role-badge', s.role || '---');
  setText('sidebar-role', s.role ? { OL:'Local Operator', OD:'Diagnostic Operator', AS:'System Admin' }[s.role] : 'Not Authenticated');
  setText('ai-role', s.role || '---');
  const aiTs = document.getElementById('ai-init-ts');
  if (aiTs && s.sessionStart) aiTs.textContent = ts();
}

export function renderPanels(s) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(s.activePanel);
  if (el) el.classList.add('active');

  document.querySelectorAll('.nav-s, .nav-t').forEach(b => {
    const match = b.getAttribute('data-panel') === s.activePanel;
    b.classList.toggle('active', match);
    if (!match) b.classList.add('text-[#6c757d]','border-transparent');
    else        b.classList.remove('text-[#6c757d]','border-transparent');
  });
}

export function renderAlarmBanner(s) {
  const banner = document.getElementById('alarm-banner');
  // ISA-101: Shelved alarms are suppressed from the active banner
  const active = s.alarms.filter(a => !a.acked && !a.shelved);
  if (s.bannerOn && active.length > 0) {
    banner.style.height = '2.25rem';
    
    // Calculate priority counts
    const counts = { 1:0, 2:0, 3:0 };
    active.forEach(a => counts[a.p]++);
    
    const top = active.reduce((a,b) => a.p < b.p ? a : b);
    const col   = top.p===1?'#e31a1a':top.p===2?'#d97d06':'#cd5c08';
    const bg    = top.p===1?'#fcdcdc':top.p===2?'#fcecd5':'#fce3d5';
    document.getElementById('alarm-inner').style.background = bg;
    document.getElementById('alarm-icon').style.color = col;
    
    // Add priority count indicator
    const countText = `[P1:${counts[1]} P2:${counts[2]} P3:${counts[3]}] `;
    
    document.getElementById('alarm-text').style.color = col;
    document.getElementById('alarm-text').textContent = countText + active
      .sort((a,b)=>a.p-b.p)
      .map(a=>`[P${a.p}] ${a.tag}: ${a.msg}${a.firstOut?' [FIRST-OUT]':''}`)
      .join(' ·· ');
    const ab = document.getElementById('btn-ack-all');
    ab.style.borderColor=col+'55'; ab.style.color=col;
  } else {
    banner.style.height = '0';
  }
}

export function renderHUD(s) {
  const ss = s.sensors;
  setText('hud-inlet',  ss.COOLANT_IN?.v.toFixed(1) ?? '---');
  setText('hud-flux',   ss.NEUTRON_FLUX ? `${ss.NEUTRON_FLUX.v.toFixed(2)}e14` : '---');
  setText('hud-pump-a', ss.PUMP_A ? Math.round(ss.PUMP_A.v).toLocaleString() : '---');
  setText('hud-core',   ss.CORE_TEMP?.v.toFixed(1) ?? '---');
  setText('hud-press',  ss.PRIM_PRESS?.v.toFixed(1) ?? '---');
  setText('chart1-val', ss.CORE_TEMP?.v.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g,',') ?? '---');
  setText('chart2-val', ss.PRIM_PRESS?.v.toFixed(1) ?? '---');

  // Thermal margin to trip
  if (ss.CORE_TEMP) {
    const margin = 1 - (ss.CORE_TEMP.v - 900) / 300;
    const pctVal = Math.max(0, Math.min(100, margin * 100)).toFixed(0);
    const bar = document.getElementById('margin-bar');
    if (bar) {
      bar.style.width = pctVal + '%';
      bar.style.background = margin < 0.2 ? '#e31a1a' : margin < 0.35 ? '#d97d06' : '#159647';
    }
    setText('margin-pct', pctVal + '%');
  }

  // Power bar (% of rated from grid output)
  if (ss.GRID_OUT) {
    const pwr = Math.min(100, (ss.GRID_OUT.v / 500) * 100);
    const pb = document.getElementById('power-bar');
    if (pb) {
      pb.style.width = pwr.toFixed(1) + '%';
      pb.style.background = pwr < 50 ? '#e31a1a' : pwr < 80 ? '#d97d06' : '#159647';
    }
    setText('power-pct', pwr.toFixed(1) + '%');
  }
}

export function renderSystemHealth(s) {
  const activeUnshelved = s.alarms.filter(a => !a.acked && !a.shelved);
  const alarmCount = activeUnshelved.length;
  const p1count    = activeUnshelved.filter(a => a.p === 1).length;
  const sl = document.getElementById('sys-label');
  const sd = document.getElementById('sys-dot');
  if (!sl || !sd) return;

  if (s.scramActive) {
    sl.textContent = 'SCRAM ENGAGED';  sl.style.color = '#e31a1a';
    sd.style.background = '#e31a1a';
  } else if (p1count > 0) {
    sl.textContent = `${p1count} P1 ALARM${p1count>1?'S':''}`;  sl.style.color = '#e31a1a';
    sd.style.background = '#e31a1a'; sd.style.animation = 'blink 1s infinite';
  } else if (alarmCount > 0) {
    sl.textContent = `${alarmCount} ALARM${alarmCount>1?'S':''}`;  sl.style.color = '#d97d06';
    sd.style.background = '#d97d06'; sd.style.animation = '';
  } else {
    sl.textContent = 'SYSTEM READY';  sl.style.color = '#343a40';
    sd.style.background = '#159647'; sd.style.animation = '';
  }
}

export function renderCyberPanel(s) {
  if (s.role !== 'AS') return;

  const nodesEl = document.getElementById('cyber-nodes');
  if (nodesEl) {
    const nodes = [
      { id:'NODE-ALPHA',   label:'Reactor Core / Primary Loop',    status:'ONLINE',  latency:'4ms',  load:12 },
      { id:'NODE-BETA',    label:'Primary Pumps A/B',              status:'ONLINE',  latency:'3ms',  load:8  },
      { id:'NODE-GAMMA',   label:'Emergency Relief Valve',         status:'OFFLINE', latency:'—',    load:0  },
      { id:'NODE-DELTA',   label:'Steam Generator Loop',           status:'ONLINE',  latency:'5ms',  load:15 },
      { id:'NODE-EPSILON', label:'Turbine / Generator',            status:'ONLINE',  latency:'6ms',  load:22 },
      { id:'NODE-ZETA',    label:'Grid Interface',                 status:'ONLINE',  latency:'9ms',  load:18 },
      { id:'NODE-ETA',     label:'Politecnico AI Physics Core',    status:'ONLINE',  latency:'12ms', load:41 },
      { id:'NODE-THETA',   label:'Audit & Compliance Logger',      status:'ONLINE',  latency:'2ms',  load:3  },
    ];
    nodesEl.innerHTML = nodes.map(n => {
      const isOnline = n.status === 'ONLINE';
      const col      = isOnline ? '#159647' : '#e31a1a';
      const loadVal  = isOnline ? Math.max(1, n.load + Math.floor((Math.random()-.5)*5)) : 0;
      const loadBar  = isOnline ? `
        <div style="width:80px;height:3px;background:#f4f6f8;margin-top:4px;">
          <div style="width:${loadVal}%;height:100%;background:${loadVal>70?'#d97d06':'#495057'};
                      transition:width .8s ease;"></div>
        </div>` : '';
      return `<div style="display:flex;align-items:center;justify-content:space-between;
                           padding:8px 0;border-bottom:1px solid rgba(0,0,0,.04);">
        <div>
          <div style="font-family:'Courier New',monospace;font-size:11px;font-weight:700;
                      color:#343a40;text-transform:uppercase;">${n.id}</div>
          <div style="font-family:'Courier New',monospace;font-size:12px;color:#6c757d;
                      margin-top:2px;">${n.label}</div>
          ${loadBar}
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:12px;">
          <div style="font-family:'Courier New',monospace;font-size:11px;font-weight:700;
                      color:${col};">${n.status}</div>
          <div style="font-family:'Courier New',monospace;font-size:11px;color:#6c757d;
                      margin-top:2px;">${n.latency} · ${loadVal > 0 ? loadVal+'% CPU' : '—'}</div>
        </div>
      </div>`;
    }).join('');
  }

  const logEl = document.getElementById('cyber-log');
  if (logEl && !logEl.dataset.seeded) {
    logEl.dataset.seeded = '1';
    const entries = [
      { ts:'07:12:04', sev:'INFO',  msg:'TLS handshake verified — NODE-ETA ↔ HMI' },
      { ts:'07:12:01', sev:'INFO',  msg:'Certificate rotation — AES-512 keys refreshed' },
      { ts:'07:08:44', sev:'INFO',  msg:'Auth token issued — Role: AS · Session α78c' },
      { ts:'07:08:44', sev:'INFO',  msg:'Auth token issued — Role: OD · Session b12f' },
      { ts:'07:05:11', sev:'WARN',  msg:'NODE-GAMMA offline — last heartbeat 00:05:11 ago' },
      { ts:'07:01:00', sev:'INFO',  msg:'Firewall ruleset v4.2 applied — 2,048 rules active' },
      { ts:'06:58:33', sev:'INFO',  msg:'IDS scan complete — no anomalies detected' },
      { ts:'06:55:00', sev:'INFO',  msg:'System boot — CORE-SENTINEL v4.2 · IAEA compliant' },
    ];
    logEl.innerHTML = entries.map(e => {
      const col = e.sev === 'WARN' ? '#d97d06' : '#6c757d';
      return `<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid rgba(0,0,0,.04);">
        <span style="font-family:'Courier New',monospace;font-size:11px;color:#adb5bd;flex-shrink:0;">${e.ts}</span>
        <span style="font-family:'Courier New',monospace;font-size:11px;font-weight:700;
                     color:${col};flex-shrink:0;min-width:30px;">${e.sev}</span>
        <span style="font-family:'Courier New',monospace;font-size:11px;color:#495057;">${e.msg}</span>
      </div>`;
    }).join('');
  }

  const encEl = document.getElementById('cyber-enc');
  if (encEl && !encEl.dataset.seeded) {
    encEl.dataset.seeded = '1';
    const suites = [
      { label:'Transport',      val:'TLS 1.3',     status:'ACTIVE' },
      { label:'Data at Rest',   val:'AES-512',     status:'ACTIVE' },
      { label:'Key Exchange',   val:'ECDH P-521',  status:'ACTIVE' },
      { label:'Integrity',      val:'SHA-3-512',   status:'ACTIVE' },
      { label:'Auth',           val:'JWT RS-4096', status:'ACTIVE' },
      { label:'IDS Engine',     val:'Snort v3.1',  status:'ACTIVE' },
      { label:'Cert Expiry',    val:'2027-01-01',  status:'VALID'  },
      { label:'Last Key Rot.',  val:ts(),           status:'OK'     },
    ];
    encEl.innerHTML = suites.map(suite => `
      <div style="display:flex;justify-content:space-between;align-items:center;
                  padding:6px 0;border-bottom:1px solid rgba(0,0,0,.04);">
        <div style="font-family:'Courier New',monospace;font-size:11px;color:#6c757d;">${suite.label}</div>
        <div style="text-align:right;">
          <div style="font-family:'Courier New',monospace;font-size:11px;font-weight:700;color:#343a40;">
            ${suite.val}</div>
          <div style="font-family:'Courier New',monospace;font-size:10px;color:#159647;
                      text-transform:uppercase;">${suite.status}</div>
        </div>
      </div>`).join('');
  }
}

export function renderCharts(s) {
  const toY = (v, lo, hi) => Math.max(4, Math.min(96, 100 - ((v-lo)/(hi-lo))*84));

  function buildPath(data, lo, hi) {
    return data.map((v,i) => `${i===0?'M':'L'} ${((i/(data.length-1))*150).toFixed(1)},${toY(v,lo,hi).toFixed(1)}`).join(' ');
  }
  function buildPred(data, lo, hi) {
    const n = data.length, last = data[n-1];
    const trend = (data[n-1] - data[Math.max(0,n-6)]) / Math.min(5,n-1);
    let d = `M 150,${toY(last,lo,hi).toFixed(1)}`;
    for (let i=1;i<=10;i++) d += ` L ${(150+(i/10)*150).toFixed(1)},${toY(last+trend*i*1.7,lo,hi).toFixed(1)}`;
    return d;
  }

  setAttr('ct-rt',   'd', buildPath(s.histTemp,  900, 1200));
  setAttr('ct-pred', 'd', buildPred(s.histTemp,  900, 1200));
  setAttr('cp-rt',   'd', buildPath(s.histPress, 150, 250));
  setAttr('cp-pred', 'd', buildPred(s.histPress, 150, 250));
}

export function renderAuditPanel(s) {
  const panel = document.getElementById('audit-panel');
  if (panel) { s.auditPanelOpen ? panel.classList.add('open') : panel.classList.remove('open'); }
  setText('audit-badge', s.auditLog.length > 99 ? '99+' : s.auditLog.length);
  const list = document.getElementById('audit-list');
  if (list) {
    list.innerHTML = [...s.auditLog].reverse().map(e =>
      `<div class="flex gap-2 py-1 border-b border-[rgba(0,0,0,.04)]">
        <span class="text-[#6c757d] shrink-0">${e.ts}</span>
        <span class="text-[11px] text-[#495057] shrink-0 uppercase">[${e.role||'SYS'}]</span>
        <span class="text-[#343a40]">${e.msg}</span>
      </div>`
    ).join('');
  }
}

export function renderSafetyPanel(s) {
  const badge = document.getElementById('safety-badge');
  const lock  = document.getElementById('safety-lock');
  if (badge) {
    if (s.role==='OD'||s.role==='AS') {
      badge.textContent=`ACCESS GRANTED — ${s.role}`; badge.style.color='#159647'; badge.style.borderColor='#15964733';
    } else {
      badge.textContent='MONITORING ONLY — OL'; badge.style.color='#d97d06'; badge.style.borderColor='#d97d0633';
    }
  }
  if (lock) lock.style.display = (s.role==='OL') ? 'flex' : 'none';

  const rt = document.getElementById('rod-table');
  if (rt && s.controlRods) {
    const avgPos = s.sensors.ROD_POS?.v ?? 72;
    rt.innerHTML = s.controlRods.map(r => {
      const pos = s.scramActive ? Math.min(100, r.pos + avgPos * 0.1 + 15) : r.pos + (avgPos - 72) * 0.2;
      const col = pos > 85 ? '#d97d06' : pos < 20 ? '#e31a1a' : '#343a40';
      return `<div class="flex items-center gap-2 tv text-[12px] mb-1.5">
        <span class="w-14 font-bold text-[#343a40] shrink-0">${r.id}</span>
        <div class="flex-1 h-1.5 bg-[#f4f6f8]">
          <div class="h-full transition-all duration-700" style="width:${Math.min(100,pos).toFixed(0)}%;background:${col}"></div>
        </div>
        <span class="w-12 text-right font-bold shrink-0" style="color:${col}">${Math.min(100,pos).toFixed(1)}%</span>
      </div>`;
    }).join('');
  }

  const it = document.getElementById('interlock-table');
  if (it && s.interlocks) {
    it.innerHTML = s.interlocks.map(i => {
      const c = i.st==='OFFLINE'?'#6c757d':i.st==='TRIPPED'?'#e31a1a':'#159647';
      return `<div class="flex items-center justify-between py-2 border-b border-[rgba(0,0,0,.04)]">
        <div>
          <div class="tv text-[12px] font-bold text-[#212529]">${i.label}</div>
          <div class="tv text-[11px] text-[#6c757d]">${i.tag} · SP: ${i.sp}</div>
        </div>
        <span class="tv text-[11px] font-bold px-1.5 py-0.5 shrink-0" style="color:${c};border:1px solid ${c}33">${i.st}</span>
      </div>`;
    }).join('');
  }

  const ss = document.getElementById('scram-status');
  if (ss) { ss.textContent = s.scramActive ? 'SCRAM ENGAGED' : 'ARMED / READY'; ss.style.color = s.scramActive ? '#e31a1a' : '#159647'; }
}

export function renderSecondaryStats(s) {
  const el = document.getElementById('sec-stats');
  if (!el) return;
  el.innerHTML = '';
  const ss = s.sensors;
  [
    { label:'SG Inlet Temperature', k:'SG_INLET',   pctVal:pct(ss.SG_INLET?.v,  420,550), col:'#cd5c08' },
    { label:'Steam Pressure',       k:'STEAM_PRESS', pctVal:pct(ss.STEAM_PRESS?.v,130,180),col:'#343a40' },
    { label:'Turbine Speed',        k:'TURBINE_RPM', pctVal:pct(ss.TURBINE_RPM?.v,2800,3200),col:'#159647'},
    { label:'Grid Output',          k:'GRID_OUT',    pctVal:pct(ss.GRID_OUT?.v,  400,500), col:'#159647' },
    { label:'Pump B Speed',         k:'PUMP_B',      pctVal:pct(ss.PUMP_B?.v,    2800,3600),col:'#159647'},
    { label:'Secondary Flow',       k:'SEC_FLOW',    pctVal:pct(ss.SEC_FLOW?.v,  2400,3200),col:'#343a40'},
  ].forEach(st => {
    const sr = ss[st.k];
    const val = sr ? DAO.fmt(sr) : '--';
    const unit = sr?.u ?? '';
    const isAlarm = sr && DAO.status(sr) === 'alarm';
    el.innerHTML += `<div class="bg-[#f4f6f8] border ${isAlarm?'border-[#e31a1a]/30':'border-[rgba(0,0,0,.06)]'} p-3 mb-2">
      <div class="tv text-[11px] text-[#6c757d] uppercase tracking-wider font-bold">${st.label}</div>
      <div class="tv text-xl font-bold mt-0.5" style="color:${isAlarm?'#e31a1a':'#212529'}">${val} <span class="text-xs font-normal text-[#6c757d]">${unit}</span></div>
      <div class="w-full h-1 bg-[#d1d6dc] mt-2">
        <div class="h-full transition-all duration-1000" style="width:${Math.min(100,Math.max(0,st.pctVal)).toFixed(0)}%;background:${isAlarm?'#e31a1a':st.col}"></div>
      </div>
      </div>
    </div>`;
  });

  const secStatus = document.getElementById('sec-status');
  if (secStatus) {
    const isSecAlarm = ['SG_INLET','STEAM_PRESS','TURBINE_RPM','GRID_OUT','PUMP_B','SEC_FLOW']
      .some(k => ss[k] && DAO.status(ss[k]) === 'alarm');

    if (s.scramActive) {
      secStatus.textContent = 'LOOP STATUS: SCRAM ISOLATION';
      secStatus.className = 'tv text-[11px] px-2 py-1 border border-[#e31a1a]/30 bg-[#e31a1a]/5 text-[#e31a1a] font-bold uppercase tracking-wider';
    } else if (isSecAlarm) {
      secStatus.textContent = 'LOOP STATUS: ALARM DEVIATION';
      secStatus.className = 'tv text-[11px] px-2 py-1 border border-[#cd5c08]/30 bg-[#cd5c08]/5 text-[#cd5c08] font-bold uppercase tracking-wider blink';
    } else {
      secStatus.textContent = 'LOOP STATUS: NOMINAL';
      secStatus.className = 'tv text-[11px] px-2 py-1 border border-[#159647]/30 bg-[#159647]/5 text-[#159647] font-bold uppercase tracking-wider';
    }
  }

  if (ss.SG_INLET) setText('svg-sec-hot', `${DAO.fmt(ss.SG_INLET)}°C →`);
  if (ss.SG_INLET) setText('svg-sec-cold', `← ${(ss.SG_INLET.v - 100).toFixed(1)}°C`);
  if (ss.STEAM_PRESS) setText('svg-sec-steam', `STEAM ${DAO.fmt(ss.STEAM_PRESS)} bar`);
}

export function renderDiagnostics(s) {
  const tbody = document.getElementById('sensor-tbody');
  if (!tbody) return;
  const q = (document.getElementById('diag-search')?.value || '').toLowerCase();
  const sensors = Object.values(s.sensors).filter(sr =>
    !q || sr.tag.toLowerCase().includes(q) || sr.label.toLowerCase().includes(q) || sr.sys.toLowerCase().includes(q)
  );
  setText('diag-count', `${sensors.length} of ${Object.keys(s.sensors).length} sensors`);
  const now = ts();
  const scol = { alarm:'#e31a1a', warning:'#d97d06', low:'#cd5c08', nominal:'#159647' };
  const slbl = { alarm:'ALARM', warning:'WARN', low:'LOW', nominal:'NOM' };
  tbody.innerHTML = sensors.map(sr => {
    const st = DAO.status(sr);
    const c  = scol[st];
    const rb = st==='alarm'?'rgba(255,32,32,.05)':st==='warning'?'rgba(255,208,32,.04)':'';
    return `<tr class="sr" style="${rb?`background:${rb}`:''}">
      <td class="px-5 py-2 tv font-bold text-[#212529]">${sr.tag}</td>
      <td class="px-3 py-2 tv text-[#6c757d] text-[12px]">${sr.label}</td>
      <td class="px-3 py-2 tv text-[#6c757d] text-[12px] uppercase">${sr.sys}</td>
      <td class="px-3 py-2 tv text-right font-bold" style="color:${c}">${DAO.fmt(sr)}</td>
      <td class="px-3 py-2 tv text-right text-[#6c757d] text-[12px]">${sr.u}</td>
      <td class="px-3 py-2 tv text-right text-[#6c757d] text-[12px]">${sr.trip}</td>
      <td class="px-3 py-2 tv text-center"><span class="text-[11px] font-bold px-1.5 py-0.5" style="color:${c};border:1px solid ${c}40">${slbl[st]}</span></td>
      <td class="px-5 py-2 tv text-right text-[#6c757d] text-[11px]">${now}</td>
    </tr>`;
  }).join('');
}

export function renderAIPredictions(s) {
  const el = document.getElementById('ai-predictions');
  if (!el) return;
  const ss = s.sensors;
  el.innerHTML = [
    { label:'Core Temp',     val:`${((ss.CORE_TEMP?.v||1045)+8.4).toFixed(1)} °C`,   col:'#343a40' },
    { label:'Primary Press', val:`${((ss.PRIM_PRESS?.v||215)+12.1).toFixed(1)} PSI`, col:'#d97d06' },
    { label:'Neutron Flux',  val:'Stable ±0.1%',                                      col:'#343a40' },
    { label:'Grid Output',   val:`${((ss.GRID_OUT?.v||478)+1.6).toFixed(1)} MWe`,    col:'#159647' },
  ].map(p => `<div class="flex items-center justify-between py-1.5 border-b border-[rgba(0,0,0,.06)]">
    <span class="tv text-[12px] text-[#6c757d]">${p.label}</span>
    <span class="tv text-[12px] font-bold" style="color:${p.col}">${p.val}</span>
  </div>`).join('');
}

export function renderAnomalyList(s) {
  const el = document.getElementById('anomaly-list');
  if (!el) return;
  const active = s.alarms.filter(a => !a.cleared).slice(0, 10);
  if (!active.length) {
    el.innerHTML = '<div class="tv text-[12px] text-[#6c757d] italic">No active anomalies</div>';
    return;
  }
  el.innerHTML = active.map(a => {
    const col   = a.p===1 ? '#e31a1a' : a.p===2 ? '#d97d06' : '#cd5c08';
    const shape = a.p===1 ? '■' : a.p===2 ? '▲' : '●'; // ISA-101 shapes

    return `<div class="p-3 border border-l-4 space-y-1 mb-2 transition-all" style="border-color:${col}33;border-left-color:${col};background:${a.shelved?'#f4f6f8':col+'09'};opacity:${a.shelved?0.6:1}">
      <div class="flex justify-between items-start">
        <div class="tv text-[11px] font-bold uppercase tracking-wider" style="color:${col}">${shape} P${a.p}${a.shelved?' [SHELVED]':''} — ${a.tag}</div>
        <div class="tv text-[11px] text-[#6c757d]">${a.ts}</div>
      </div>
      <div class="tv text-[12px] text-[#212529]" style="${a.shelved?'text-decoration:line-through':''}">${a.msg}</div>
      <div class="flex gap-2 pt-1">
        ${!a.acked ? `<button class="ack-btn tv text-[10px] uppercase font-bold text-[#212529] bg-[#d1d6dc] hover:bg-[#c2c7cd] px-2 py-0.5 border border-[#495057] transition-colors" data-id="${a.id}">ACKNOWLEDGE</button>` : ''}
        ${(s.role === 'OD' || s.role === 'AS') ? (
          a.shelved
          ? `<button class="unshelf-btn tv text-[10px] uppercase font-bold text-[#159647] border border-[#159647] px-2 py-0.5 hover:bg-[#159647] hover:text-white transition-colors" data-id="${a.id}">UNSHELVE</button>`
          : `<button class="shelf-btn tv text-[10px] uppercase font-bold text-[#6c757d] border border-[#6c757d] px-2 py-0.5 hover:bg-[#6c757d] hover:text-white transition-colors" data-id="${a.id}">SHELVE (SUPPRESS)</button>`
        ) : ''}
      </div>
    </div>`;
  }).join('');

  el.querySelectorAll('.ack-btn').forEach(b => b.addEventListener('click', () => dispatch(A.ACK_ALL)));
  el.querySelectorAll('.shelf-btn').forEach(b => b.addEventListener('click', () => dispatch(A.SHELF_ALARM, {id:b.dataset.id})));
  el.querySelectorAll('.unshelf-btn').forEach(b => b.addEventListener('click', () => dispatch(A.UNSHELVE_ALARM, {id:b.dataset.id})));
}

export function renderCopilotSteps(s) {
  const el = document.getElementById('copilot-steps');
  if (!el) return;
  const STEPS = [
    {n:1, title:'Monitor Coolant Pressure',  desc:'Verified nominal range ±2%',                      btn:false},
    {n:2, title:'Compare to Simulated Model',desc:'Delta: -2.4% pressure drop predicted in T+45s',   btn:true },
    {n:3, title:'Adjust Control Rod Depth',  desc:'Pending: awaiting step 2 completion',             btn:true },
    {n:4, title:'Verify Thermal Balance',    desc:'Automated check — T+3 min',                       btn:false},
  ];
  el.innerHTML = `<div class="tv text-[11px] text-[#6c757d] uppercase tracking-widest mb-2">Protocol SCCP-74A</div>` +
    STEPS.map(st => {
      const done=st.n<s.protocolStep, active=st.n===s.protocolStep;
      const cls = done   ? 'flex gap-2 p-2.5 bg-[#159647]/5 border-l-2 border-[#159647] mb-2'
                : active ? 'flex gap-2 p-2.5 bg-[#d1d6dc] border-l-4 border-[#495057] mb-2'
                :          'flex gap-2 p-2.5 mb-2 opacity-40';
      const numHtml = done
        ? `<div class="w-5 h-5 rounded-full border border-[#159647] text-[#159647] flex items-center justify-center flex-shrink-0"><span class="ms material-symbols-outlined text-[11px]">check</span></div>`
        : `<div class="w-5 h-5 rounded-full border ${active?'border-[#495057] text-[#343a40]':'border-[#adb5bd] text-[#adb5bd]'} flex items-center justify-center flex-shrink-0 tv text-[12px] font-bold">${st.n}</div>`;
      const ackBtn = (active && st.btn)
        ? `<button class="copilot-ack mt-1.5 tv text-[11px] px-2 py-0.5 bg-[#d1d6dc] hover:bg-[#ced4da] border border-[rgba(0,0,0,.1)] font-bold uppercase tracking-wider transition-colors">ACKNOWLEDGE STEP</button>`
        : '';
      return `<div class="${cls}">${numHtml}
        <div class="flex-1">
          <div class="tv text-[12px] font-bold uppercase text-[#212529]">${st.title}</div>
          <div class="tv text-[11px] text-[#6c757d] italic mt-0.5">${st.desc}</div>
          ${ackBtn}
        </div>
      </div>`;
    }).join('');
  el.querySelectorAll('.copilot-ack').forEach(b => b.addEventListener('click', () => dispatch(A.ADVANCE_PROTOCOL)));
}