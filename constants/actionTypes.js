/**
 * CORE-SENTINEL HMI — Centralised Action Type Constants
 * ISA-101 §6.5 / IEC 61511 §11.5
 *
 * Using a frozen const object prevents:
 *  - Typos silently falling through to the reducer's default case
 *  - Magic string duplication across files
 *  - Runtime mutation of the constant table
 */
export const ACTION_TYPES = Object.freeze({
  // ── Session & Authentication ──────────────────────────────────────
  SET_ROLE:             'SET_ROLE',
  TOUCH_ACTIVITY:       'TOUCH_ACTIVITY',
  SESSION_TIMEOUT:      'SESSION_TIMEOUT',

  // ── Navigation ───────────────────────────────────────────────────
  NAVIGATE:             'NAVIGATE',

  // ── Alarm Management (ISA-101 §5) ────────────────────────────────
  ADD_ALARM:            'ADD_ALARM',
  ACK_ALL:              'ACK_ALL',
  CLEAR_ALARM:          'CLEAR_ALARM',
  DISMISS_BANNER:       'DISMISS_BANNER',
  SHELF_ALARM:          'SHELF_ALARM',
  UNSHELVE_ALARM:       'UNSHELVE_ALARM',
  CLEAR_ALARMS_BY_PREFIX: 'CLEAR_ALARMS_BY_PREFIX',

  // ── Safety-Critical (RBAC-guarded) ───────────────────────────────
  SCRAM:                'SCRAM',
  RESET_SCRAM:          'RESET_SCRAM',
  AUTO_SCRAM:           'AUTO_SCRAM',
  RESET_INTERLOCKS:     'RESET_INTERLOCKS',
  ADVANCE_PROTOCOL:     'ADVANCE_PROTOCOL',

  // ── Control ──────────────────────────────────────────────────────
  TOGGLE_AUTOPILOT:     'TOGGLE_AUTOPILOT',

  // ── Sensor & Telemetry ────────────────────────────────────────────
  TICK:                 'TICK',

  // ── Audit & UI ───────────────────────────────────────────────────
  LOG:                  'LOG',
  CLEAR_AUDIT:          'CLEAR_AUDIT',
  TOGGLE_AUDIT:         'TOGGLE_AUDIT',
  TOGGLE_HIGH_CONTRAST: 'TOGGLE_HIGH_CONTRAST',
  SET_DEMO_MODE:        'SET_DEMO_MODE',

  // ── Configuration Layer (WP 1.3 — AAS IEC 63278 / ISA-101 §5.4) ──────────
  CONFIG_UPDATE:        'CONFIG_UPDATE',
  CONFIG_ROLLBACK:      'CONFIG_ROLLBACK',
  CONFIG_IMPORT:        'CONFIG_IMPORT',
  CONFIG_RESET:         'CONFIG_RESET',
  CONFIG_TAB_CHANGE:    'CONFIG_TAB_CHANGE',
});
