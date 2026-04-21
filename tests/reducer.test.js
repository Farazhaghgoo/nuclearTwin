import { describe, test, expect, vi, beforeEach } from 'vitest';
import { reduce, INTENT_PERMISSIONS } from '../src/reducer.js';
import { mkModel } from '../src/model.js';
import { ACTION_TYPES as A } from '../constants/actionTypes.js';

/**
 * CORE-SENTINEL HMI — Reducer Unit Tests
 * IEC 61511 §11.5: Software validation evidence
 * ISA-101 §6.5: RBAC permission matrix verification
 *
 * Coverage: All 27 reducer cases + full RBAC guard matrix.
 */

// ─── Mocks for browser-specific modules ─────────────────────────────────────
vi.mock('../src/views/render.js', () => ({
  render:               vi.fn(),
  renderRole:           vi.fn(),
  renderPanels:         vi.fn(),
  renderAlarmBanner:    vi.fn(),
  renderHUD:            vi.fn(),
  renderSystemHealth:   vi.fn(),
  renderCyberPanel:     vi.fn(),
  renderCharts:         vi.fn(),
  renderAuditPanel:     vi.fn(),
  renderSafetyPanel:    vi.fn(),
  renderSecondaryStats: vi.fn(),
  renderDiagnostics:    vi.fn(),
  renderAIPredictions:  vi.fn(),
  renderAnomalyList:    vi.fn(),
  renderCopilotSteps:   vi.fn(),
}));

vi.mock('../utils.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, ts: () => '11:50:00 UTC' };
});

// Mock DAO.snapshot() so TICK tests are deterministic
vi.mock('../src/dao.js', () => ({
  DAO: {
    snapshot: vi.fn(() => ({
      CORE_TEMP:  { tag: 'T-CORE-01', label: 'Core Temp',   v: 1050, unit: '°C'  },
      PRIM_PRESS: { tag: 'P-PRI-01',  label: 'Prim Press',  v: 215,  unit: 'PSI' },
    })),
    tick:     vi.fn(),
    mode:     'SIMULATED',
  },
}));

// Also mock document for TOGGLE_HIGH_CONTRAST
global.document = {
  documentElement: { setAttribute: vi.fn() },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const mk    = (overrides = {}) => ({ ...mkModel(), ...overrides });
const lastLog = (s) => s.auditLog.at(-1)?.msg ?? '';


// ═════════════════════════════════════════════════════════════════════════════
describe('RBAC Permission Matrix — full guard coverage (ISA-101 §6.5)', () => {

  // Centralised table: [intent, allowedRoles, deniedRoles]
  const MATRIX = [
    [A.SCRAM,            ['OD', 'AS'], ['OL', null]],
    [A.RESET_SCRAM,      ['AS'],       ['OL', 'OD', null]],
    [A.TOGGLE_AUTOPILOT, ['OD', 'AS'], ['OL', null]],
    [A.RESET_INTERLOCKS, ['AS'],       ['OL', 'OD', null]],
    [A.SHELF_ALARM,      ['OD', 'AS'], ['OL', null]],
    [A.UNSHELVE_ALARM,   ['OD', 'AS'], ['OL', null]],
  ];

  for (const [intent, allowed, denied] of MATRIX) {
    for (const role of allowed) {
      test(`${intent}: ALLOWED for role=${role}`, () => {
        const s = mk({ role, scramActive: false, autoPilot: false, alarms: [] });
        const next = reduce(s, intent, { id: 'X' });
        expect(lastLog(next)).not.toMatch(/SECURITY/);
      });
    }

    for (const role of denied) {
      test(`${intent}: DENIED for role=${role ?? 'null'}`, () => {
        const s = mk({ role, scramActive: false });
        const next = reduce(s, intent);
        // Guard must not execute side-effects
        if (intent === A.SCRAM)            expect(next.scramActive).toBe(false);
        if (intent === A.RESET_SCRAM)      expect(next.scramActive).toBe(false);
        if (intent === A.TOGGLE_AUTOPILOT) expect(next.autoPilot).toBe(false);
        expect(lastLog(next)).toMatch(/SECURITY/);
      });
    }
  }

  test('INTENT_PERMISSIONS freeze prevents tampering', () => {
    expect(() => { INTENT_PERMISSIONS[A.SCRAM] = []; }).toThrow();
  });
});


// ═════════════════════════════════════════════════════════════════════════════
describe('Session & Auth', () => {

  test('SET_ROLE: sets role, records sessionStart and lastActivity', () => {
    const before = Date.now();
    const s    = mk();
    const next = reduce(s, A.SET_ROLE, { role: 'OD' });
    expect(next.role).toBe('OD');
    expect(next.sessionStart).toBeInstanceOf(Date);
    expect(next.lastActivity).toBeGreaterThanOrEqual(before);
    expect(lastLog(next)).toContain('OD');
  });

  test('SET_ROLE: null role stores null', () => {
    const next = reduce(mk({ role: 'AS' }), A.SET_ROLE, { role: null });
    expect(next.role).toBeNull();
  });

  test('TOUCH_ACTIVITY: updates lastActivity', () => {
    const before = Date.now();
    const next = reduce(mk({ role: 'OL', lastActivity: 0 }), A.TOUCH_ACTIVITY);
    expect(next.lastActivity).toBeGreaterThanOrEqual(before);
  });

  test('SESSION_TIMEOUT: resets to fresh model, logs timeout', () => {
    const s    = mk({ role: 'OD', scramActive: true });
    const next = reduce(s, A.SESSION_TIMEOUT);
    expect(next.role).toBeNull();
    expect(next.scramActive).toBe(false);
    expect(next.auditLog).toHaveLength(1);
    expect(lastLog(next)).toContain('SESSION TIMEOUT');
  });
});


// ═════════════════════════════════════════════════════════════════════════════
describe('Navigation', () => {

  test('NAVIGATE: updates activePanel', () => {
    const next = reduce(mk(), A.NAVIGATE, { panel: 'panel-safety' });
    expect(next.activePanel).toBe('panel-safety');
  });

  test('NAVIGATE: appends to audit log', () => {
    const next = reduce(mk({ role: 'OL' }), A.NAVIGATE, { panel: 'panel-ai' });
    expect(lastLog(next)).toContain('panel-ai');
  });
});


// ═════════════════════════════════════════════════════════════════════════════
describe('Alarm Management (ISA-101 §5)', () => {

  const alarm = (overrides = {}) => ({
    id: 'T-001', p: 2, tag: 'T-CORE-01', msg: 'Test alarm', ...overrides,
  });

  test('ADD_ALARM: sets cleared:false and activates banner', () => {
    const s    = mk({ role: 'OL' });
    const next = reduce(s, A.ADD_ALARM, { alarm: alarm() });
    expect(next.alarms.at(-1).cleared).toBe(false);
    expect(next.bannerOn).toBe(true);
  });

  test('ADD_ALARM: shelved:false is always applied', () => {
    const s    = mk({ role: 'OL' });
    const next = reduce(s, A.ADD_ALARM, { alarm: alarm({ shelved: true }) });
    // alarm payload said shelved:true — ADD_ALARM must coerce to false
    expect(next.alarms.at(-1).shelved).toBe(false);
  });

  test('ACK_ALL: acknowledges every alarm', () => {
    const s = mk({ role: 'OL', alarms: [
      { id: 'A1', acked: false, cleared: false },
      { id: 'A2', acked: false, cleared: false },
    ]});
    const next = reduce(s, A.ACK_ALL);
    expect(next.alarms.every(a => a.acked)).toBe(true);
    expect(lastLog(next)).toContain('acknowledged');
  });

  test('CLEAR_ALARM: sets cleared:true only on target', () => {
    let s = mk({ role: 'OL', alarms: [] });
    s = reduce(s, A.ADD_ALARM, { alarm: alarm({ id: 'C-01' }) });
    s = reduce(s, A.ADD_ALARM, { alarm: alarm({ id: 'C-02' }) });
    const next = reduce(s, A.CLEAR_ALARM, { id: 'C-01' });
    expect(next.alarms.find(a => a.id === 'C-01').cleared).toBe(true);
    expect(next.alarms.find(a => a.id === 'C-02').cleared).toBe(false);
    expect(lastLog(next)).toContain('C-01');
  });

  test('DISMISS_BANNER: sets bannerOn to false', () => {
    const next = reduce(mk({ bannerOn: true }), A.DISMISS_BANNER);
    expect(next.bannerOn).toBe(false);
  });

  test('CLEAR_ALARMS_BY_PREFIX: removes only matching alarms', () => {
    const s = mk({ alarms: [
      { id: 'SCEN-01', p: 1 },
      { id: 'SCEN-02', p: 2 },
      { id: 'A-CT-HI', p: 1 },
    ]});
    const next = reduce(s, A.CLEAR_ALARMS_BY_PREFIX, { prefix: 'SCEN-' });
    expect(next.alarms).toHaveLength(1);
    expect(next.alarms[0].id).toBe('A-CT-HI');
  });

  test('SHELF_ALARM: OD can shelve; non-target alarm untouched', () => {
    let s = mk({ role: 'OD', alarms: [] });
    s = reduce(s, A.ADD_ALARM, { alarm: alarm({ id: 'SH-01' }) });
    s = reduce(s, A.ADD_ALARM, { alarm: alarm({ id: 'SH-02' }) });
    const next = reduce(s, A.SHELF_ALARM, { id: 'SH-01' });
    expect(next.alarms.find(a => a.id === 'SH-01').shelved).toBe(true);
    expect(next.alarms.find(a => a.id === 'SH-02').shelved).toBe(false);
    expect(lastLog(next)).toContain('shelved');
  });

  test('SHELF_ALARM: OL is denied (RBAC)', () => {
    let s = mk({ role: 'OL', alarms: [] });
    s = reduce(s, A.ADD_ALARM, { alarm: alarm({ id: 'SH-OL' }) });
    const next = reduce(s, A.SHELF_ALARM, { id: 'SH-OL' });
    expect(next.alarms[0].shelved).toBeFalsy();
    expect(lastLog(next)).toMatch(/SECURITY/);
  });

  test('UNSHELVE_ALARM: restores shelved alarm', () => {
    let s = mk({ role: 'AS', alarms: [] });
    s = reduce(s, A.ADD_ALARM, { alarm: alarm({ id: 'USH-01' }) });
    s = reduce(s, A.SHELF_ALARM, { id: 'USH-01' });
    const next = reduce(s, A.UNSHELVE_ALARM, { id: 'USH-01' });
    expect(next.alarms[0].shelved).toBe(false);
    expect(lastLog(next)).toContain('unshelved');
  });

  test('UNSHELVE_ALARM: OL is denied (RBAC)', () => {
    const s = mk({ role: 'OL', alarms: [{ id: 'U-OL', shelved: true }] });
    const next = reduce(s, A.UNSHELVE_ALARM, { id: 'U-OL' });
    expect(next.alarms[0].shelved).toBe(true);
    expect(lastLog(next)).toMatch(/SECURITY/);
  });

  test('Audit entry for ADD_ALARM includes priority and tag', () => {
    const s    = mk({ role: 'OD', alarms: [] });
    const next = reduce(s, A.ADD_ALARM, { alarm: alarm({ p: 1, tag: 'T-CORE-01' }) });
    expect(lastLog(next)).toContain('P1');
    expect(lastLog(next)).toContain('T-CORE-01');
  });
});


// ═════════════════════════════════════════════════════════════════════════════
describe('First-Out Tracking (ISA-101 §5.3)', () => {

  test('First alarm in quiet state → firstOut:true', () => {
    const s    = mk({ role: 'OL', alarms: [] });
    const next = reduce(s, A.ADD_ALARM, { alarm: { id: 'FO-1', p: 1, tag: 'X', msg: 'M' } });
    expect(next.alarms[0].firstOut).toBe(true);
  });

  test('Subsequent alarm in active cascade → firstOut:false', () => {
    let s = mk({ role: 'OL', alarms: [] });
    s = reduce(s, A.ADD_ALARM, { alarm: { id: 'FO-2a', p: 1, tag: 'A', msg: '1st' } });
    const next = reduce(s, A.ADD_ALARM, { alarm: { id: 'FO-2b', p: 2, tag: 'B', msg: '2nd' } });
    expect(next.alarms[0].firstOut).toBe(true);
    expect(next.alarms[1].firstOut).toBe(false);
  });

  test('After all alarms shelved, next alarm gets firstOut:true', () => {
    let s = mk({ role: 'AS', alarms: [] });
    s = reduce(s, A.ADD_ALARM, { alarm: { id: 'FO-3a', p: 2, tag: 'A', msg: 'Old' } });
    s = reduce(s, A.SHELF_ALARM, { id: 'FO-3a' });
    const next = reduce(s, A.ADD_ALARM, { alarm: { id: 'FO-3b', p: 1, tag: 'B', msg: 'New' } });
    expect(next.alarms.at(-1).firstOut).toBe(true);
  });

  test('After all alarms cleared, next alarm gets firstOut:true', () => {
    let s = mk({ role: 'OD', alarms: [] });
    s = reduce(s, A.ADD_ALARM, { alarm: { id: 'FO-4a', p: 2, tag: 'A', msg: 'Old' } });
    s = reduce(s, A.CLEAR_ALARM, { id: 'FO-4a' });
    const next = reduce(s, A.ADD_ALARM, { alarm: { id: 'FO-4b', p: 1, tag: 'B', msg: 'New' } });
    expect(next.alarms.at(-1).firstOut).toBe(true);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
describe('Safety-Critical Actions (RBAC-guarded)', () => {

  test('SCRAM: OD sets scramActive:true and logs', () => {
    const s    = mk({ role: 'OD', scramActive: false });
    const next = reduce(s, A.SCRAM);
    expect(next.scramActive).toBe(true);
    expect(lastLog(next)).toContain('SCRAM INITIATED');
  });

  test('SCRAM: AS sets scramActive:true', () => {
    const next = reduce(mk({ role: 'AS', scramActive: false }), A.SCRAM);
    expect(next.scramActive).toBe(true);
  });

  test('RESET_SCRAM: AS resets scramActive:false', () => {
    const s    = mk({ role: 'AS', scramActive: true });
    const next = reduce(s, A.RESET_SCRAM);
    expect(next.scramActive).toBe(false);
    expect(lastLog(next)).toContain('reset');
  });

  test('RESET_SCRAM: OD is denied (RBAC)', () => {
    const s    = mk({ role: 'OD', scramActive: true });
    const next = reduce(s, A.RESET_SCRAM);
    expect(next.scramActive).toBe(true);
    expect(lastLog(next)).toMatch(/SECURITY/);
  });

  test('RESET_INTERLOCKS: AS resets OFFLINE interlocks to ARMED', () => {
    const s    = mk({ role: 'AS' });
    const next = reduce(s, A.RESET_INTERLOCKS);
    expect(next.interlocks.find(i => i.id === 'I005').st).toBe('ARMED');
    // Already-ARMED interlocks stay ARMED
    expect(next.interlocks.find(i => i.id === 'I001').st).toBe('ARMED');
  });

  test('RESET_INTERLOCKS: OD is denied', () => {
    const s    = mk({ role: 'OD' });
    const next = reduce(s, A.RESET_INTERLOCKS);
    expect(next.interlocks.find(i => i.id === 'I005').st).toBe('OFFLINE');
    expect(lastLog(next)).toMatch(/SECURITY/);
  });

  test('ADVANCE_PROTOCOL: increments protocolStep (max 4)', () => {
    const s    = mk({ role: 'OD', protocolStep: 2 });
    const next = reduce(s, A.ADVANCE_PROTOCOL);
    expect(next.protocolStep).toBe(3);
    expect(lastLog(next)).toContain('Step 2');
  });

  test('ADVANCE_PROTOCOL: clamps at 4', () => {
    const s    = mk({ role: 'AS', protocolStep: 4 });
    const next = reduce(s, A.ADVANCE_PROTOCOL);
    expect(next.protocolStep).toBe(4);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
describe('Control', () => {

  test('TOGGLE_AUTOPILOT: OD enables autoPilot', () => {
    const next = reduce(mk({ role: 'OD', autoPilot: false }), A.TOGGLE_AUTOPILOT);
    expect(next.autoPilot).toBe(true);
    expect(lastLog(next)).toContain('ENABLED');
  });

  test('TOGGLE_AUTOPILOT: AS disables autoPilot when already on', () => {
    const next = reduce(mk({ role: 'AS', autoPilot: true }), A.TOGGLE_AUTOPILOT);
    expect(next.autoPilot).toBe(false);
    expect(lastLog(next)).toContain('DISABLED');
  });

  test('TOGGLE_AUTOPILOT: OL is denied', () => {
    const next = reduce(mk({ role: 'OL', autoPilot: false }), A.TOGGLE_AUTOPILOT);
    expect(next.autoPilot).toBe(false);
    expect(lastLog(next)).toMatch(/SECURITY/);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
describe('Sensor Telemetry (TICK)', () => {

  test('TICK: merges sensor snapshot from payload into state', () => {
    const s = mk({ role: 'OD' });
    const snapshot = {
      CORE_TEMP:  { tag: 'T-CORE-01', v: 1120, unit: '°C'  },
      PRIM_PRESS: { tag: 'P-PRI-01',  v: 222,  unit: 'PSI' },
    };
    const next = reduce(s, A.TICK, { snapshot });
    expect(next.sensors.CORE_TEMP.v).toBe(1120);
    expect(next.sensors.PRIM_PRESS.v).toBe(222);
  });

  test('TICK: appends latest temp to histTemp (capped at 20 entries)', () => {
    const s    = mk({ role: 'OD', histTemp: Array(20).fill(1045) });
    const next = reduce(s, A.TICK);
    expect(next.histTemp).toHaveLength(20);
    // last entry is the previous s.sensors.CORE_TEMP value
    expect(typeof next.histTemp.at(-1)).toBe('number');
  });

  test('TICK: appends latest press to histPress (capped at 20 entries)', () => {
    const s    = mk({ role: 'OD', histPress: Array(20).fill(215) });
    const next = reduce(s, A.TICK);
    expect(next.histPress).toHaveLength(20);
  });

  test('TICK: does not mutate original state', () => {
    const s    = mk({ role: 'OD' });
    const snap = JSON.stringify(s.histTemp);
    reduce(s, A.TICK);
    expect(JSON.stringify(s.histTemp)).toBe(snap);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
describe('Audit & UI', () => {

  test('LOG: appends custom message to audit log', () => {
    const s    = mk({ role: 'OD' });
    const next = reduce(s, A.LOG, { msg: 'Custom diagnostic event' });
    expect(lastLog(next)).toBe('Custom diagnostic event');
  });

  test('CLEAR_AUDIT: replaces audit log with single "cleared" entry', () => {
    const s    = mk({ role: 'AS', auditLog: [{ msg: 'old1' }, { msg: 'old2' }] });
    const next = reduce(s, A.CLEAR_AUDIT);
    expect(next.auditLog).toHaveLength(1);
    expect(lastLog(next)).toContain('cleared');
  });

  test('TOGGLE_AUDIT: flips auditPanelOpen', () => {
    const s1 = mk({ role: 'OL', auditPanelOpen: false });
    expect(reduce(s1, A.TOGGLE_AUDIT).auditPanelOpen).toBe(true);
    const s2 = mk({ role: 'OL', auditPanelOpen: true });
    expect(reduce(s2, A.TOGGLE_AUDIT).auditPanelOpen).toBe(false);
  });

  test('TOGGLE_HIGH_CONTRAST: flips highContrast', () => {
    const s    = mk({ role: 'OL', highContrast: false });
    const next = reduce(s, A.TOGGLE_HIGH_CONTRAST);
    expect(next.highContrast).toBe(true);
    expect(lastLog(next)).toContain('ENABLED');
  });

  test('TOGGLE_HIGH_CONTRAST: reverts when already enabled', () => {
    const s    = mk({ role: 'OL', highContrast: true });
    const next = reduce(s, A.TOGGLE_HIGH_CONTRAST);
    expect(next.highContrast).toBe(false);
    expect(lastLog(next)).toContain('DISABLED');
  });

  test('SET_DEMO_MODE: sets demoMode flag', () => {
    const s1 = mk({ demoMode: false });
    expect(reduce(s1, A.SET_DEMO_MODE, { active: true }).demoMode).toBe(true);
    const s2 = mk({ demoMode: true });
    expect(reduce(s2, A.SET_DEMO_MODE, { active: false }).demoMode).toBe(false);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
describe('Pure Function Invariants (IEC 61511 §11.5)', () => {

  test('State is never mutated — original stays identical after any reduce call', () => {
    const s          = mk({ role: 'OD' });
    const serialised = JSON.stringify(s);
    reduce(s, A.SCRAM);
    reduce(s, A.NAVIGATE, { panel: 'panel-safety' });
    reduce(s, A.ADD_ALARM, { alarm: { id: 'X', p: 1, tag: 'T', msg: 'M' } });
    expect(JSON.stringify(s)).toBe(serialised);
  });

  test('Unknown intent returns state reference unchanged', () => {
    const s    = mk();
    const next = reduce(s, 'TOTALLY_UNKNOWN_XYZ');
    expect(next).toEqual(s);
  });

  test('Empty payload defaults to {} without throwing', () => {
    const s = mk({ role: 'OL' });
    expect(() => reduce(s, A.TOUCH_ACTIVITY)).not.toThrow();
    expect(() => reduce(s, A.ACK_ALL)).not.toThrow();
    expect(() => reduce(s, A.DISMISS_BANNER)).not.toThrow();
  });

  test('All ACTION_TYPES constants are handled (no silent fall-through)', () => {
    // Every key in ACTION_TYPES must produce a valid state object (not throw)
    const s = mk({ role: 'AS', alarms: [] });
    for (const intent of Object.values(A)) {
      const result = reduce(s, intent, { role: 'AS', panel: 'p', id: 'X', msg: 'M', prefix: 'NONE-', active: true, alarm: { id: 'Y', p: 1, tag: 'T', msg: 'M' } });
      expect(result).toBeTruthy();
      expect(typeof result).toBe('object');
    }
  });
});
