import { ACTION_TYPES as A } from '../constants/actionTypes.js';
import { S, setS } from './model.js';
import { DAO } from './dao.js';
import { dispatch, scheduleRender } from './reducer.js';
import { ts, p2, p3, escHtml, dlFile, setText, setAttr } from '../utils.js';
import { ScenarioEngine } from './scenario-engine.js';
import { renderDiagnostics } from './views/render.js';
import { RBACContext, bindGuardedButton } from './rbac-factory.js';


// ═══════════════════════════════════════════════════════════════════
let _onConfirm = null;
export function showModal({ icon='info', title, content, primary='ACKNOWLEDGE', secondary=null, onConfirm=null }) {
  const modalIcon = document.getElementById('modal-icon');
  if (modalIcon) modalIcon.textContent = icon;
  setText('modal-title', title);
  const modalContent = document.getElementById('modal-content');
  if (modalContent) modalContent.innerHTML = content;
  setText('btn-modal-pri', primary);
  const sec = document.getElementById('btn-modal-sec');
  if (sec) {
    if (secondary) {
      sec.textContent = secondary;
      sec.classList.remove('hidden');
    } else {
      sec.classList.add('hidden');
    }
  }
  _onConfirm = onConfirm;
  const ov = document.getElementById('modal-overlay');
  if (ov) {
    ov.classList.remove('hidden');
    ov.classList.add('flex');
  }
}

export function hideModal() {
  const ov = document.getElementById('modal-overlay');
  if (ov) {
    ov.classList.add('hidden');
    ov.classList.remove('flex');
  }
  _onConfirm = null;
}

// ═══════════════════════════════════════════════════════════════════
export function showDemoBar(msg, col) {
  const bar = document.getElementById('demo-bar');
  const inner = document.getElementById('demo-inner');
  if (!bar || !inner) return;
  bar.style.height = '2.5rem';
  const bg = col==='#e31a1a'?'#fcdcdc':col==='#159647'?'#03140a':col==='#d97d06'?'#141000':'#100c00';
  inner.style.background = bg;
  inner.style.borderColor = col + '40';
  setText('demo-bar-text', msg);
  const blink = document.querySelector('#demo-inner .blink');
  if (blink) {
    blink.style.color = col;
  }
}

export function hideDemoBar() {
  const bar = document.getElementById('demo-bar');
  if (bar) bar.style.height = '0';
}

export function setEmergencyOverlay(opacity) {
  const el = document.getElementById('three-emergency-overlay');
  if (el) el.style.opacity = Math.min(1, opacity);
}

// ═══════════════════════════════════════════════════════════════════
export function bindAll() {
  // Modal controls
  document.getElementById('btn-modal-close')?.addEventListener('click', hideModal);
  document.getElementById('btn-modal-sec')?.addEventListener('click', hideModal);
  document.getElementById('btn-modal-pri')?.addEventListener('click', () => { if(_onConfirm) _onConfirm(); hideModal(); });
  document.getElementById('modal-overlay')?.addEventListener('click', e => { if(e.target.id==='modal-overlay') hideModal(); });

  // Role selection
  document.querySelectorAll('.role-btn').forEach(b => {
    b.addEventListener('click', () => {
      const role = b.getAttribute('data-role');
      dispatch(A.SET_ROLE, {role});
      const overlay = document.getElementById('role-overlay');
      if (overlay) overlay.style.display = 'none';
      const aiTs = document.getElementById('ai-init-ts');
      if (aiTs) aiTs.textContent = ts();

      // ── RBAC: activate component factory for this role ──────────
      RBACContext.setRole(role);
      // Show Cybersecurity nav item only for AS
      const navCyber = document.getElementById('nav-cyber');
      if (navCyber) navCyber.style.display = role === 'AS' ? '' : 'none';
    });
  });

  // Navigation
  document.querySelectorAll('.nav-s, .nav-t').forEach(b => {
    b.addEventListener('click', () => {
      const panel = b.getAttribute('data-panel');
      if (panel) dispatch(A.NAVIGATE, {panel});
    });
  });

  // Alarm banner
  document.getElementById('btn-ack-all')?.addEventListener('click', () => dispatch(A.ACK_ALL));
  document.getElementById('btn-dismiss-banner')?.addEventListener('click', () => dispatch(A.DISMISS_BANNER));

  // Audit panel
  ['btn-audit-hdr','btn-logs'].forEach(id => document.getElementById(id)?.addEventListener('click', () => dispatch(A.TOGGLE_AUDIT)));
  document.getElementById('btn-close-audit')?.addEventListener('click', () => dispatch(A.TOGGLE_AUDIT));
  document.getElementById('btn-clear-audit')?.addEventListener('click', () => dispatch(A.CLEAR_AUDIT));
  document.getElementById('btn-export-audit')?.addEventListener('click', () => {
    const csv = 'Timestamp,Role,Event\n' + S.auditLog.map(e=>`"${e.ts}","${e.role}","${e.msg}"`).join('\n');
    dlFile(csv, `audit-${Date.now()}.csv`, 'text/csv');
    dispatch(A.LOG,{msg:'Audit log exported to CSV'});
  });

  // Demo button
  document.getElementById('btn-demo')?.addEventListener('click', () => {
    if (S.role === 'OL') {
      showModal({
        icon: 'lock',
        title: 'Access Denied — Emergency Simulator',
        content: `<div class="tv text-sm space-y-3">
          <div style="color:#e31a1a;font-weight:700;font-size:12px;padding:10px;
                      border:1px solid rgba(255,32,32,.2);background:rgba(255,32,32,.05);">
            PERMISSION DENIED — CMP-22
          </div>
          <p style="color:#343a40;font-size:11px;">
            The Emergency Scenario Simulator (CMP-22) requires Diagnostic Operator (OD) or System Admin (AS) role.
          </p>
        </div>`
      });
      return;
    }
    showModal({
      icon: 'science',
      title: 'Emergency Scenario Simulator',
      content: `<div class="tv space-y-3 text-sm">
        <div class="space-y-2 mt-3">
          <button id="demo-btn-a" class="w-full text-left p-3 border border-[rgba(0,0,0,.1)] hover:bg-[#d1d6dc] transition-colors">
            <span class="tv font-bold text-[#d97d06] text-[11px] uppercase tracking-wider">Scenario A — Rising Core Temperature</span>
          </button>
          <button id="demo-btn-b" class="w-full text-left p-3 border border-[rgba(0,0,0,.1)] hover:bg-[#d1d6dc] transition-colors">
            <span class="tv font-bold text-[#cd5c08] text-[11px] uppercase tracking-wider">Scenario B — Loss of Coolant Flow (LOCA)</span>
          </button>
          <button id="demo-btn-c" class="w-full text-left p-3 border border-[rgba(0,0,0,.1)] hover:bg-[#d1d6dc] transition-colors">
            <span class="tv font-bold text-[#e31a1a] text-[11px] uppercase tracking-wider">Scenario C — Station Blackout (SBO)</span>
          </button>
        </div>
      </div>`,
      primary: 'CLOSE',
    });

    setTimeout(() => {
      document.getElementById('demo-btn-a')?.addEventListener('click', () => { hideModal(); ScenarioEngine.runRisingTemp(); dispatch(A.NAVIGATE,{panel:'panel-primary'}); });
      document.getElementById('demo-btn-b')?.addEventListener('click', () => { hideModal(); ScenarioEngine.runLOCA();       dispatch(A.NAVIGATE,{panel:'panel-primary'}); });
      document.getElementById('demo-btn-c')?.addEventListener('click', () => { hideModal(); ScenarioEngine.runBlackout();   dispatch(A.NAVIGATE,{panel:'panel-primary'}); });
    }, 50);
  });

  document.getElementById('btn-demo-reset')?.addEventListener('click', () => ScenarioEngine.resetToNominal());

  // Settings
  document.getElementById('btn-settings')?.addEventListener('click', () => {
    showModal({
      icon:'settings', title:'HMI Configuration',
      content:`<div class="tv text-sm space-y-4">
        <label class="flex items-center justify-between cursor-pointer py-1 border-b border-[rgba(0,0,0,.06)]">
          <span class="text-[#343a40]">High-Contrast Mode</span>
          <input type="checkbox" id="s-hc" class="w-4 h-4 accent-[#495057]" ${S.highContrast ? 'checked' : ''}/>
        </label>
        <div class="pt-2">
          <label class="text-[11px] text-[#6c757d] uppercase tracking-wider">DAO Source Mode</label>
          <select id="s-dao" class="w-full mt-1 bg-[#f4f6f8] border border-[rgba(0,0,0,.1)] px-2 py-1.5 focus:outline-none">
            <option value="SIMULATED" ${DAO.mode==='SIMULATED'?'selected':''}>SIMULATED</option>
            <option value="PHYSICAL" ${DAO.mode==='PHYSICAL'?'selected':''}>PHYSICAL</option>
          </select>
        </div>
      </div>`,
      primary:'SAVE CHANGES', secondary:'CANCEL',
      onConfirm: () => {
        const dao = document.getElementById('s-dao')?.value || 'SIMULATED';
        DAO.mode = dao;
        dispatch(A.LOG,{msg:`Settings saved. DAO mode: ${dao}`});
        const hcChecked = document.getElementById('s-hc')?.checked ?? false;
        if (hcChecked !== S.highContrast) dispatch(A.TOGGLE_HIGH_CONTRAST);
      }
    });
  });

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    showModal({
      icon:'logout', title:'Terminate Session',
      content:'<p class="text-[#343a40]">Confirm session termination and hand-off to standby console.</p>',
      primary:'TERMINATE', secondary:'ABORT',
      onConfirm: () => {
        ScenarioEngine.stop();
        dispatch(A.LOG,{msg:'Session terminated'});
        setTimeout(() => {
          const overlay = document.getElementById('role-overlay');
          if (overlay) overlay.style.display = 'flex';
          dispatch(A.SET_ROLE, {role: null}); 
        }, 300);
      }
    });
  });

  // Help
  document.getElementById('btn-help')?.addEventListener('click', () => {
    showModal({
      icon:'help', title:'Protocol Documentation',
      content:'<p class="tv text-xs text-[#343a40]">Standard Operating Procedures (SOP-74A) for LFR-4G Core Operations.</p>'
    });
  });

  // ── Guarded Buttons (Safety Critical — IDs from component-registry.js) ──

  // SCRAM Control (CMP-09)
  bindGuardedButton('btn-scram', 'CMP-09', 'U', () => {
    if (S.scramActive) return;
    showModal({
      icon:'power_settings_new', title:'⚠ CONFIRM SCRAM',
      content:'<p class="text-sm text-[#343a40]">Immediate reactor shutdown. All control rods will be inserted.</p>',
      primary:'EXECUTE SCRAM', secondary:'ABORT',
      onConfirm: () => {
        dispatch(A.SCRAM);
        dispatch(A.ADD_ALARM,{alarm:{id:'SCRAM-MAN',p:1,tag:'SCRAM',msg:'Manual SCRAM engaged',acked:false,ts:ts()}});
        ScenarioEngine.stop();
      }
    });
  }, showModal);

  // Emergency Depressurize (CMP-12)
  bindGuardedButton('btn-depressurize', 'CMP-12', 'U', () => {
    showModal({
      icon:'warning', title:'Emergency Depressurize',
      content:'<p class="tv text-sm text-[#d97d06]">Confirm secondary circuit depressurization?</p>',
      primary:'CONFIRM', secondary:'CANCEL',
      onConfirm: () => {
        dispatch(A.LOG,{msg:'Emergency depressurization — ERV-01 opened'});
      }
    });
  }, showModal);

  // Reset Interlocks (CMP-13)
  bindGuardedButton('btn-reset-locks', 'CMP-13', 'U', () => {
    showModal({
      icon:'settings', title:'Reset Protection Interlocks',
      content:'<p class="tv text-sm text-[#343a40]">Reset all non-SCRAM interlocks to ARMED state.</p>',
      primary:'RESET', secondary:'CANCEL',
      onConfirm: () => dispatch(A.RESET_INTERLOCKS)
    });
  }, showModal);

  // Auto-Pilot Toggle (CMP-17)
  bindGuardedButton('btn-auto-pilot', 'CMP-17', 'U', () => {
    dispatch(A.TOGGLE_AUTOPILOT);
  }, showModal);

  // Diagnostic Export (CMP-19)
  bindGuardedButton('btn-diag-export', 'CMP-19', 'R', () => {
    const csv = 'Tag,Label,Value\n' + Object.values(S.sensors).map(s=>`"${s.tag}","${s.label}","${s.v}"`).join('\n');
    dlFile(csv, `sensors-${Date.now()}.csv`, 'text/csv');
  }, showModal);

  // AI Copilot handlers
  document.getElementById('btn-ai-query')?.addEventListener('click', handleAIQuery);
  document.getElementById('ai-query-input')?.addEventListener('keydown', e => { if(e.key==='Enter') handleAIQuery(); });

  // Diagnostics search
  document.getElementById('diag-search')?.addEventListener('input', () => renderDiagnostics(S));
}

function handleAIQuery() {
  const inp = document.getElementById('ai-query-input');
  const q = inp.value.trim(); if (!q) return;
  addAIMessage(q, true); inp.value = '';
  dispatch(A.LOG,{msg:`AI query: "${q}"`});
  setTimeout(() => addAIMessage("Analysis complete. Current state nominal."), 1000);
}

// ═══════════════════════════════════════════════════════════════════
export function startClock() {
  const el = document.getElementById('utc-clock');
  const FMT = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  function tick() {
    if (el) {
      const parts = FMT.formatToParts(new Date());
      const get = t => parts.find(p => p.type === t)?.value ?? '00';
      el.textContent = `${get('hour')}:${get('minute')}:${get('second')} IT`;
    }
  }
  tick(); // immediate first paint — no 1 s blank
  setInterval(tick, 1000);
}

const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const TIMEOUT_WARN_MS = 1 * 60 * 1000;
let _sessionWarnShown = false;
let _sessionTimer = null;

export function resetSessionTimer() {
  if (!S.role) return;
  _sessionWarnShown = false;
  if (_sessionTimer) clearTimeout(_sessionTimer);
  _sessionTimer = setTimeout(() => {
    ScenarioEngine.stop();
    dispatch(A.SESSION_TIMEOUT);
    const overlay = document.getElementById('role-overlay');
    if (overlay) overlay.style.display = 'flex';
  }, SESSION_TIMEOUT_MS);
}

export function startDataLoop() {
  setInterval(() => {
    if (!S.role) return;
    DAO.tick(S.scramActive);
    dispatch(A.TICK, { snapshot: DAO.snapshot() });

    if (S.lastActivity && !_sessionWarnShown) {
      const idleMs = Date.now() - S.lastActivity;
      if (idleMs > SESSION_TIMEOUT_MS - TIMEOUT_WARN_MS) {
        _sessionWarnShown = true;
        showModal({
          icon: 'timer',
          title: 'Session Timeout',
          content: '<p>Session about to expire.</p>',
          primary: 'STAY LOGGED IN',
          onConfirm: () => { dispatch(A.TOUCH_ACTIVITY); resetSessionTimer(); }
        });
      }
    }

    const ct = S.sensors.CORE_TEMP?.v ?? 0;
    if (ct > 1150 && !S.alarms.find(a=>a.id==='A-CT-HI') && !ScenarioEngine.active) {
      dispatch(A.ADD_ALARM, { alarm:{ id:'A-CT-HI', p:1, tag:'T-CORE-01', msg:'Core temp exceeded 1150°C', acked:false, ts:ts() }});
    }

    if (S.sensors.PRIM_PRESS) {
      const delta = (S.sensors.PRIM_PRESS.v - 214.8).toFixed(1);
      const sign = delta > 0 ? '+' : '';
      const copilotDelta = document.getElementById('copilot-delta');
      if (copilotDelta) copilotDelta.textContent = `${sign}${delta} PSI`;
    }
  }, 800);
}

export function addAIMessage(text, isUser=false) {
  const feed = document.getElementById('ai-feed');
  if (!feed) return;
  const div = document.createElement('div');
  div.className = 'flex gap-3 fade-in' + (isUser?' justify-end':'');
  if (isUser) {
    div.innerHTML = `<div class="bg-[#d1d6dc] p-3 border-r-2 border-[#495057] max-w-xs">
      <div class="tv text-[11px] text-[#6c757d] mb-1">${S.role||'OL'} — ${ts()}</div>
      <p class="tv text-xs font-medium text-[#212529]">${text}</p>
    </div>`;
  } else {
    div.innerHTML = `<div class="w-7 h-7 bg-[#d1d6dc] flex items-center justify-center flex-shrink-0">
      <span class="ms material-symbols-outlined text-[#343a40] text-[13px]" style="font-variation-settings:'FILL' 1">psychology</span>
    </div>
    <div class="flex-1 bg-[#e2e6ea] p-3 border-l-2 border-[#495057]">
      <div class="tv text-[11px] text-[#6c757d] mb-1">AI COPILOT — ${ts()}</div>
      <p class="tv text-xs text-[#212529]">${text}</p>
    </div>`;
  }
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}