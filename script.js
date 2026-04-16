'use strict';
// ╔══════════════════════════════════════════════════════════════════╗
// ║    CORE-SENTINEL HMI — InRebus DAO · LFR-4G Unit 4             ║
// ║    MVI + DAO + ISA-101 + Emergency Scenario Engine              ║
// ╚══════════════════════════════════════════════════════════════════╝

// ═══════════════════════════════════════════════════════════════════
// SECTION 1: DAO LAYER
// Abstracts Physical sensors vs Simulated (Politecnico) physics model
// ═══════════════════════════════════════════════════════════════════
const DAO = {
  mode: 'SIMULATED',

  NOMINAL: {
    CORE_TEMP:1045.2, COOLANT_IN:542.4, COOLANT_OUT:823.1, PRIM_PRESS:214.8,
    PUMP_A:3200, PUMP_B:3185, NEUTRON_FLUX:3.42, FUEL_BURNUP:24.7,
    SG_INLET:480.2, STEAM_PRESS:165.4, TURBINE_RPM:3000, GRID_OUT:478.2,
    ROD_POS:72.4, SCRAM_V:48.2, LEAD_LEVEL:98.7, SEC_FLOW:2840,
  },

  _s: {
    CORE_TEMP:    { tag:'T-CORE-01', label:'Core Temperature',        sys:'Primary',   v:1045.2, u:'°C',          trip:1200, low:900,  vlt:1.4  },
    COOLANT_IN:   { tag:'T-CL-IN-01',label:'Coolant Inlet Temp',      sys:'Primary',   v:542.4,  u:'K',           trip:620,  low:480,  vlt:0.7  },
    COOLANT_OUT:  { tag:'T-CL-OUT-01',label:'Coolant Outlet Temp',    sys:'Primary',   v:823.1,  u:'K',           trip:900,  low:750,  vlt:0.8  },
    PRIM_PRESS:   { tag:'P-PRI-01',  label:'Primary Pressure ΔP',     sys:'Primary',   v:214.8,  u:'PSI',         trip:250,  low:150,  vlt:0.55 },
    PUMP_A:       { tag:'N-PMP-A-01',label:'Pump A Speed',            sys:'Primary',   v:3200,   u:'RPM',         trip:3600, low:2800, vlt:5    },
    PUMP_B:       { tag:'N-PMP-B-01',label:'Pump B Speed',            sys:'Secondary', v:3185,   u:'RPM',         trip:3600, low:2800, vlt:5    },
    NEUTRON_FLUX: { tag:'F-NEUT-01', label:'Neutron Flux',            sys:'Primary',   v:3.42,   u:'e14 n/cm²·s', trip:4.0, low:2.5,  vlt:0.02 },
    FUEL_BURNUP:  { tag:'B-FUEL-01', label:'Fuel Burnup',             sys:'Primary',   v:24.7,   u:'GWd/t',       trip:60,   low:0,    vlt:0    },
    SG_INLET:     { tag:'T-SG-IN-01',label:'SG Inlet Temperature',    sys:'Secondary', v:480.2,  u:'°C',          trip:550,  low:420,  vlt:0.65 },
    STEAM_PRESS:  { tag:'P-STM-01',  label:'Steam Pressure',          sys:'Secondary', v:165.4,  u:'bar',         trip:180,  low:130,  vlt:0.28 },
    TURBINE_RPM:  { tag:'N-TRB-01',  label:'Turbine Speed',           sys:'Secondary', v:3000,   u:'RPM',         trip:3200, low:2800, vlt:3    },
    GRID_OUT:     { tag:'P-GRID-01', label:'Grid Electrical Output',  sys:'Grid',      v:478.2,  u:'MWe',         trip:510,  low:400,  vlt:0.4  },
    ROD_POS:      { tag:'R-ROD-AVG', label:'Control Rod Pos (avg)',   sys:'Safety',    v:72.4,   u:'%',           trip:95,   low:5,    vlt:0.08 },
    SCRAM_V:      { tag:'V-SCR-01',  label:'SCRAM Bus Voltage',       sys:'Safety',    v:48.2,   u:'V',           trip:0,    low:40,   vlt:0.04 },
    LEAD_LEVEL:   { tag:'L-PB-01',   label:'Lead Coolant Level',      sys:'Primary',   v:98.7,   u:'%',           trip:0,    low:90,   vlt:0.04 },
    SEC_FLOW:     { tag:'F-SEC-01',  label:'Secondary Flow Rate',     sys:'Secondary', v:2840,   u:'kg/s',        trip:3200, low:2400, vlt:3.5  },
  },

  tick(scramActive) {
    Object.entries(this._s).forEach(([k, s]) => {
      if (!s.vlt) return;
      const d = (Math.random() - 0.5) * s.vlt * 2;
      const drift = (k === 'CORE_TEMP' && !scramActive) ? 0.03 : 0;
      s.v = Math.max(s.low * 0.92, Math.min(s.trip * 0.985, s.v + d + drift));
      if (scramActive) {
        if (k === 'CORE_TEMP')  s.v = Math.max(s.v - 2.0, 480);
        if (k === 'ROD_POS')    s.v = Math.min(s.v + 3.0, 100);
        if (k === 'PRIM_PRESS') s.v = Math.max(s.v - 0.4, 130);
        if (k === 'NEUTRON_FLUX') s.v = Math.max(s.v - 0.05, 0.1);
      }
    });
  },

  snapshot() {
    return Object.fromEntries(Object.entries(this._s).map(([k, s]) => [k, { ...s }]));
  },

  status(s) {
    const r = (s.v - s.low) / Math.max(s.trip - s.low, 1);
    if (r >= 0.92) return 'alarm';
    if (r >= 0.78) return 'warning';
    if (s.v < s.low) return 'low';
    return 'nominal';
  },

  fmt(s) {
    if (s.v >= 10000) return Math.round(s.v).toLocaleString();
    if (s.v >= 1000)  return s.v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (s.v >= 100)   return s.v.toFixed(1);
    return s.v.toFixed(2);
  },

  reset() {
    Object.entries(this.NOMINAL).forEach(([k, v]) => {
      if (this._s[k]) this._s[k].v = v;
    });
  }
};

// ═══════════════════════════════════════════════════════════════════
// SECTION 2: IMMUTABLE MODEL
// ═══════════════════════════════════════════════════════════════════
const INTENT_PERMISSIONS = {
  // 'NAVIGATE', 'ACK_ALL', 'DISMISS_BANNER', 'TOGGLE_AUDIT', 'CLEAR_AUDIT', 'LOG', 'TOUCH_ACTIVITY', 'SET_DEMO_MODE', 'TOGGLE_HIGH_CONTRAST' are inherently safe for all logged-in roles
  'SCRAM': ['OD', 'AS'],
  'RESET_SCRAM': ['AS'],
  'TOGGLE_AUTOPILOT': ['OD', 'AS'],
  'RESET_INTERLOCKS': ['AS'],
  'SHELF_ALARM': ['OD', 'AS'],
  'UNSHELVE_ALARM': ['OD', 'AS']
};

// ── XSS escape utility (WCAG / security best practice) ──────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

const mkModel = () => ({
  role:         null,
  sessionStart: null,
  lastActivity: null,
  activePanel:  'panel-primary',

  alarms: [
    { id:'A001', p:1, tag:'P-PRI-01', msg:'Sub-Valve 04-B pressure delta +14.2 PSI vs simulation', acked:false, ts:ts() },
    { id:'A002', p:2, tag:'P-STM-01', msg:'Secondary steam pressure trending +0.4 bar/min',        acked:false, ts:ts() },
  ],
  bannerOn: true,

  sensors: DAO.snapshot(),

  controlRods: Array.from({length:8}, (_, i) => ({
    id:`ROD-${String(i+1).padStart(2,'0')}`, pos:68 + Math.random()*9, st:'NORMAL',
  })),

  interlocks: [
    { id:'I001', label:'Hi-Hi Core Temp Trip',   tag:'T-CORE-01', st:'ARMED',   sp:'1200°C'   },
    { id:'I002', label:'Lo Primary Flow Trip',   tag:'F-PRI-01',  st:'ARMED',   sp:'2400 kg/s'},
    { id:'I003', label:'Hi Primary Pressure',    tag:'P-PRI-01',  st:'ARMED',   sp:'250 PSI'  },
    { id:'I004', label:'Hi Neutron Flux Trip',   tag:'F-NEUT-01', st:'ARMED',   sp:'4.0e14'   },
    { id:'I005', label:'Node Gamma ERV',         tag:'V-ERV-01',  st:'OFFLINE', sp:'Auto'     },
    { id:'I006', label:'SCRAM Bus Undervoltage', tag:'V-SCR-01',  st:'ARMED',   sp:'< 40 V'   },
  ],

  scramActive:  false,
  protocolStep: 2,
  autoPilot:    false,

  histTemp:  Array(20).fill(null).map(() => 1045 + (Math.random()-0.5)*20),
  histPress: Array(20).fill(null).map(() => 215  + (Math.random()-0.5)*8),

  auditLog: [],
  auditPanelOpen: false,
  demoMode: false,
});

let S = mkModel();

// ═══════════════════════════════════════════════════════════════════
// SECTION 3: MVI REDUCER
// ═══════════════════════════════════════════════════════════════════
function reduce(s, intent, p = {}) {
  // ── RBAC intent guard (ISA-101 §6.5 / NUREG-0700) ─────────────────
  if (window.INTENT_PERMISSIONS && INTENT_PERMISSIONS[intent]) {
    const allowed = INTENT_PERMISSIONS[intent];
    if (!s.role || !allowed.includes(s.role)) {
      const denyMsg = `SECURITY: Intent "${intent}" denied — role ${s.role||'NONE'} lacks permission`;
      console.warn(`[RBAC] ${denyMsg}`);
      return { ...s, auditLog: [...s.auditLog, mkEntry(denyMsg, s.role)] };
    }
  }

  const log = msg => [...s.auditLog, mkEntry(msg, s.role)];

  switch (intent) {
    case 'SET_ROLE':
      return { ...s, role:p.role, sessionStart:new Date(), lastActivity:Date.now(), auditLog:log(`Session started. Role: ${p.role}`) };
    case 'NAVIGATE':
      return { ...s, activePanel:p.panel, auditLog:log(`Navigated to: ${p.panel}`) };
    case 'ACK_ALL':
      return { ...s, alarms:s.alarms.map(a=>({...a,acked:true})), auditLog:log('All alarms acknowledged') };
    case 'DISMISS_BANNER':
      return { ...s, bannerOn:false };
    case 'ADD_ALARM': {
      // ISA-101: first alarm in a new cascade is marked firstOut
      const hasActive = s.alarms.some(a => !a.acked && !a.cleared && !a.shelved);
      const newAlarm = { cleared:false, shelved:false, firstOut:!hasActive, ...p.alarm };
      return { ...s, alarms:[...s.alarms, newAlarm], bannerOn:true, auditLog:log(`ALARM [P${newAlarm.p}] ${newAlarm.tag}: ${newAlarm.msg}${newAlarm.firstOut?' [FIRST-OUT]':''}`) };
    }
    case 'CLEAR_ALARM':
      return { ...s, alarms:s.alarms.map(a => a.id===p.id ? {...a, cleared:true} : a), auditLog:log(`Alarm cleared: ${p.id}`) };
    case 'SHELF_ALARM':
      // ISA-101 §5.6: Shelving temporarily suppresses a nuisance alarm
      return { ...s, alarms:s.alarms.map(a => a.id===p.id ? {...a, shelved:true} : a), auditLog:log(`Alarm shelved: ${p.id} (OD/AS only)`) };
    case 'UNSHELVE_ALARM':
      return { ...s, alarms:s.alarms.map(a => a.id===p.id ? {...a, shelved:false} : a), auditLog:log(`Alarm unshelved: ${p.id}`) };
    case 'CLEAR_ALARMS_BY_PREFIX':
      return { ...s, alarms:s.alarms.filter(a=>!a.id.startsWith(p.prefix)) };
    case 'TICK':
      return {
        ...s,
        sensors: DAO.snapshot(),
        histTemp:  [...s.histTemp.slice(-19),  s.sensors.CORE_TEMP?.v  ?? 1045],
        histPress: [...s.histPress.slice(-19), s.sensors.PRIM_PRESS?.v ?? 215],
      };
    case 'SCRAM':
      return { ...s, scramActive:true, auditLog:log(`⚠ SCRAM INITIATED by ${s.role || 'SYSTEM'}`) };
    case 'RESET_SCRAM':
      return { ...s, scramActive:false, auditLog:log('SCRAM state reset — nominal restored') };
    case 'ADVANCE_PROTOCOL':
      return { ...s, protocolStep:Math.min(s.protocolStep+1,4), auditLog:log(`SCCP-74A Step ${s.protocolStep} acknowledged`) };
    case 'TOGGLE_AUTOPILOT':
      return { ...s, autoPilot:!s.autoPilot, auditLog:log(`Auto-Pilot ${!s.autoPilot?'ENABLED':'DISABLED'}`) };
    case 'TOGGLE_AUDIT':
      return { ...s, auditPanelOpen:!s.auditPanelOpen };
    case 'CLEAR_AUDIT':
      return { ...s, auditLog:[mkEntry('Audit log cleared',s.role)] };
    case 'RESET_INTERLOCKS':
      return { ...s, interlocks:s.interlocks.map(i=>i.st==='OFFLINE'?{...i,st:'ARMED'}:i), auditLog:log('Interlocks reset to ARMED') };
    case 'LOG':
      return { ...s, auditLog:log(p.msg) };
    case 'TOUCH_ACTIVITY':
      return { ...s, lastActivity:Date.now() };
    case 'SESSION_TIMEOUT':
      return { ...mkModel(), auditLog:[mkEntry('SESSION TIMEOUT: Automatic logout after inactivity', null)] };
    case 'TOGGLE_HIGH_CONTRAST': {
      // NUREG-0700 §11.4.2: High-contrast mode for varied lighting conditions
      const hc = !s.highContrast;
      document.documentElement.setAttribute('data-theme', hc ? 'high-contrast' : 'default');
      return { ...s, highContrast: hc, auditLog:log(`High-contrast mode ${hc ? 'ENABLED' : 'DISABLED'}`) };
    }
    case 'SET_DEMO_MODE':
      return { ...s, demoMode:p.active };
    default:
      return s;
  }
}

function dispatch(intent, payload = {}) {
  S = reduce(S, intent, payload);
  scheduleRender();
}

let _rq = false;
function scheduleRender() {
  if (!_rq) { _rq = true; requestAnimationFrame(() => { _rq = false; render(S); }); }
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 4: SCENARIO ENGINE
// Three emergency scenarios that play out over time
// ═══════════════════════════════════════════════════════════════════
const ScenarioEngine = {
  active: false,
  name: null,
  timers: [],
  countdownInterval: null,
  tripTimeSec: 0,
  startedAt: 0,

  _t(fn, delay) {
    const id = setTimeout(fn, delay);
    this.timers.push(id);
    return id;
  },

  stop() {
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.active = false;
    this.name = null;
  },

  resetToNominal() {
    this.stop();
    DAO.reset();
    dispatch('SET_DEMO_MODE', { active:false });
    dispatch('RESET_SCRAM');
    dispatch('CLEAR_ALARMS_BY_PREFIX', { prefix:'DEMO' });
    dispatch('LOG', { msg:'System reset to nominal state by operator' });

    // Reset visual bars
    hideDemoBar();
    setEmergencyOverlay(0);
    const sEl = document.getElementById('sidebar-unit-state');
    if (sEl) { sEl.textContent = 'Unit 4: Nominal'; sEl.style.color = '#159647'; }
    scheduleRender();
  },

  startCountdown(tripSeconds) {
    this.tripTimeSec = tripSeconds;
    this.startedAt = Date.now();
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.countdownInterval = setInterval(() => {
      const elapsed = (Date.now() - this.startedAt) / 1000;
      const remaining = Math.max(0, this.tripTimeSec - elapsed);
      const el = document.getElementById('demo-countdown');
      if (el) {
        const m = Math.floor(remaining / 60);
        const sc = Math.floor(remaining % 60);
        el.textContent = `${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`;
        el.className = remaining < 30 ? 'font-bold countdown-critical' : 'font-bold text-[#212529]';
      }
      if (remaining <= 0) clearInterval(this.countdownInterval);
    }, 500);
  },

  // ─── SCENARIO A: Rising Core Temperature ───────────────────────
  runRisingTemp() {
    this.stop();
    this.active = true; this.name = 'RISING_TEMP';
    dispatch('SET_DEMO_MODE', { active:true });
    dispatch('LOG', { msg:'DEMO SCENARIO A: Rising Core Temperature initiated' });

    showDemoBar('SCENARIO A — Rising Core Temp: Coolant bypass valve restriction detected', '#d97d06');
    this.startCountdown(420); // ~7 min trip estimate

    dispatch('ADD_ALARM', { alarm:{ id:'DEMO-A01', p:3, tag:'T-CORE-01', msg:'Core temp rising — bypass valve partial restriction', acked:false, ts:ts() }});
    addAIMessage('SCENARIO INITIATED: Coolant bypass valve partial closure detected. Core temperature drift: +1.2°C/min. Monitoring. Estimated time to P2 threshold: ~8 minutes.');

    let step = 0;
    const escalate = () => {
      if (!this.active || S.scramActive) return;
      step++;

      DAO._s.CORE_TEMP.v    += 4.5 + step * 0.25;
      DAO._s.COOLANT_IN.v   += 0.7;
      DAO._s.COOLANT_OUT.v  += 1.2;
      DAO._s.PRIM_PRESS.v   += 0.35;
      DAO._s.SG_INLET.v     += 1.0;

      // Increase emergency visual
      const margin = (DAO._s.CORE_TEMP.v - 900) / 300;
      setEmergencyOverlay(Math.max(0, (margin - 0.6) * 2.5));

      // P2 threshold ~1100°C
      if (DAO._s.CORE_TEMP.v > 1100 && !S.alarms.find(a=>a.id==='DEMO-A02')) {
        dispatch('ADD_ALARM', { alarm:{ id:'DEMO-A02', p:2, tag:'T-CORE-01', msg:`Core temp ${DAO._s.CORE_TEMP.v.toFixed(1)}°C — approaching trip limit`, acked:false, ts:ts() }});
        addAIMessage('⚠ P2 ALARM: Core temperature exceeded 1100°C. Recommend initiating control rod insertion. Time to P1 trip limit: ~6 minutes at current rate.');
        showDemoBar('⚠ P2 ALARM — Core temp 1100°C — Control rod insertion recommended', '#d97d06');
        this.startCountdown(360);
      }

      // P1 threshold ~1160°C
      if (DAO._s.CORE_TEMP.v > 1160 && !S.alarms.find(a=>a.id==='DEMO-A03')) {
        dispatch('ADD_ALARM', { alarm:{ id:'DEMO-A03', p:1, tag:'T-CORE-01', msg:`CRITICAL: Core temp ${DAO._s.CORE_TEMP.v.toFixed(1)}°C — SCRAM recommended`, acked:false, ts:ts() }});
        addAIMessage('🚨 P1 CRITICAL ALARM: Core temperature at ' + DAO._s.CORE_TEMP.v.toFixed(1) + '°C — 97% of trip limit. SCRAM RECOMMENDED IMMEDIATELY. Predicted trip in T+90s without action.');
        showDemoBar('🚨 P1 CRITICAL — Core temp ' + DAO._s.CORE_TEMP.v.toFixed(0) + '°C — SCRAM REQUIRED', '#e31a1a');
        this.startCountdown(90);
        const su = document.getElementById('sidebar-unit-state');
        if (su) { su.textContent = 'Unit 4: CRITICAL'; su.style.color = '#e31a1a'; }
      }

      // Auto-SCRAM at trip limit
      if (DAO._s.CORE_TEMP.v > 1195 && !S.scramActive) {
        dispatch('SCRAM');
        dispatch('ADD_ALARM', { alarm:{ id:'DEMO-A-SCRAM', p:1, tag:'SCRAM', msg:'AUTO-SCRAM: Core temp exceeded trip limit 1195°C', acked:false, ts:ts() }});
        addAIMessage('🚨 AUTOMATIC SCRAM EXECUTED by Reactor Protection System. Core temp: ' + DAO._s.CORE_TEMP.v.toFixed(1) + '°C exceeded 1195°C setpoint. All control rods inserting. Shutdown initiated.');
        showDemoBar('✅ AUTO-SCRAM EXECUTED — Reactor Protection System actuated', '#159647');
        this.stop();
        return;
      }

      scheduleRender();
      if (this.active && !S.scramActive) this._t(escalate, 1200);
    };

    this._t(escalate, 2500);
  },

  // ─── SCENARIO B: Loss of Coolant Flow (LOCA) ───────────────────
  runLOCA() {
    this.stop();
    this.active = true; this.name = 'LOCA';
    dispatch('SET_DEMO_MODE', { active:true });
    dispatch('LOG', { msg:'DEMO SCENARIO B: LOCA initiated' });

    showDemoBar('SCENARIO B — LOCA: Pump-A bearing seizure detected', '#e31a1a');
    this.startCountdown(180);

    // Immediate pump failure
    DAO._s.PUMP_A.v = 0;
    DAO._s.SEC_FLOW.v = 1400;

    dispatch('ADD_ALARM', { alarm:{ id:'DEMO-B01', p:1, tag:'N-PMP-A-01', msg:'PUMP-A BEARING SEIZURE — Loop-A primary flow lost', acked:false, ts:ts() }});
    dispatch('ADD_ALARM', { alarm:{ id:'DEMO-B02', p:2, tag:'F-PRI-01',   msg:'Primary flow: 48% nominal — Lo-Low trip armed',    acked:false, ts:ts() }});
    addAIMessage('🚨 LOCA DETECTED: Pump-A catastrophic bearing failure. Loop-A primary flow: 0%. Single-pump operation on Pump-B. Core thermal margins reducing rapidly — recommend SCRAM within 60 seconds.');

    const su = document.getElementById('sidebar-unit-state');
    if (su) { su.textContent = 'Unit 4: LOCA ACTIVE'; su.style.color = '#e31a1a'; }

    this._t(() => {
      addAIMessage('⚠ Primary flow at 48% nominal. Lo-Flow trip threshold breached. Natural circulation establishing. Core heat removal degrading — MANUAL SCRAM STRONGLY ADVISED.');
      DAO._s.PRIM_PRESS.v += 15;
    }, 4000);

    let step = 0;
    const escalate = () => {
      if (!this.active || S.scramActive) return;
      step++;

      DAO._s.CORE_TEMP.v    += 7 + step * 0.6;
      DAO._s.COOLANT_OUT.v  += 3.5;
      DAO._s.PRIM_PRESS.v   += 1.8;
      DAO._s.NEUTRON_FLUX.v += 0.06;

      const margin = (DAO._s.CORE_TEMP.v - 900) / 300;
      setEmergencyOverlay(Math.max(0, (margin - 0.4) * 2));

      if (step === 6) {
        dispatch('ADD_ALARM', { alarm:{ id:'DEMO-B03', p:1, tag:'T-CORE-01', msg:`Core temp ${DAO._s.CORE_TEMP.v.toFixed(0)}°C rising rapidly`, acked:false, ts:ts() }});
        addAIMessage('🚨 CORE TEMP: ' + DAO._s.CORE_TEMP.v.toFixed(1) + '°C · Rate: +' + (7+step*.6).toFixed(0) + '°C/min. Pump-B overloaded at 118% rated. Risk of second pump failure. SCRAM AND DEPRESSURIZE NOW.');
        showDemoBar('🚨 P1 LOCA — Core temp ' + DAO._s.CORE_TEMP.v.toFixed(0) + '°C rising — SCRAM REQUIRED', '#e31a1a');
        this.startCountdown(120);
      }

      // Auto-SCRAM
      if (DAO._s.CORE_TEMP.v > 1180 && !S.scramActive) {
        dispatch('SCRAM');
        dispatch('ADD_ALARM', { alarm:{ id:'DEMO-B-SCRAM', p:1, tag:'SCRAM', msg:'AUTO-SCRAM: Core temp/flow trip actuated by RPS', acked:false, ts:ts() }});
        addAIMessage('🚨 REACTOR PROTECTION SYSTEM ACTUATED. Core temp ' + DAO._s.CORE_TEMP.v.toFixed(1) + '°C, primary flow < 40% nominal. All control rods inserting. Passive lead cooling: ACTIVATED.');
        showDemoBar('✅ RPS SCRAM EXECUTED — Passive lead cooling now active', '#159647');
        this.stop();
        return;
      }

      scheduleRender();
      if (this.active && !S.scramActive) this._t(escalate, 900);
    };

    this._t(escalate, 5000);
  },

  // ─── SCENARIO C: Multi-System Station Blackout ──────────────────
  runBlackout() {
    this.stop();
    this.active = true; this.name = 'BLACKOUT';
    dispatch('SET_DEMO_MODE', { active:true });
    dispatch('LOG', { msg:'DEMO SCENARIO C: Station Blackout initiated' });

    showDemoBar('SCENARIO C — STATION BLACKOUT: Total AC power loss · EDG starting', '#e31a1a');
    this.startCountdown(120);

    const su = document.getElementById('sidebar-unit-state');
    if (su) { su.textContent = 'Unit 4: BLACKOUT'; su.style.color = '#e31a1a'; }

    // Immediate simultaneous failures
    [
      { id:'DEMO-C01', p:1, tag:'V-GRID-01',   msg:'STATION BLACKOUT — All AC buses lost · EDG starting'},
      { id:'DEMO-C02', p:1, tag:'N-PMP-A-01',  msg:'PUMP-A coast-down — AC power lost'},
      { id:'DEMO-C03', p:1, tag:'N-PMP-B-01',  msg:'PUMP-B coast-down — AC power lost'},
      { id:'DEMO-C04', p:2, tag:'V-SCR-01',    msg:'SCRAM bus degrading — battery backup active'},
    ].forEach(a => dispatch('ADD_ALARM', { alarm:{ ...a, acked:false, ts:ts() }}));

    addAIMessage('🚨 STATION BLACKOUT CONDITION: All AC power buses de-energized. Emergency Diesel Generators starting (T+15s expected). Battery-backed SCRAM system ACTIVE. Lead-bismuth passive cooling: INITIATING.');

    let step = 0;
    const degrade = () => {
      if (!this.active) return;
      step++;

      DAO._s.PUMP_A.v      = Math.max(0,   DAO._s.PUMP_A.v  - 250);
      DAO._s.PUMP_B.v      = Math.max(0,   DAO._s.PUMP_B.v  - 220);
      DAO._s.GRID_OUT.v    = Math.max(0,   DAO._s.GRID_OUT.v - 40);
      DAO._s.TURBINE_RPM.v = Math.max(0,   DAO._s.TURBINE_RPM.v - 180);
      DAO._s.CORE_TEMP.v   += 9;
      DAO._s.PRIM_PRESS.v  += 3;
      DAO._s.SCRAM_V.v     = Math.max(37,  DAO._s.SCRAM_V.v - 0.35);
      DAO._s.SEC_FLOW.v    = Math.max(800, DAO._s.SEC_FLOW.v - 200);

      setEmergencyOverlay(Math.min(1, step * 0.1));

      if (step === 3) {
        addAIMessage('⚠ EDG-1 START FAILURE. EDG-2 attempt in progress. Natural circulation in primary loop — passive lead flow rate: 12% nominal. Decay heat accumulation: CRITICAL CONCERN.');
        dispatch('ADD_ALARM', { alarm:{ id:'DEMO-C05', p:1, tag:'T-CORE-01', msg:`Core temp ${DAO._s.CORE_TEMP.v.toFixed(0)}°C — decay heat accumulating`, acked:false, ts:ts() }});
        showDemoBar('🚨 EDG FAILURE — Decay heat accumulating — SCRAM IMMINENT', '#e31a1a');
        this.startCountdown(60);
      }

      if (step === 6) {
        dispatch('ADD_ALARM', { alarm:{ id:'DEMO-C06', p:1, tag:'V-SCR-01', msg:'SCRAM bus voltage: 37.8V — threshold approaching', acked:false, ts:ts() }});
        addAIMessage('🚨 EDG-2 FAILED. SCRAM bus voltage: ' + DAO._s.SCRAM_V.v.toFixed(1) + 'V — approaching undervoltage trip. Battery reserve: ~4 minutes. PASSIVE SCRAM ACTUATING.');
      }

      // Auto-SCRAM at step 8+ or if SCRAM voltage trips
      if ((step >= 8 || DAO._s.SCRAM_V.v < 38.5) && !S.scramActive) {
        dispatch('SCRAM');
        dispatch('ADD_ALARM', { alarm:{ id:'DEMO-C-SCRAM', p:1, tag:'SCRAM', msg:'PASSIVE SCRAM: Gravity-drop rods by SCRAM bus undervoltage', acked:false, ts:ts() }});
        addAIMessage('✅ PASSIVE SCRAM COMPLETE. Gravity-drop control rods fully inserted. Decay heat removal via passive lead-bismuth convection. Core temp trending toward stable. Plant in SAFE SHUTDOWN state.');
        showDemoBar('✅ PASSIVE SCRAM & SAFE SHUTDOWN — Passive LBE cooling active', '#159647');
        const su2 = document.getElementById('sidebar-unit-state');
        if (su2) { su2.textContent = 'Unit 4: Safe Shutdown'; su2.style.color = '#d97d06'; }
        this.stop();
        return;
      }

      scheduleRender();
      if (this.active && !S.scramActive) this._t(degrade, 1000);
    };

    this._t(degrade, 2000);
  },
};

// ═══════════════════════════════════════════════════════════════════
// SECTION 5: VIEW RENDERERS
// ═══════════════════════════════════════════════════════════════════
function render(s) {
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

function renderRole(s) {
  setText('role-badge', s.role || '---');
  setText('sidebar-role', s.role ? { OL:'Local Operator', OD:'Diagnostic Operator', AS:'System Admin' }[s.role] : 'Not Authenticated');
  setText('ai-role', s.role || '---');
  const aiTs = document.getElementById('ai-init-ts');
  if (aiTs && s.sessionStart) aiTs.textContent = ts();
}

function renderPanels(s) {
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

function renderAlarmBanner(s) {
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

function renderHUD(s) {
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
    const pct = Math.max(0, Math.min(100, margin * 100)).toFixed(0);
    const bar = document.getElementById('margin-bar');
    if (bar) {
      bar.style.width = pct + '%';
      bar.style.background = margin < 0.2 ? '#e31a1a' : margin < 0.35 ? '#d97d06' : '#159647';
    }
    setText('margin-pct', pct + '%');
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

function renderSystemHealth(s) {
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

// ─── CMP-23: CYBERSECURITY PANEL (AS only) ─────────────────────────
// IEC 62443 / ISA-101 compliant — rendered only for System Admin role
function renderCyberPanel(s) {
  // Panel is only visible to AS — skip render entirely for other roles
  if (s.role !== 'AS') return;

  // ── Node Status ──────────────────────────────────────────────────
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
    // Jitter load values slightly for live feel
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

  // ── Intrusion Log ─────────────────────────────────────────────────
  const logEl = document.getElementById('cyber-log');
  if (logEl && !logEl.dataset.seeded) {
    // Seed with static nominal log entries once
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

  // ── Encryption Status ─────────────────────────────────────────────
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

function renderCharts(s) {
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

function renderAuditPanel(s) {
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

function renderSafetyPanel(s) {
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

  // Control rods — position reflects live sensor
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

function renderSecondaryStats(s) {
  const el = document.getElementById('sec-stats');
  if (!el) return;
  el.innerHTML = '';
  const ss = s.sensors;
  [
    { label:'SG Inlet Temperature', k:'SG_INLET',   pct:pct(ss.SG_INLET?.v,  420,550), col:'#cd5c08' },
    { label:'Steam Pressure',       k:'STEAM_PRESS', pct:pct(ss.STEAM_PRESS?.v,130,180),col:'#343a40' },
    { label:'Turbine Speed',        k:'TURBINE_RPM', pct:pct(ss.TURBINE_RPM?.v,2800,3200),col:'#159647'},
    { label:'Grid Output',          k:'GRID_OUT',    pct:pct(ss.GRID_OUT?.v,  400,500), col:'#159647' },
    { label:'Pump B Speed',         k:'PUMP_B',      pct:pct(ss.PUMP_B?.v,    2800,3600),col:'#159647'},
    { label:'Secondary Flow',       k:'SEC_FLOW',    pct:pct(ss.SEC_FLOW?.v,  2400,3200),col:'#343a40'},
  ].forEach(st => {
    const sr = ss[st.k];
    const val = sr ? DAO.fmt(sr) : '--';
    const unit = sr?.u ?? '';
    const isAlarm = sr && DAO.status(sr) === 'alarm';
    el.innerHTML += `<div class="bg-[#f4f6f8] border ${isAlarm?'border-[#e31a1a]/30':'border-[rgba(0,0,0,.06)]'} p-3 mb-2">
      <div class="tv text-[11px] text-[#6c757d] uppercase tracking-wider font-bold">${st.label}</div>
      <div class="tv text-xl font-bold mt-0.5" style="color:${isAlarm?'#e31a1a':'#212529'}">${val} <span class="text-xs font-normal text-[#6c757d]">${unit}</span></div>
      <div class="w-full h-1 bg-[#d1d6dc] mt-2">
        <div class="h-full transition-all duration-1000" style="width:${Math.min(100,Math.max(0,st.pct)).toFixed(0)}%;background:${isAlarm?'#e31a1a':st.col}"></div>
      </div>
      </div>
    </div>`;
  });

  // Dynamically update Secondary loop status badge
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

  // Update SVG P&ID text dynamically
  if (ss.SG_INLET) setText('svg-sec-hot', `${DAO.fmt(ss.SG_INLET)}°C →`);
  if (ss.SG_INLET) setText('svg-sec-cold', `← ${(ss.SG_INLET.v - 100).toFixed(1)}°C`);
  if (ss.STEAM_PRESS) setText('svg-sec-steam', `STEAM ${DAO.fmt(ss.STEAM_PRESS)} bar`);
}

function renderDiagnostics(s) {
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

function renderAIPredictions(s) {
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

function renderAnomalyList(s) {
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
        ${!a.acked ? `<button class="tv text-[10px] uppercase font-bold text-[#212529] bg-[#d1d6dc] hover:bg-[#c2c7cd] px-2 py-0.5 border border-[#495057] transition-colors" onclick="S=reduce(S,'ACK_ALL');scheduleRender();">ACKNOWLEDGE</button>` : ''}
        ${(s.role === 'OD' || s.role === 'AS') ? (
          a.shelved
          ? `<button class="tv text-[10px] uppercase font-bold text-[#159647] border border-[#159647] px-2 py-0.5 hover:bg-[#159647] hover:text-white transition-colors" onclick="S=reduce(S,'UNSHELVE_ALARM',{id:'${a.id}'});scheduleRender();">UNSHELVE</button>`
          : `<button class="tv text-[10px] uppercase font-bold text-[#6c757d] border border-[#6c757d] px-2 py-0.5 hover:bg-[#6c757d] hover:text-white transition-colors" onclick="S=reduce(S,'SHELF_ALARM',{id:'${a.id}'});scheduleRender();">SHELVE (SUPPRESS)</button>`
        ) : ''}
      </div>
    </div>`;
  }).join('');
}

function renderCopilotSteps(s) {
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
      const done=st.n<s.protocolStep, active=st.n===s.protocolStep, pending=st.n>s.protocolStep;
      const cls = done   ? 'flex gap-2 p-2.5 bg-[#159647]/5 border-l-2 border-[#159647] mb-2'
                : active ? 'flex gap-2 p-2.5 bg-[#d1d6dc] border-l-4 border-[#495057] mb-2'
                :          'flex gap-2 p-2.5 mb-2 opacity-40';
      const num = done
        ? `<div class="w-5 h-5 rounded-full border border-[#159647] text-[#159647] flex items-center justify-center flex-shrink-0"><span class="ms material-symbols-outlined text-[11px]">check</span></div>`
        : `<div class="w-5 h-5 rounded-full border ${active?'border-[#495057] text-[#343a40]':'border-[#adb5bd] text-[#adb5bd]'} flex items-center justify-center flex-shrink-0 tv text-[12px] font-bold">${st.n}</div>`;
      const ackBtn = (active && st.btn)
        ? `<button class="copilot-ack mt-1.5 tv text-[11px] px-2 py-0.5 bg-[#d1d6dc] hover:bg-[#ced4da] border border-[rgba(0,0,0,.1)] font-bold uppercase tracking-wider transition-colors">ACKNOWLEDGE STEP</button>`
        : '';
      return `<div class="${cls}">${num}
        <div class="flex-1">
          <div class="tv text-[12px] font-bold uppercase text-[#212529]">${st.title}</div>
          <div class="tv text-[11px] text-[#6c757d] italic mt-0.5">${st.desc}</div>
          ${ackBtn}
        </div>
      </div>`;
    }).join('');
  el.querySelectorAll('.copilot-ack').forEach(b => b.addEventListener('click', () => dispatch('ADVANCE_PROTOCOL')));
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 6: THREE.JS DIGITAL TWIN
// ═══════════════════════════════════════════════════════════════════
function initThreeJS() {
  const container = document.getElementById('three-container');
  if (!container || !window.THREE) return;

  const scene = new THREE.Scene();
  const aspect = container.clientWidth / container.clientHeight || 1.6;
  const perspCam = new THREE.PerspectiveCamera(40, aspect, 0.1, 1000);
  perspCam.position.set(0, 16, 32); perspCam.lookAt(0, 0, 0);
  const d = 14;
  const orthoCam = new THREE.OrthographicCamera(-d*aspect, d*aspect, d, -d, 1, 1000);
  orthoCam.position.set(0, 16, 32); orthoCam.lookAt(0, 0, 0);
  let activeCam = perspCam;

  const renderer = new THREE.WebGLRenderer({ alpha:true, antialias:true });
  renderer.setClearColor(0, 0);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const G = new THREE.Group();
  scene.add(G);

  // Reactor vessel (translucent fill)
  G.add(new THREE.Mesh(
    new THREE.CylinderGeometry(4.1, 4.1, 18, 48),
    new THREE.MeshBasicMaterial({ color:0x2a2f36, transparent:true, opacity:0.15 })
  ));

  // Outer vessel wireframe
  const outerMat = new THREE.MeshBasicMaterial({ color:0x5a6573, wireframe:true, transparent:true, opacity:0.5 });
  const outerMesh = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 20, 24, 6), outerMat);
  G.add(outerMesh);

  // Lead coolant pool
  G.add(new THREE.Mesh(
    new THREE.CylinderGeometry(8.5, 9, 2.5, 36),
    new THREE.MeshBasicMaterial({ color:0x5a6573, transparent:true, opacity:0.05 })
  ));

  // Coolant manifold rings
  for (let i=0;i<5;i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(7.0, 0.055, 12, 72),
      new THREE.MeshBasicMaterial({ color:0x7a8590, transparent:true, opacity:0.38 })
    );
    ring.rotation.x = Math.PI/2; ring.position.y = -9+i*4.5; G.add(ring);
  }

  // Top cap & bottom plenum
  [[10.4, new THREE.CylinderGeometry(5.8,5.4,0.8,32)],[-10.6, new THREE.CylinderGeometry(5.4,4.8,1.2,32)]].forEach(([y,geo]) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color:0x5a6573,wireframe:true,transparent:true,opacity:0.3}));
    m.position.y=y; G.add(m);
  });

  // Control rods
  const rods = [];
  for (let i=0;i<12;i++) {
    const rodMat = new THREE.MeshBasicMaterial({ color:0x1a1d21, transparent:true, opacity:0.9 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.11,22,6), rodMat);
    const a=(i/12)*Math.PI*2;
    rod.position.x=Math.cos(a)*3.0; rod.position.z=Math.sin(a)*3.0;
    rod.userData={idx:i}; G.add(rod); rods.push(rod);
  }

  // Camera buttons
  function setCam(mode) {
    activeCam = mode==='persp' ? perspCam : orthoCam;
    const pe=document.getElementById('btn-persp'), oe=document.getElementById('btn-ortho');
    const act='tv text-[11px] px-2 py-1 border border-[rgba(0,0,0,.1)] font-bold bg-[#212529] text-[#f4f6f8]';
    const inact='tv text-[11px] px-2 py-1 border border-[rgba(0,0,0,.1)] font-bold bg-[#d1d6dc] text-[#343a40] hover:bg-[#ced4da]';
    if(pe) pe.className=mode==='persp'?act:inact;
    if(oe) oe.className=mode==='ortho'?act:inact;
    dispatch('LOG',{msg:`Digital Twin camera: ${mode.toUpperCase()}`});
  }
  document.getElementById('btn-persp')?.addEventListener('click', ()=>setCam('persp'));
  document.getElementById('btn-ortho')?.addEventListener('click', ()=>setCam('ortho'));

  (function animate() {
    requestAnimationFrame(animate);
    const t = Date.now()*0.001;
    G.rotation.y = t*0.07;

    // Rods follow live sensor
    const rodPos = (S.sensors.ROD_POS?.v ?? 72) / 100;
    rods.forEach(r => {
      r.position.y = Math.sin(t*0.34+r.userData.idx*0.52)*0.65 + (rodPos*6-7.5);
    });

    // Emergency: change wireframe color dynamically
    const coreTemp = S.sensors.CORE_TEMP?.v ?? 1045;
    const danger = Math.max(0, (coreTemp - 1000) / 200); // 0 at 1000°C, 1 at 1200°C
    outerMat.color.setRGB(0.35+danger*0.55, 0.39*(1-danger*0.8), 0.45*(1-danger*0.9));
    outerMat.opacity = 0.5 + danger*0.3;

    renderer.render(scene, activeCam);
  })();

  window.addEventListener('resize', ()=>{
    const w=container.clientWidth, h=container.clientHeight;
    if(!w||!h) return;
    const a=w/h;
    perspCam.aspect=a; perspCam.updateProjectionMatrix();
    orthoCam.left=-d*a; orthoCam.right=d*a; orthoCam.updateProjectionMatrix();
    renderer.setSize(w,h);
  });
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 7: MODAL SYSTEM
// ═══════════════════════════════════════════════════════════════════
let _onConfirm = null;
function showModal({ icon='info', title, content, primary='ACKNOWLEDGE', secondary=null, onConfirm=null }) {
  document.getElementById('modal-icon').textContent = icon;
  setText('modal-title', title);
  document.getElementById('modal-content').innerHTML = content;
  setText('btn-modal-pri', primary);
  const sec = document.getElementById('btn-modal-sec');
  secondary ? (sec.textContent=secondary, sec.classList.remove('hidden')) : sec.classList.add('hidden');
  _onConfirm = onConfirm;
  const ov = document.getElementById('modal-overlay');
  ov.classList.remove('hidden'); ov.classList.add('flex');
}
function hideModal() {
  const ov = document.getElementById('modal-overlay');
  ov.classList.add('hidden'); ov.classList.remove('flex');
  _onConfirm = null;
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 8: DEMO BAR HELPERS
// ═══════════════════════════════════════════════════════════════════
function showDemoBar(msg, col) {
  const bar = document.getElementById('demo-bar');
  const inner = document.getElementById('demo-inner');
  if (!bar || !inner) return;
  bar.style.height = '2.5rem';
  const bg = col==='#e31a1a'?'#fcdcdc':col==='#159647'?'#03140a':col==='#d97d06'?'#141000':'#100c00';
  inner.style.background = bg;
  inner.style.borderColor = col + '40';
  setText('demo-bar-text', msg);
  document.querySelector('#demo-inner .blink')?.style.setProperty('color', col);
}

function hideDemoBar() {
  const bar = document.getElementById('demo-bar');
  if (bar) bar.style.height = '0';
}

function setEmergencyOverlay(opacity) {
  const el = document.getElementById('three-emergency-overlay');
  if (el) el.style.opacity = Math.min(1, opacity);
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 9: EVENT BINDINGS
// ═══════════════════════════════════════════════════════════════════
function bindAll() {

  // Modal controls
  document.getElementById('btn-modal-close').addEventListener('click', hideModal);
  document.getElementById('btn-modal-sec').addEventListener('click', hideModal);
  document.getElementById('btn-modal-pri').addEventListener('click', () => { if(_onConfirm) _onConfirm(); hideModal(); });
  document.getElementById('modal-overlay').addEventListener('click', e => { if(e.target.id==='modal-overlay') hideModal(); });

  // Role selection
  document.querySelectorAll('.role-btn').forEach(b => {
    b.addEventListener('click', () => {
      const role = b.getAttribute('data-role');
      dispatch('SET_ROLE', {role});
      document.getElementById('role-overlay').style.display = 'none';
      const ts2 = document.getElementById('ai-init-ts');
      if (ts2) ts2.textContent = ts();

      // ── RBAC: activate component factory for this role ──────────
      if (window.RBACContext) {
        RBACContext.setRole(role);
        // Show Cybersecurity nav item only for AS
        const navCyber = document.getElementById('nav-cyber');
        if (navCyber) navCyber.style.display = role === 'AS' ? '' : 'none';
      }
    });
  });

  // RBAC Permission Matrix info button (on login screen)
  document.getElementById('btn-rbac-info')?.addEventListener('click', () => {
    if (!window.renderRoleSummary) return;
    showModal({
      icon: 'manage_accounts',
      title: 'Component Permission Matrix — All Roles',
      content: `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
          <div>
            <div style="font-family:'Courier New',monospace;font-size:12px;
                        color:#212529;font-weight:700;margin-bottom:8px;
                        border-bottom:1px solid rgba(0,0,0,.08);padding-bottom:4px;">
              LOCAL OPERATOR — OL</div>
            ${renderRoleSummary('OL')}
          </div>
          <div>
            <div style="font-family:'Courier New',monospace;font-size:12px;
                        color:#212529;font-weight:700;margin-bottom:8px;
                        border-bottom:1px solid rgba(0,0,0,.08);padding-bottom:4px;">
              DIAGNOSTIC OPERATOR — OD</div>
            ${renderRoleSummary('OD')}
          </div>
          <div>
            <div style="font-family:'Courier New',monospace;font-size:12px;
                        color:#212529;font-weight:700;margin-bottom:8px;
                        border-bottom:1px solid rgba(0,0,0,.08);padding-bottom:4px;">
              SYSTEM ADMIN — AS</div>
            ${renderRoleSummary('AS')}
          </div>
        </div>`,
    });
  });

  // Navigation
  document.querySelectorAll('.nav-s, .nav-t').forEach(b => {
    b.addEventListener('click', () => {
      const panel = b.getAttribute('data-panel');
      if (panel) dispatch('NAVIGATE', {panel});
    });
  });

  // Alarm banner
  document.getElementById('btn-ack-all').addEventListener('click', () => dispatch('ACK_ALL'));
  document.getElementById('btn-dismiss-banner').addEventListener('click', () => dispatch('DISMISS_BANNER'));

  // Audit panel
  ['btn-audit-hdr','btn-logs'].forEach(id => document.getElementById(id)?.addEventListener('click', () => dispatch('TOGGLE_AUDIT')));
  document.getElementById('btn-close-audit').addEventListener('click', () => dispatch('TOGGLE_AUDIT'));
  document.getElementById('btn-clear-audit').addEventListener('click', () => dispatch('CLEAR_AUDIT'));
  document.getElementById('btn-export-audit').addEventListener('click', () => {
    const csv = 'Timestamp,Role,Event\n' + S.auditLog.map(e=>`"${e.ts}","${e.role}","${e.msg}"`).join('\n');
    dlFile(csv, `audit-${Date.now()}.csv`, 'text/csv');
    dispatch('LOG',{msg:'Audit log exported to CSV'});
  });

  // ── DEMO BUTTON — CMP-22: OL=X, OD=R/U, AS=C/R/U/D ─────────────
  document.getElementById('btn-demo').addEventListener('click', () => {
    // RBAC guard: OL cannot access emergency scenario simulator
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
            The Emergency Scenario Simulator requires <strong style="color:#212529;">Diagnostic Operator (OD)</strong>
            or <strong style="color:#212529;">System Admin (AS)</strong> role.<br/>
            Current role: <strong style="color:#d97d06;">OL</strong> — Read-only monitoring only.
          </p>
          <div style="font-family:'Courier New',monospace;font-size:11px;color:#6c757d;
                      border:1px solid rgba(0,0,0,.08);padding:8px;">
            CMP-22 Access Matrix: OL=<span style="color:#adb5bd;">X</span> ·
            OD=<span style="color:#159647;">R/U</span> ·
            AS=<span style="color:#159647;">C/R/U/D</span>
          </div>
        </div>`,
      });
      return;
    }
    showModal({
      icon: 'science',
      title: 'Emergency Scenario Simulator',
      content: `<div class="tv space-y-3 text-sm">
        <div class="p-3 border border-[#cd5c08]/20 bg-[#cd5c08]/5 text-[#cd5c08] text-[12px] uppercase tracking-wider font-bold">
          ⚠ Demo Mode — Simulated Emergency Scenarios · All data is synthetic
        </div>
        <p class="text-[#343a40] text-xs">Select a scenario to simulate. The HMI will escalate sensor values, fire alarms, and trigger AI advisories in real time. You can SCRAM at any time (OD/AS) or let the system auto-trip.</p>
        <div class="space-y-2 mt-3">
          <button id="demo-btn-a" class="w-full text-left p-3 border border-[rgba(0,0,0,.1)] hover:bg-[#d1d6dc] transition-colors group">
            <div class="flex items-center gap-2">
              <span class="tv font-bold text-[#d97d06] text-[11px] uppercase tracking-wider">Scenario A — Rising Core Temperature</span>
              <span class="tv text-[11px] text-[#6c757d] ml-auto">~7 min to trip</span>
            </div>
            <p class="tv text-[11px] text-[#343a40] mt-1">Coolant bypass valve partial closure → core temp rises → P3→P2→P1 alarms → auto-SCRAM if unchecked.</p>
          </button>
          <button id="demo-btn-b" class="w-full text-left p-3 border border-[rgba(0,0,0,.1)] hover:bg-[#d1d6dc] transition-colors group">
            <div class="flex items-center gap-2">
              <span class="tv font-bold text-[#cd5c08] text-[11px] uppercase tracking-wider">Scenario B — Loss of Coolant Flow (LOCA)</span>
              <span class="tv text-[11px] text-[#6c757d] ml-auto">~3 min to trip</span>
            </div>
            <p class="tv text-[11px] text-[#343a40] mt-1">Pump-A bearing seizure → flow loss → rapid temp rise → overloaded Pump-B → auto-SCRAM by RPS.</p>
          </button>
          <button id="demo-btn-c" class="w-full text-left p-3 border border-[rgba(0,0,0,.1)] hover:bg-[#d1d6dc] transition-colors group">
            <div class="flex items-center gap-2">
              <span class="tv font-bold text-[#e31a1a] text-[11px] uppercase tracking-wider">Scenario C — Station Blackout (SBO)</span>
              <span class="tv text-[11px] text-[#6c757d] ml-auto">~2 min to trip</span>
            </div>
            <p class="tv text-[11px] text-[#343a40] mt-1">Total AC power loss → pumps coast-down → EDG failure → passive lead-bismuth cooling → passive SCRAM.</p>
          </button>
        </div>
        <div class="mt-3 pt-3 border-t border-[rgba(0,0,0,.08)] text-[12px] text-[#6c757d]">
          Tip: Switch to Safety panel to watch control rod positions and interlock status in real-time.
        </div>
      </div>`,
      primary: 'CLOSE',
    });

    // Bind scenario buttons after modal renders
    setTimeout(() => {
      document.getElementById('demo-btn-a')?.addEventListener('click', () => { hideModal(); ScenarioEngine.runRisingTemp(); dispatch('NAVIGATE',{panel:'panel-primary'}); });
      document.getElementById('demo-btn-b')?.addEventListener('click', () => { hideModal(); ScenarioEngine.runLOCA();       dispatch('NAVIGATE',{panel:'panel-primary'}); });
      document.getElementById('demo-btn-c')?.addEventListener('click', () => { hideModal(); ScenarioEngine.runBlackout();   dispatch('NAVIGATE',{panel:'panel-primary'}); });
    }, 50);
  });

  // Demo reset
  document.getElementById('btn-demo-reset').addEventListener('click', () => ScenarioEngine.resetToNominal());

  // ── Header: System Topology ──────────────────────────────────────
  document.getElementById('btn-tree').addEventListener('click', () => {
    dispatch('LOG',{msg:'System topology reviewed'});
    showModal({
      icon:'account_tree', title:'System Topology — RT-SIM-04',
      content:`<div class="tv text-xs space-y-0">
        <div class="text-[#6c757d] text-[11px] mb-3 uppercase tracking-wider">DAO Connection Map — LFR-4G Unit 4</div>
        ${[['Node Alpha','Reactor Core / Primary Loop','ONLINE','#159647'],
           ['Node Beta', 'Primary Pumps A/B',         'ONLINE','#159647'],
           ['Node Gamma','Emergency Relief Valve',     'OFFLINE','#e31a1a'],
           ['Node Delta','Steam Generator Loop',       'ONLINE','#159647'],
           ['Node Epsilon','Turbine / Generator',      'ONLINE','#159647'],
           ['Node Zeta', 'Grid Interface',             'ONLINE','#159647'],
           ['Node Eta',  'Politecnico AI Physics Core','ONLINE','#159647'],
        ].map(([id,desc,st,col])=>`
          <div class="flex justify-between py-2 border-b border-[rgba(0,0,0,.06)]">
            <span class="text-[#343a40]">${id} — ${desc}</span>
            <span class="font-bold ml-4 shrink-0" style="color:${col}">${st}</span>
          </div>`).join('')}
      </div>`,
    });
  });

  // ── Header: Settings ─────────────────────────────────────────────
  document.getElementById('btn-settings').addEventListener('click', () => {
    showModal({
      icon:'settings', title:'HMI Configuration',
      content:`<div class="tv text-sm space-y-4">
        <div class="text-[#6c757d] text-[11px] uppercase tracking-wider border-b border-[rgba(0,0,0,.08)] pb-2">Display & Operations</div>
        <label class="flex items-center justify-between cursor-pointer py-1 border-b border-[rgba(0,0,0,.06)]">
          <span class="text-[#343a40]">Safe-Mode Overrides</span>
          <input type="checkbox" id="s-safe" class="w-4 h-4 accent-[#495057]" checked/>
        </label>
        <label class="flex items-center justify-between cursor-pointer py-1 border-b border-[rgba(0,0,0,.06)]">
          <span class="text-[#343a40]">Verbose Telemetry Output</span>
          <input type="checkbox" id="s-verb" class="w-4 h-4 accent-[#495057]"/>
        </label>
        <label class="flex items-center justify-between cursor-pointer py-1 border-b border-[rgba(0,0,0,.06)]">
          <span class="text-[#343a40]">Mute Routine Notifications</span>
          <input type="checkbox" id="s-mute" class="w-4 h-4 accent-[#495057]"/>
        </label>
        <div class="pt-2 border-t border-[rgba(0,0,0,.06)]">
          <label class="text-[11px] text-[#6c757d] uppercase tracking-wider">DAO Source Mode</label>
          <select id="s-dao" class="w-full mt-1 bg-[#f4f6f8] border border-[rgba(0,0,0,.1)] px-2 py-1.5 tv text-xs text-[#212529] focus:outline-none">
            <option value="SIMULATED">SIMULATED (Politecnico Model)</option>
            <option value="PHYSICAL">PHYSICAL (Live Sensors)</option>
          </select>
        </div>
        <div class="pt-2 border-t border-[rgba(0,0,0,.06)]">
          <div class="text-[11px] text-[#6c757d] uppercase tracking-widest mb-2">Display (NUREG-0700 §11.4.2)</div>
          <label class="flex items-center justify-between cursor-pointer py-1 border-b border-[rgba(0,0,0,.06)]">
            <span class="text-[#343a40]">High-Contrast Mode</span>
            <input type="checkbox" id="s-hc" class="w-4 h-4 accent-[#495057]" ${S.highContrast ? 'checked' : ''}/>
          </label>
        </div>
      </div>`,
      primary:'SAVE CHANGES', secondary:'CANCEL',
      onConfirm: () => {
        const dao = document.getElementById('s-dao')?.value || 'SIMULATED';
        DAO.mode = dao;
        setText('dao-label', `DAO: ${dao}`);
        setText('diag-dao', dao);
        setText('ai-dao-mode', dao);
        const hcChecked = document.getElementById('s-hc')?.checked ?? false;
        if (hcChecked !== S.highContrast) dispatch('TOGGLE_HIGH_CONTRAST');
        dispatch('LOG',{msg:`Settings saved. DAO mode: ${dao}${hcChecked?' | High-contrast: ON':''}`});
      }
    });
  });

  // ── Header: Logout ───────────────────────────────────────────────
  document.getElementById('btn-logout').addEventListener('click', () => {
    showModal({
      icon:'logout', title:'Terminate Session',
      content:`<div class="tv text-sm space-y-3">
        <div class="p-3 border border-[#e31a1a]/20 bg-[#e31a1a]/5 text-[#e31a1a] text-center font-bold uppercase text-xs">Warning: Active Shift In Progress</div>
        <p class="text-[#343a40]">Ending session transfers authority to standby console. SOP-02B procedural hand-off required.</p>
        <div class="p-2 bg-[#f4f6f8] border border-[rgba(0,0,0,.08)] text-[12px] text-[#6c757d]">Role: ${S.role} · Session: ${S.sessionStart ? ts() : 'N/A'}</div>
      </div>`,
      primary:'TERMINATE', secondary:'ABORT',
      onConfirm: () => {
        ScenarioEngine.stop();
        dispatch('LOG',{msg:`Session terminated. Role: ${S.role}`});
        setTimeout(()=>{
          document.getElementById('role-overlay').style.display='flex';
          // Clear RBAC context on logout
          if (window.RBACContext) RBACContext.clear();
          const navCyber = document.getElementById('nav-cyber');
          if (navCyber) navCyber.style.display = 'none';
          S=mkModel(); scheduleRender();
        },300);
      }
    });
  });

  // ── Sidebar: Help ────────────────────────────────────────────────
  document.getElementById('btn-help').addEventListener('click', () => {
    dispatch('LOG',{msg:'SOP documentation accessed'});
    showModal({
      icon:'help', title:'Protocol Documentation',
      content:`<div class="tv text-xs space-y-3 text-[#343a40]">
        <div class="font-bold text-[#212529] text-sm border-b border-[rgba(0,0,0,.08)] pb-2">SOP-74A: Primary Core Loop Operations</div>
        <div><strong class="text-[#212529]">§4.2.1</strong> Monitor coolant inlet/outlet differential. Max ΔT = 280K.</div>
        <div><strong class="text-[#212529]">§4.2.3</strong> If core temp &gt;1150°C, initiate advisory review per ESS-01.</div>
        <div><strong class="text-[#212529]">§4.2.7</strong> Sub-valve 04-B: inspect every 30-min operational cycle.</div>
        <div><strong class="text-[#212529]">§4.3.1</strong> SCRAM authority: OD and AS roles only. Double-click to confirm.</div>
        <div class="font-bold text-[#212529] text-sm border-b border-[rgba(0,0,0,.08)] pb-2 pt-3">Appendix C: Emergency Depressurization</div>
        <p>Confirm SCRAM engaged → open ERV-01 → notify shift supervisor → log audit trail.</p>
        <div class="p-2 bg-[#f4f6f8] border border-[rgba(0,0,0,.08)] text-[11px] mt-2">IAEA-LFR-OPS-2026-04 | Rev: 4.2 | Class: RESTRICTED</div>
      </div>`,
    });
  });

  // ── Safety: SCRAM (double-click required, CMP-09) ────────────────────────
  let scramN=0, scramT=null;
  bindGuardedButton('btn-scram', 'CMP-09', 'U', () => {
    if (S.scramActive) return;
    scramN++;
    if (scramT) clearTimeout(scramT);
    scramT = setTimeout(()=>{scramN=0;},2200);
    if (scramN>=2) {
      scramN=0;
      showModal({
        icon:'power_settings_new', title:'⚠ CONFIRM SCRAM',
        content:`<div class="tv space-y-3">
          <div class="p-4 border-2 border-[#e31a1a] bg-[#e31a1a]/10 text-center">
            <div class="text-[#e31a1a] font-black text-lg uppercase tracking-wider blink">IRREVERSIBLE ACTION</div>
            <div class="text-sm mt-1 text-[#343a40]">All control rods will be fully inserted. Reactor shuts down immediately.</div>
          </div>
          <div class="tv text-[12px] text-[#6c757d] border border-[rgba(0,0,0,.08)] p-2">Unit: LFR-4G Unit 4 · User: ${S.role} · ${ts()}</div>
        </div>`,
        primary:'EXECUTE SCRAM', secondary:'ABORT',
        onConfirm: () => {
          dispatch('SCRAM');
          dispatch('ADD_ALARM',{alarm:{id:'SCRAM-MAN',p:1,tag:'SCRAM',msg:'Manual SCRAM engaged — all rods inserting',acked:false,ts:ts()}});
          ScenarioEngine.stop();
          showDemoBar('✅ MANUAL SCRAM EXECUTED — Reactor shutting down', '#159647');
        }
      });
    }
  }, showModal);

  // ── Safety: Emergency Depressurize (CMP-12) ──────────────────────────────
  bindGuardedButton('btn-depressurize', 'CMP-12', 'U', () => {
    showModal({
      icon:'warning', title:'Emergency Depressurize',
      content:'<p class="tv text-sm text-[#d97d06]">Opening Emergency Relief Valve ERV-01. This will depressurize the secondary circuit. Continue?</p>',
      primary:'CONFIRM', secondary:'CANCEL',
      onConfirm: () => {
        dispatch('LOG',{msg:'Emergency depressurization — ERV-01 opened'});
        dispatch('ADD_ALARM',{alarm:{id:'DEP-001',p:2,tag:'V-ERV-01',msg:'Emergency depressurization active',acked:false,ts:ts()}});
        addAIMessage('Depressurization confirmed. ERV-01 open. Secondary pressure reducing. Monitor primary pressure ΔP.');
      }
    });
  }, showModal);

  // ── Safety: Reset Interlocks (CMP-13) ─────────────────────────────────────
  bindGuardedButton('btn-reset-locks', 'CMP-13', 'U', () => {
    showModal({
      icon:'settings', title:'Reset Protection Interlocks',
      content:'<p class="tv text-sm text-[#343a40]">Reset all non-SCRAM interlocks to ARMED. Perform only after root cause confirmed.</p>',
      primary:'RESET INTERLOCKS', secondary:'CANCEL',
      onConfirm: ()=>dispatch('RESET_INTERLOCKS'),
    });
  }, showModal);

  // ── SIM RUN ──────────────────────────────────────────────────────
  document.getElementById('btn-run-sim')?.addEventListener('click', () => {
    dispatch('LOG',{msg:'Simulation cycle started — Politecnico Model v3.1'});
    const btn=document.getElementById('btn-run-sim');
    btn.textContent='RUNNING...'; btn.disabled=true;
    setTimeout(()=>{
      btn.textContent='SIM RUN'; btn.disabled=false;
      const ct=S.sensors.CORE_TEMP?.v||1045, pp=S.sensors.PRIM_PRESS?.v||215;
      showModal({
        icon:'check_circle', title:'Simulation Complete',
        content:`<div class="tv text-xs space-y-2">
          <div class="text-[#6c757d] text-[11px]">Politecnico LFR-Physics Model v3.1 · DAO: ${DAO.mode}</div>
          <div class="border border-[rgba(0,0,0,.08)] p-3 space-y-2">
            <div class="flex justify-between"><span class="text-[#6c757d]">Core Temp T+30m</span><span class="font-bold">${(ct+3.4).toFixed(1)} °C</span></div>
            <div class="flex justify-between"><span class="text-[#6c757d]">Pressure T+30m</span><span class="font-bold text-[#d97d06]">${(pp+13.5).toFixed(1)} PSI</span></div>
            <div class="flex justify-between"><span class="text-[#6c757d]">Neutron Flux</span><span class="font-bold">Stable</span></div>
            <div class="flex justify-between"><span class="text-[#6c757d]">Confidence</span><span class="font-bold text-[#159647]">96.2%</span></div>
          </div>
        </div>`,
      });
    }, 3000);
  });

  // ── AI Copilot ───────────────────────────────────────────────────
  document.getElementById('btn-ai-analyze').addEventListener('click', () => {
    dispatch('LOG',{msg:'AI analysis requested'});
    addAIMessage('Thermal analysis complete. Core temp within bounds. Recommend verifying Sub-Valve 04-B within T+5 min. No SCRAM action required at this time.');
    dispatch('NAVIGATE',{panel:'panel-ai'});
  });
  document.getElementById('btn-ai-query').addEventListener('click', handleAIQuery);
  document.getElementById('ai-query-input').addEventListener('keydown', e=>{ if(e.key==='Enter') handleAIQuery(); });
  bindGuardedButton('btn-auto-pilot', 'CMP-17', 'U', () => {
    dispatch('TOGGLE_AUTOPILOT');
    const btn=document.getElementById('btn-auto-pilot');
    if(S.autoPilot){ btn.textContent='⬛ Disable Auto-Pilot'; btn.style.color='#159647'; btn.style.borderColor='#15964733'; }
    else           { btn.textContent='Enable Auto-Pilot Mode'; btn.style.color=''; btn.style.borderColor=''; }
  }, showModal);

  // ── Diagnostics ──────────────────────────────────────────────────
  document.getElementById('diag-search').addEventListener('input', ()=>renderDiagnostics(S));
  document.getElementById('btn-diag-refresh').addEventListener('click', ()=>{ dispatch('LOG',{msg:'Diagnostics refreshed'}); renderDiagnostics(S); });
  bindGuardedButton('btn-diag-export', 'CMP-19', 'R', () => {
    const rows=[['Tag','Description','System','Value','Unit','Trip','Status']];
    Object.values(S.sensors).forEach(s=>rows.push([s.tag,s.label,s.sys,DAO.fmt(s),s.u,s.trip,DAO.status(s).toUpperCase()]));
    dlFile(rows.map(r=>r.join(',')).join('\n'),`sensors-${Date.now()}.csv`,'text/csv');
    dispatch('LOG',{msg:'Sensor data exported to CSV'});
  }, showModal);

  // ── Footer ───────────────────────────────────────────────────────
  document.getElementById('footer-protocol').addEventListener('click', ()=>{
    dispatch('LOG',{msg:'Protocol v4.2 accessed'});
    showModal({icon:'article',title:'Protocol v4.2',content:`<div class="tv text-xs text-[#343a40] space-y-2">
      <div>IAEA-LFR-PROT-2026 · Effective 2026-01-01</div>
      <div class="border border-[rgba(0,0,0,.08)] p-3 space-y-2">
        <div>§1 — HMI Authentication &amp; Role Separation</div>
        <div>§2 — Alarm Priority Classification (ISA-101)</div>
        <div>§3 — Digital Twin Synchronization</div>
        <div>§4 — DAO Physical/Simulated Handover</div>
        <div>§5 — Audit Trail &amp; Compliance</div>
        <div>§6 — Emergency Procedures</div>
      </div>
      <div class="text-[12px] text-[#e31a1a] mt-2">Classification: RESTRICTED</div>
    </div>`});
  });
  document.getElementById('footer-logs').addEventListener('click', ()=>dispatch('TOGGLE_AUDIT'));
  document.getElementById('footer-telemetry').addEventListener('click', ()=>{
    showModal({icon:'sensors',title:'Telemetry Node 08',content:`<div class="tv text-xs space-y-0">
      ${[['Node ID','TELM-NODE-08',''],['Status','ONLINE','#159647'],['Scan Rate','500ms',''],
         ['Latency','8ms','#159647'],['Sensors',String(Object.keys(S.sensors).length),''],
         ['DAO Mode',DAO.mode,'#343a40'],['Encryption','AES-512','']
      ].map(([k,v,c])=>`<div class="flex justify-between py-2 border-b border-[rgba(0,0,0,.06)]"><span class="text-[#6c757d]">${k}</span><span class="font-bold" style="${c?`color:${c}`:'color:#212529'}">${v}</span></div>`).join('')}
    </div>`});
  });
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 10: AI COPILOT MESSAGING
// ═══════════════════════════════════════════════════════════════════
function addAIMessage(text, isUser=false) {
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
    // Colour-code based on severity keywords
    const isAlert = text.includes('🚨') || text.includes('CRITICAL') || text.includes('SCRAM');
    const isWarn  = text.includes('⚠') || text.includes('P2');
    const bdrCol  = isAlert ? '#e31a1a' : isWarn ? '#d97d06' : '#495057';
    div.innerHTML = `<div class="w-7 h-7 bg-[#d1d6dc] flex items-center justify-center flex-shrink-0">
      <span class="ms material-symbols-outlined text-[#343a40] text-[13px]" style="font-variation-settings:'FILL' 1">psychology</span>
    </div>
    <div class="flex-1 bg-[#e2e6ea] p-3 border-l-2" style="border-color:${bdrCol}">
      <div class="tv text-[11px] text-[#6c757d] mb-1">AI COPILOT — ${ts()}</div>
      <p class="tv text-xs text-[#212529]">${text}</p>
    </div>`;
  }
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

const AI_RESPONSES = [
  v=>`Analysis complete for "${v}". All primary circuit parameters within operational bounds. Politecnico model projects stable conditions for T+30 minutes at current trajectory.`,
  v=>`Query processed: "${v}". Physics model v3.1 indicates ${(Math.random()*2).toFixed(1)}% deviation from baseline — within ±5% tolerance. No corrective action required.`,
  v=>`Advisory for "${v}": nominal performance confirmed. Continue monitoring per SCCP-74A. Next checkpoint in T+15 minutes.`,
  v=>`Predictive analysis: "${v}" — parameters trending within safe limits. Core temperature stable at current rod position.`,
];

function handleAIQuery() {
  const inp = document.getElementById('ai-query-input');
  const q = inp.value.trim(); if (!q) return;
  addAIMessage(q, true); inp.value = '';
  dispatch('LOG',{msg:`AI query: "${q}"`});
  setTimeout(()=>addAIMessage(AI_RESPONSES[Math.floor(Math.random()*AI_RESPONSES.length)](q)), 500+Math.random()*900);
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 11: CLOCK & DATA LOOP
// ═══════════════════════════════════════════════════════════════════
function startClock() {
  const el = document.getElementById('utc-clock');
  (function tick() {
    if (el) {
      const n=new Date();
      el.textContent=`${p2(n.getUTCHours())}:${p2(n.getUTCMinutes())}:${p2(n.getUTCSeconds())}:${p3(n.getUTCMilliseconds())} UTC`;
    }
    requestAnimationFrame(tick);
  })();
}

// ── Session Timeout (NUREG-0700 §6.5 — 15 min inactivity) ───────────
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const TIMEOUT_WARN_MS    =  1 * 60 * 1000; // warn at 1 min remaining
let _sessionTimer = null;
let _sessionWarnShown = false;

function resetSessionTimer() {
  if (!S.role) return;  // only active when logged in
  _sessionWarnShown = false;
  if (_sessionTimer) clearTimeout(_sessionTimer);
  _sessionTimer = setTimeout(() => {
    console.warn('[SESSION] Timeout — logging out');
    ScenarioEngine.stop();
    S = reduce(S, 'SESSION_TIMEOUT');
    document.getElementById('role-overlay').style.display = 'flex';
    if (window.RBACContext) RBACContext.clear();
    const navCyber = document.getElementById('nav-cyber');
    if (navCyber) navCyber.style.display = 'none';
    scheduleRender();
  }, SESSION_TIMEOUT_MS);
}

function startDataLoop() {
  setInterval(() => {
    if (!S.role) return;
    DAO.tick(S.scramActive);
    S = reduce(S, 'TICK');

    // Flush RTN log entries from DAO
    while (DAO._rtnQueue && DAO._rtnQueue.length > 0) {
      S = reduce(S, 'LOG', { msg: DAO._rtnQueue.shift() });
    }

    // Session timeout warning (1 min before logout)
    if (S.lastActivity && !_sessionWarnShown) {
      const idleMs = Date.now() - S.lastActivity;
      if (idleMs > SESSION_TIMEOUT_MS - TIMEOUT_WARN_MS) {
        _sessionWarnShown = true;
        showModal({
          icon: 'timer',
          title: 'Session Timeout Warning',
          content: '<p class="tv text-sm text-[#d97d06]">Your session will automatically log out in 1 minute due to inactivity. Click STAY LOGGED IN to continue.</p>',
          primary: 'STAY LOGGED IN',
          onConfirm: () => { dispatch('TOUCH_ACTIVITY'); resetSessionTimer(); }
        });
      }
    }

    // Auto-alarm: core temp high (only outside scenario to avoid duplicates)
    const ct = S.sensors.CORE_TEMP?.v ?? 0;
    if (ct > 1150 && !S.alarms.find(a=>a.id==='A-CT-HI') && !ScenarioEngine.active) {
      S = reduce(S,'ADD_ALARM',{alarm:{id:'A-CT-HI',p:2,tag:'T-CORE-01',msg:`Core temp elevated: ${ct.toFixed(1)}°C`,acked:false,ts:ts()}});
    }

    // Update exception alert in primary panel copilot
    if (S.sensors.PRIM_PRESS) {
      const delta = (S.sensors.PRIM_PRESS.v - 214.8).toFixed(1);
      const sign = delta > 0 ? '+' : '';
      setText('copilot-delta', `${sign}${delta} PSI`);
    }

    scheduleRender();
  }, 800);
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 12: UTILITIES
// ═══════════════════════════════════════════════════════════════════
function ts()              { const n=new Date(); return `${p2(n.getUTCHours())}:${p2(n.getUTCMinutes())}:${p2(n.getUTCSeconds())} UTC`; }
function mkEntry(msg,role) { return { ts:ts(), role:role||'SYS', msg }; }
function p2(n)             { return String(n).padStart(2,'0'); }
function p3(n)             { return String(n).padStart(3,'0'); }
function pct(v,lo,hi)      { return ((v-lo)/(hi-lo))*100; }
function setText(id,val)   { const e=document.getElementById(id); if(e&&val!==null) e.textContent=val; }
function setAttr(id,a,v)   { const e=document.getElementById(id); if(e) e.setAttribute(a,v); }
function dlFile(content,name,type) {
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click();
  URL.revokeObjectURL(a.href);
}

// ═══════════════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // ISA-5.1 tag validation at startup (silently checks DAO)
  bindAll();
  startClock();
  startDataLoop();
  initThreeJS();
  scheduleRender();

  // Session activity tracking (NUREG-0700 §6.5)
  ['mousemove','keydown','click','touchstart'].forEach(evt =>
    document.addEventListener(evt, () => {
      if (S.role) { dispatch('TOUCH_ACTIVITY'); resetSessionTimer(); }
    }, { passive: true })
  );
});
