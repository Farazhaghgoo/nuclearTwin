import { ACTION_TYPES as A } from '../constants/actionTypes.js';
import { S } from './model.js';
import { DAO } from './dao.js';
import { dispatch, scheduleRender } from './reducer.js';
import { ts } from '../utils.js';
import { addAIMessage, showDemoBar, setEmergencyOverlay, hideDemoBar } from './events.js';

// Three emergency scenarios that play out over time
// ═══════════════════════════════════════════════════════════════════
export const ScenarioEngine = {
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
    dispatch(A.SET_DEMO_MODE, { active:false });
    dispatch(A.RESET_SCRAM);
    dispatch(A.CLEAR_ALARMS_BY_PREFIX, { prefix:'DEMO' });
    dispatch(A.LOG, { msg:'System reset to nominal state by operator' });

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
    dispatch(A.SET_DEMO_MODE, { active:true });
    dispatch(A.LOG, { msg:'DEMO SCENARIO A: Rising Core Temperature initiated' });

    showDemoBar('SCENARIO A — Rising Core Temp: Coolant bypass valve restriction detected', '#d97d06');
    this.startCountdown(420); // ~7 min trip estimate

    dispatch(A.ADD_ALARM, { alarm:{ id:'DEMO-A01', p:3, tag:'T-CORE-01', msg:'Core temp rising — bypass valve partial restriction', acked:false, ts:ts() }});
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
        dispatch(A.ADD_ALARM, { alarm:{ id:'DEMO-A02', p:2, tag:'T-CORE-01', msg:`Core temp ${DAO._s.CORE_TEMP.v.toFixed(1)}°C — approaching trip limit`, acked:false, ts:ts() }});
        addAIMessage('⚠ P2 ALARM: Core temperature exceeded 1100°C. Recommend initiating control rod insertion. Time to P1 trip limit: ~6 minutes at current rate.');
        showDemoBar('⚠ P2 ALARM — Core temp 1100°C — Control rod insertion recommended', '#d97d06');
        this.startCountdown(360);
      }

      // P1 threshold ~1160°C
      if (DAO._s.CORE_TEMP.v > 1160 && !S.alarms.find(a=>a.id==='DEMO-A03')) {
        dispatch(A.ADD_ALARM, { alarm:{ id:'DEMO-A03', p:1, tag:'T-CORE-01', msg:`CRITICAL: Core temp ${DAO._s.CORE_TEMP.v.toFixed(1)}°C — SCRAM recommended`, acked:false, ts:ts() }});
        addAIMessage('🚨 P1 CRITICAL ALARM: Core temperature at ' + DAO._s.CORE_TEMP.v.toFixed(1) + '°C — 97% of trip limit. SCRAM RECOMMENDED IMMEDIATELY. Predicted trip in T+90s without action.');
        showDemoBar('🚨 P1 CRITICAL — Core temp ' + DAO._s.CORE_TEMP.v.toFixed(0) + '°C — SCRAM REQUIRED', '#e31a1a');
        this.startCountdown(90);
        const su = document.getElementById('sidebar-unit-state');
        if (su) { su.textContent = 'Unit 4: CRITICAL'; su.style.color = '#e31a1a'; }
      }

      // Auto-SCRAM at trip limit
      if (DAO._s.CORE_TEMP.v > 1195 && !S.scramActive) {
        dispatch(A.AUTO_SCRAM);
        dispatch(A.ADD_ALARM, { alarm:{ id:'DEMO-A-SCRAM', p:1, tag:'SCRAM', msg:'AUTO-SCRAM: Core temp exceeded trip limit 1195°C', acked:false, ts:ts() }});
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
    dispatch(A.SET_DEMO_MODE, { active:true });
    dispatch(A.LOG, { msg:'DEMO SCENARIO B: LOCA initiated' });

    showDemoBar('SCENARIO B — LOCA: Pump-A bearing seizure detected', '#e31a1a');
    this.startCountdown(180);

    // Immediate pump failure
    DAO._s.PUMP_A.v = 0;
    DAO._s.SEC_FLOW.v = 1400;

    dispatch(A.ADD_ALARM, { alarm:{ id:'DEMO-B01', p:1, tag:'N-PMP-A-01', msg:'PUMP-A BEARING SEIZURE — Loop-A primary flow lost', acked:false, ts:ts() }});
    dispatch(A.ADD_ALARM, { alarm:{ id:'DEMO-B02', p:2, tag:'F-PRI-01',   msg:'Primary flow: 48% nominal — Lo-Low trip armed',    acked:false, ts:ts() }});
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
        dispatch(A.ADD_ALARM, { alarm:{ id:'DEMO-B03', p:1, tag:'T-CORE-01', msg:`Core temp ${DAO._s.CORE_TEMP.v.toFixed(0)}°C rising rapidly`, acked:false, ts:ts() }});
        addAIMessage('🚨 CORE TEMP: ' + DAO._s.CORE_TEMP.v.toFixed(1) + '°C · Rate: +' + (7+step*.6).toFixed(0) + '°C/min. Pump-B overloaded at 118% rated. Risk of second pump failure. SCRAM AND DEPRESSURIZE NOW.');
        showDemoBar('🚨 P1 LOCA — Core temp ' + DAO._s.CORE_TEMP.v.toFixed(0) + '°C rising — SCRAM REQUIRED', '#e31a1a');
        this.startCountdown(120);
      }

      // Auto-SCRAM
      if (DAO._s.CORE_TEMP.v > 1180 && !S.scramActive) {
        dispatch(A.AUTO_SCRAM);
        dispatch(A.ADD_ALARM, { alarm:{ id:'DEMO-B-SCRAM', p:1, tag:'SCRAM', msg:'AUTO-SCRAM: Core temp/flow trip actuated by RPS', acked:false, ts:ts() }});
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
    dispatch(A.SET_DEMO_MODE, { active:true });
    dispatch(A.LOG, { msg:'DEMO SCENARIO C: Station Blackout initiated' });

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
    ].forEach(alarm => dispatch(A.ADD_ALARM, { alarm:{ ...alarm, acked:false, ts:ts() }}));

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
        dispatch(A.ADD_ALARM, { alarm:{ id:'DEMO-C05', p:1, tag:'T-CORE-01', msg:`Core temp ${DAO._s.CORE_TEMP.v.toFixed(0)}°C — decay heat accumulating`, acked:false, ts:ts() }});
        showDemoBar('🚨 EDG FAILURE — Decay heat accumulating — SCRAM IMMINENT', '#e31a1a');
        this.startCountdown(60);
      }

      if (step === 6) {
        dispatch(A.ADD_ALARM, { alarm:{ id:'DEMO-C06', p:1, tag:'V-SCR-01', msg:'SCRAM bus voltage: 37.8V — threshold approaching', acked:false, ts:ts() }});
        addAIMessage('🚨 EDG-2 FAILED. SCRAM bus voltage: ' + DAO._s.SCRAM_V.v.toFixed(1) + 'V — approaching undervoltage trip. Battery reserve: ~4 minutes. PASSIVE SCRAM ACTUATING.');
      }

      // Auto-SCRAM at step 8+ or if SCRAM voltage trips
      if ((step >= 8 || DAO._s.SCRAM_V.v < 38.5) && !S.scramActive) {
        dispatch(A.AUTO_SCRAM);
        dispatch(A.ADD_ALARM, { alarm:{ id:'DEMO-C-SCRAM', p:1, tag:'SCRAM', msg:'PASSIVE SCRAM: Gravity-drop rods by SCRAM bus undervoltage', acked:false, ts:ts() }});
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