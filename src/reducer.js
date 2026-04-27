/**
 * CORE-SENTINEL HMI — MVI Reducer (State Machine)
 * ISA-101 §6.5 / IEC 61511 §11.5 / NUREG-0700
 *
 * Pure function: (state, intent, payload) => newState
 * All state updates use immutable spread patterns — no direct mutation.
 */
import { S, setS, mkModel } from './model.js';
import { mkEntry } from '../utils.js';
import { render } from './views/render.js';
import { ACTION_TYPES as A } from '../constants/actionTypes.js';

// ── RBAC Permission Matrix (ISA-101 §6.5 / NUREG-0700) ────────────────────
// Only intents that are RESTRICTED appear here.
// Intents not listed are freely accessible to any authenticated role.
export const INTENT_PERMISSIONS = Object.freeze({
  [A.SCRAM]:             ['OD', 'AS'],
  [A.RESET_SCRAM]:       ['AS'],
  [A.TOGGLE_AUTOPILOT]:  ['OD', 'AS'],
  [A.RESET_INTERLOCKS]:  ['AS'],
  [A.SHELF_ALARM]:       ['OD', 'AS'],
  [A.UNSHELVE_ALARM]:    ['OD', 'AS'],
  [A.ADVANCE_PROTOCOL]:  ['OD', 'AS'],
  // Config layer — write actions restricted to AS (SCR-14)
  [A.CONFIG_UPDATE]:     ['AS'],
  [A.CONFIG_ROLLBACK]:   ['AS'],
  [A.CONFIG_IMPORT]:     ['AS'],
  [A.CONFIG_RESET]:      ['AS'],
});

// ═══════════════════════════════════════════════════════════════════════════
// reduce — The central state machine.
// ═══════════════════════════════════════════════════════════════════════════
export function reduce(s, intent, p = {}) {
  // ── RBAC Guard (ISA-101 §6.5) ──────────────────────────────────────────
  // Guard runs unconditionally — no window dependency so it works in Node/test env.
  if (INTENT_PERMISSIONS[intent]) {
    const allowed = INTENT_PERMISSIONS[intent];
    if (!s.role || !allowed.includes(s.role)) {
      const denyMsg = `SECURITY: Intent "${intent}" denied — role ${s.role || 'NONE'} lacks permission`;
      console.warn(`[RBAC] ${denyMsg}`);
      // Return current state unchanged — immutable rejection.
      return { ...s, auditLog: [...s.auditLog, mkEntry(denyMsg, s.role)] };
    }
  }

  // Convenience: append a new audit entry without mutating s.auditLog.
  const log = msg => [...s.auditLog, mkEntry(msg, s.role)];

  switch (intent) {
    // ── Session ──────────────────────────────────────────────────────────
    case A.SET_ROLE:
      return {
        ...s,
        role: p.role,
        sessionStart: new Date(),
        lastActivity: Date.now(),
        auditLog: log(`Session started. Role: ${p.role}`),
      };

    case A.TOUCH_ACTIVITY:
      return { ...s, lastActivity: Date.now() };

    case A.SESSION_TIMEOUT:
      return {
        ...mkModel(),
        auditLog: [mkEntry('SESSION TIMEOUT: Automatic logout after inactivity', null)],
      };

    // ── Navigation ───────────────────────────────────────────────────────
    case A.NAVIGATE:
      return { ...s, activePanel: p.panel, auditLog: log(`Navigated to: ${p.panel}`) };

    // ── Alarm Management (ISA-101 §5) ─────────────────────────────────────
    case A.ACK_ALL:
      return {
        ...s,
        alarms: s.alarms.map(a => ({ ...a, acked: true })),
        auditLog: log('All alarms acknowledged'),
      };

    case A.DISMISS_BANNER:
      return { ...s, bannerOn: false };

    case A.ADD_ALARM: {
      // ISA-101 §5.3: First alarm in a quiet cascade is marked firstOut.
      const hasActive = s.alarms.some(a => !a.acked && !a.cleared && !a.shelved);
      // Enforced invariants come AFTER ...p.alarm so callers cannot pre-shelve or pre-clear an alarm.
      const newAlarm  = { ...p.alarm, cleared: false, shelved: false, firstOut: !hasActive };
      return {
        ...s,
        alarms:   [...s.alarms, newAlarm],
        bannerOn: true,
        auditLog: log(`ALARM [P${newAlarm.p}] ${newAlarm.tag}: ${newAlarm.msg}${newAlarm.firstOut ? ' [FIRST-OUT]' : ''}`),
      };
    }

    case A.CLEAR_ALARM:
      return {
        ...s,
        alarms:   s.alarms.map(a => a.id === p.id ? { ...a, cleared: true } : a),
        auditLog: log(`Alarm cleared: ${p.id}`),
      };

    case A.SHELF_ALARM:
      // ISA-101 §5.6: Shelving temporarily suppresses a nuisance alarm (OD/AS only).
      return {
        ...s,
        alarms:   s.alarms.map(a => a.id === p.id ? { ...a, shelved: true } : a),
        auditLog: log(`Alarm shelved: ${p.id}`),
      };

    case A.UNSHELVE_ALARM:
      return {
        ...s,
        alarms:   s.alarms.map(a => a.id === p.id ? { ...a, shelved: false } : a),
        auditLog: log(`Alarm unshelved: ${p.id}`),
      };

    case A.CLEAR_ALARMS_BY_PREFIX:
      return {
        ...s,
        alarms: s.alarms.filter(a => !a.id.startsWith(p.prefix)),
      };

    // ── Safety-Critical (RBAC-guarded above) ─────────────────────────────
    case A.SCRAM:
      return {
        ...s,
        scramActive: true,
        auditLog:    log(`⚠ SCRAM INITIATED by ${s.role || 'SYSTEM'}`),
      };

    case A.AUTO_SCRAM:
      return {
        ...s,
        scramActive: true,
        auditLog:    log('⚠ AUTO-SCRAM by Reactor Protection System'),
      };

    case A.RESET_SCRAM:
      return {
        ...s,
        scramActive: false,
        auditLog:    log('SCRAM state reset — nominal restored'),
      };

    case A.RESET_INTERLOCKS:
      return {
        ...s,
        interlocks: s.interlocks.map(i => i.st === 'OFFLINE' ? { ...i, st: 'ARMED' } : i),
        auditLog:   log('Interlocks reset to ARMED'),
      };

    case A.ADVANCE_PROTOCOL:
      return {
        ...s,
        protocolStep: Math.min(s.protocolStep + 1, 4),
        auditLog:     log(`SCCP-74A Step ${s.protocolStep} acknowledged`),
      };

    // ── Control ───────────────────────────────────────────────────────────
    case A.TOGGLE_AUTOPILOT:
      return {
        ...s,
        autoPilot: !s.autoPilot,
        auditLog:  log(`Auto-Pilot ${!s.autoPilot ? 'ENABLED' : 'DISABLED'}`),
      };

    // ── Sensor Telemetry ──────────────────────────────────────────────────
    case A.TICK: {
      const snap = p.snapshot || s.sensors;
      return {
        ...s,
        sensors:   snap,
        histTemp:  [...s.histTemp.slice(-19),  snap.CORE_TEMP?.v  ?? 1045],
        histPress: [...s.histPress.slice(-19), snap.PRIM_PRESS?.v ?? 215],
      };
    }

    // ── Audit & UI ────────────────────────────────────────────────────────
    case A.LOG:
      return { ...s, auditLog: log(p.msg) };

    case A.CLEAR_AUDIT:
      return { ...s, auditLog: [mkEntry('Audit log cleared', s.role)] };

    case A.TOGGLE_AUDIT:
      return { ...s, auditPanelOpen: !s.auditPanelOpen };

    case A.TOGGLE_HIGH_CONTRAST: {
      // NUREG-0700 §11.4.2: High-contrast mode for varied lighting conditions.
      const hc = !s.highContrast;
      return { ...s, highContrast: hc, auditLog: log(`High-contrast mode ${hc ? 'ENABLED' : 'DISABLED'}`) };
    }

    case A.SET_DEMO_MODE:
      return { ...s, demoMode: p.active };

    // ── Configuration Layer (WP 1.3 — AAS IEC 63278 / ISA-101 §5.4) ─────────
    // ConfigService handles its own persistence; the reducer only manages
    // UI state (active tab) and the audit log.

    case A.CONFIG_UPDATE:
      return {
        ...s,
        configActiveTab: s.configActiveTab ?? 'measures',
        auditLog: log(`CONFIG UPDATE [${p.submodel ?? 'measures'}] v${p.version ?? '—'} — ${p.reason ?? ''}`),
      };

    case A.CONFIG_ROLLBACK:
      return {
        ...s,
        configActiveTab: 'versions',
        auditLog: log(`CONFIG ROLLBACK to ${p.targetVersion ?? '—'} — ${p.reason ?? ''}`),
      };

    case A.CONFIG_IMPORT:
      return {
        ...s,
        configActiveTab: 'overview',
        auditLog: log(`CONFIG IMPORT — ${p.reason ?? ''}`),
      };

    case A.CONFIG_RESET:
      return {
        ...s,
        configActiveTab: 'overview',
        auditLog: log('CONFIG FACTORY RESET'),
      };

    case A.CONFIG_TAB_CHANGE:
      return { ...s, configActiveTab: p.tab ?? 'overview' };

    default:
      return s;
  }
}

// ── dispatch — Applies an intent to global state and schedules a re-render ──
export function dispatch(intent, payload = {}) {
  setS(reduce(S, intent, payload));
  scheduleRender();
}

// ── scheduleRender — RAF-throttled render to avoid redundant paints ──────────
let _renderQueued = false;
export function scheduleRender() {
  if (!_renderQueued) {
    _renderQueued = true;
    requestAnimationFrame(() => {
      _renderQueued = false;
      render(S);
    });
  }
}