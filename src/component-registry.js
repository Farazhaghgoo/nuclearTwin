'use strict';
// ╔══════════════════════════════════════════════════════════════════╗
// ║  CORE-SENTINEL — COMPONENT REGISTRY                             ║
// ║  Maps CMP-IDs → Tipologia_UI, Access Matrix, Fonte dati, Std   ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Access values:   "R"=Read-only  "U"=Update  "C"=Create  "D"=Delete  "X"=No access
// Standard codes:  TREND_STD_01, STATE_STD_01, ALARM_STD_01, PID_STD_01, etc.
// Fonte dati:      Key into DAO._s sensor map, or special streams (AUDIT, AI, SCENARIO)

const COMPONENT_REGISTRY = [

  // ─── SCREEN SCR-01: PRIMARY CIRCUIT ─────────────────────────────
  {
    id: 'CMP-01',
    label: 'Digital Twin 3D Viewport',
    screen: 'SCR-01',
    tipologia_ui: 'ThreeJSTwin',
    standard_viz: 'TWIN_STD_01',
    fonte_dati: 'CORE_TEMP,COOLANT_IN,COOLANT_OUT,PRIM_PRESS,PUMP_A,ROD_POS',
    frequenza: '800ms',
    access: { OL: 'R', OD: 'R', AS: 'R' },
    fallback: { degraded: 'STATIC_MESH', offline: 'GREY_MESH' },
    dom_id: 'three-container',
    panel: 'panel-primary',
  },
  {
    id: 'CMP-02',
    label: 'Core Thermal Trend Chart',
    screen: 'SCR-01',
    tipologia_ui: 'TrendChart',
    standard_viz: 'TREND_STD_01',
    fonte_dati: 'CORE_TEMP',
    frequenza: '800ms',
    access: { OL: 'R', OD: 'R', AS: 'R' },
    fallback: { degraded: 'DEGRADED_BADGE', offline: 'LAST_KNOWN' },
    dom_id: 'svg-temp',
    panel: 'panel-primary',
  },
  {
    id: 'CMP-03',
    label: 'Primary Pressure Trend Chart',
    screen: 'SCR-01',
    tipologia_ui: 'TrendChart',
    standard_viz: 'TREND_STD_01',
    fonte_dati: 'PRIM_PRESS',
    frequenza: '800ms',
    access: { OL: 'R', OD: 'R', AS: 'R' },
    fallback: { degraded: 'DEGRADED_BADGE', offline: 'LAST_KNOWN' },
    dom_id: 'svg-press',
    panel: 'panel-primary',
  },
  {
    id: 'CMP-04',
    label: 'HMI Coolant Inlet HUD',
    screen: 'SCR-01',
    tipologia_ui: 'HUDValue',
    standard_viz: 'STATE_STD_01',
    fonte_dati: 'COOLANT_IN',
    frequenza: '800ms',
    access: { OL: 'R', OD: 'R', AS: 'R' },
    fallback: { degraded: 'DEGRADED_BADGE', offline: '---' },
    dom_id: 'hud-inlet',
    panel: 'panel-primary',
  },
  {
    id: 'CMP-05',
    label: 'AI Copilot Sidebar',
    screen: 'SCR-01',
    tipologia_ui: 'AICopilotPanel',
    standard_viz: 'AI_STD_01',
    fonte_dati: 'AI',
    frequenza: 'event',
    access: { OL: 'R', OD: 'R/U', AS: 'R/U' },
    fallback: { degraded: 'READ_ONLY', offline: 'DISABLED' },
    dom_id: 'copilot-steps',
    panel: 'panel-primary',
  },
  {
    id: 'CMP-06',
    label: 'Thermal Margin Bar',
    screen: 'SCR-01',
    tipologia_ui: 'StatusBar',
    standard_viz: 'STATE_STD_01',
    fonte_dati: 'CORE_TEMP',
    frequenza: '800ms',
    access: { OL: 'R', OD: 'R', AS: 'R' },
    fallback: { degraded: 'DEGRADED_BADGE', offline: 'GREYED' },
    dom_id: 'margin-bar',
    panel: 'panel-primary',
  },

  // ─── SCREEN SCR-02: SECONDARY CIRCUIT ───────────────────────────
  {
    id: 'CMP-07',
    label: 'P&ID Secondary Loop Schematic',
    screen: 'SCR-02',
    tipologia_ui: 'PIDSchematic',
    standard_viz: 'PID_STD_01',
    fonte_dati: 'SG_INLET,STEAM_PRESS,TURBINE_RPM,GRID_OUT,PUMP_B,SEC_FLOW',
    frequenza: '800ms',
    access: { OL: 'R', OD: 'R', AS: 'R' },
    fallback: { degraded: 'STATIC_PID', offline: 'GREY_PID' },
    dom_id: 'pid-svg',
    panel: 'panel-secondary',
  },
  {
    id: 'CMP-08',
    label: 'Secondary Loop Parameters Table',
    screen: 'SCR-02',
    tipologia_ui: 'ParameterCards',
    standard_viz: 'STATE_STD_01',
    fonte_dati: 'SG_INLET,STEAM_PRESS,TURBINE_RPM,GRID_OUT,PUMP_B,SEC_FLOW',
    frequenza: '800ms',
    access: { OL: 'R', OD: 'R', AS: 'R' },
    fallback: { degraded: 'DEGRADED_BADGE', offline: 'LAST_KNOWN' },
    dom_id: 'sec-stats',
    panel: 'panel-secondary',
  },

  // ─── SCREEN SCR-03: SAFETY SYSTEMS ──────────────────────────────
  {
    id: 'CMP-09',
    label: 'SCRAM Control Button',
    screen: 'SCR-03',
    tipologia_ui: 'ActuatorControl',
    standard_viz: 'ACTION_STD_01',
    fonte_dati: 'SCRAM_V',
    frequenza: 'event',
    access: { OL: 'X', OD: 'R/U', AS: 'R/U' },
    fallback: { degraded: 'READ_ONLY', offline: 'DISABLED' },
    dom_id: 'btn-scram',
    panel: 'panel-safety',
  },
  {
    id: 'CMP-10',
    label: 'Control Rod Position Table',
    screen: 'SCR-03',
    tipologia_ui: 'RodPositionTable',
    standard_viz: 'STATE_STD_01',
    fonte_dati: 'ROD_POS',
    frequenza: '800ms',
    access: { OL: 'R', OD: 'R', AS: 'R' },
    fallback: { degraded: 'DEGRADED_BADGE', offline: 'LAST_KNOWN' },
    dom_id: 'rod-table',
    panel: 'panel-safety',
  },
  {
    id: 'CMP-11',
    label: 'Protection Interlocks Table',
    screen: 'SCR-03',
    tipologia_ui: 'InterlockTable',
    standard_viz: 'ALARM_STD_01',
    fonte_dati: 'SCRAM_V,CORE_TEMP,PRIM_PRESS,NEUTRON_FLUX',
    frequenza: '800ms',
    access: { OL: 'R', OD: 'R', AS: 'R/U' },
    fallback: { degraded: 'DEGRADED_BADGE', offline: 'READ_ONLY' },
    dom_id: 'interlock-table',
    panel: 'panel-safety',
  },
  {
    id: 'CMP-12',
    label: 'Emergency Depressurize Control',
    screen: 'SCR-03',
    tipologia_ui: 'ActuatorControl',
    standard_viz: 'ACTION_STD_01',
    fonte_dati: 'PRIM_PRESS',
    frequenza: 'event',
    access: { OL: 'X', OD: 'R/U', AS: 'C/R/U/D' },
    fallback: { degraded: 'READ_ONLY', offline: 'DISABLED' },
    dom_id: 'btn-depressurize',
    panel: 'panel-safety',
  },
  {
    id: 'CMP-13',
    label: 'Reset Interlocks Control',
    screen: 'SCR-03',
    tipologia_ui: 'ActuatorControl',
    standard_viz: 'ACTION_STD_01',
    fonte_dati: 'SCRAM_V',
    frequenza: 'event',
    access: { OL: 'X', OD: 'X', AS: 'C/R/U/D' },
    fallback: { degraded: 'DISABLED', offline: 'DISABLED' },
    dom_id: 'btn-reset-locks',
    panel: 'panel-safety',
  },

  // ─── SCREEN SCR-04: AI COPILOT FULL ─────────────────────────────
  {
    id: 'CMP-14',
    label: 'AI Analysis Feed',
    screen: 'SCR-04',
    tipologia_ui: 'AIFeed',
    standard_viz: 'AI_STD_01',
    fonte_dati: 'AI',
    frequenza: 'event',
    access: { OL: 'R', OD: 'R/U', AS: 'R/U' },
    fallback: { degraded: 'READ_ONLY', offline: 'DISABLED' },
    dom_id: 'ai-feed',
    panel: 'panel-ai',
  },
  {
    id: 'CMP-15',
    label: 'Anomaly List',
    screen: 'SCR-04',
    tipologia_ui: 'AnomalyList',
    standard_viz: 'ALARM_STD_01',
    fonte_dati: 'ALARMS',
    frequenza: '800ms',
    access: { OL: 'R', OD: 'R', AS: 'R' },
    fallback: { degraded: 'DEGRADED_BADGE', offline: 'LAST_KNOWN' },
    dom_id: 'anomaly-list',
    panel: 'panel-ai',
  },
  {
    id: 'CMP-16',
    label: 'AI Predictions Panel',
    screen: 'SCR-04',
    tipologia_ui: 'PredictionPanel',
    standard_viz: 'TREND_STD_01',
    fonte_dati: 'CORE_TEMP,PRIM_PRESS,NEUTRON_FLUX,GRID_OUT',
    frequenza: '800ms',
    access: { OL: 'R', OD: 'R', AS: 'R' },
    fallback: { degraded: 'DEGRADED_BADGE', offline: 'DISABLED' },
    dom_id: 'ai-predictions',
    panel: 'panel-ai',
  },
  {
    id: 'CMP-17',
    label: 'Auto-Pilot Enable Toggle',
    screen: 'SCR-04',
    tipologia_ui: 'ToggleControl',
    standard_viz: 'ACTION_STD_01',
    fonte_dati: 'AI',
    frequenza: 'event',
    access: { OL: 'X', OD: 'R/U', AS: 'C/R/U/D' },
    fallback: { degraded: 'DISABLED', offline: 'DISABLED' },
    dom_id: 'btn-auto-pilot',
    panel: 'panel-ai',
  },

  // ─── SCREEN SCR-05: SYSTEM DIAGNOSTICS ──────────────────────────
  {
    id: 'CMP-18',
    label: 'Full Sensor Diagnostics Table',
    screen: 'SCR-05',
    tipologia_ui: 'SensorTable',
    standard_viz: 'TABLE_STD_01',
    fonte_dati: 'ALL_SENSORS',
    frequenza: '500ms',
    access: { OL: 'R', OD: 'R', AS: 'R' },
    fallback: { degraded: 'DEGRADED_BADGE', offline: 'LAST_KNOWN' },
    dom_id: 'sensor-tbody',
    panel: 'panel-diagnostics',
  },
  {
    id: 'CMP-19',
    label: 'Diagnostic Export Control',
    screen: 'SCR-05',
    tipologia_ui: 'ExportControl',
    standard_viz: 'ACTION_STD_01',
    fonte_dati: 'ALL_SENSORS',
    frequenza: 'event',
    access: { OL: 'X', OD: 'R/U', AS: 'C/R/U/D' },
    fallback: { degraded: 'DISABLED', offline: 'DISABLED' },
    dom_id: 'btn-diag-export',
    panel: 'panel-diagnostics',
  },

  // ─── SYSTEM-WIDE COMPONENTS ──────────────────────────────────────
  {
    id: 'CMP-20',
    label: 'Alarm Banner',
    screen: 'ALL',
    tipologia_ui: 'AlarmBanner',
    standard_viz: 'ALARM_STD_01',
    fonte_dati: 'ALARMS',
    frequenza: 'event',
    access: { OL: 'R', OD: 'R/U', AS: 'C/R/U/D' },
    fallback: { degraded: 'READ_ONLY', offline: 'READ_ONLY' },
    dom_id: 'alarm-banner',
    panel: 'ALL',
  },
  {
    id: 'CMP-21',
    label: 'Audit Trail Panel',
    screen: 'ALL',
    tipologia_ui: 'AuditPanel',
    standard_viz: 'TABLE_STD_01',
    fonte_dati: 'AUDIT',
    frequenza: 'event',
    access: { OL: 'R', OD: 'R', AS: 'C/R/U/D' },
    fallback: { degraded: 'READ_ONLY', offline: 'DISABLED' },
    dom_id: 'audit-panel',
    panel: 'ALL',
  },
  {
    id: 'CMP-22',
    label: 'Emergency Scenario Simulator',
    screen: 'ALL',
    tipologia_ui: 'ScenarioControl',
    standard_viz: 'ACTION_STD_01',
    fonte_dati: 'SCENARIO',
    frequenza: 'event',
    access: { OL: 'X', OD: 'R/U', AS: 'C/R/U/D' },
    fallback: { degraded: 'DISABLED', offline: 'DISABLED' },
    dom_id: 'btn-demo',
    panel: 'ALL',
  },
  {
    id: 'CMP-23',
    label: 'Cybersecurity Status Panel',
    screen: 'ALL',
    tipologia_ui: 'CyberSecPanel',
    standard_viz: 'STATE_STD_01',
    fonte_dati: 'SYSTEM',
    frequenza: 'event',
    access: { OL: 'X', OD: 'X', AS: 'R/U' },
    fallback: { degraded: 'DISABLED', offline: 'DISABLED' },
    dom_id: 'cyber-panel',
    panel: 'ALL',
  },
  {
    id: 'CMP-24',
    label: 'Platform Configuration Manager',
    screen: 'SCR-14',
    tipologia_ui: 'ConfigPanel',
    standard_viz: 'ACTION_STD_01',
    fonte_dati: 'CONFIG',
    frequenza: 'event',
    // WP 1.3: OL=no access, OD=read-only (can view), AS=full CRUD
    access: { OL: 'X', OD: 'R', AS: 'C/R/U/D' },
    fallback: { degraded: 'DISABLED', offline: 'DISABLED' },
    dom_id: 'panel-config',
    panel: 'panel-config',
    description: 'No-code graphical configuration — sensors, streams, taxonomy, versioning. AAS IEC 63278 / ISA-101 §5.4',
  },
];

// ═════════════════════════════════════════════════════════════════════
// DESIGN TOKEN MAP — maps Standard_viz codes → ISA-101 styling tokens
// ═════════════════════════════════════════════════════════════════════
const DESIGN_TOKENS = {

  // Trend chart standard: light bg, muted stroke, red trip line, dashed prediction
  TREND_STD_01: {
    bg:         '#f4f6f8',
    border:     'rgba(0,0,0,.06)',
    line_rt:    '#212529',      // real-time: ISA-101 dark grey
    line_pred:  '#343a40',      // prediction: muted dark dashed
    line_trip:  '#e31a1a',      // trip setpoint: ISA-101 Priority 1 red
    stroke_w_rt:    1.8,
    stroke_w_pred:  1.3,
    text_label: '#6c757d',
    text_value: '#212529',
  },

  // State / KPI card standard
  STATE_STD_01: {
    bg:           '#f4f6f8',
    border:       'rgba(0,0,0,.06)',
    border_alarm: 'rgba(227,26,26,.3)',
    bg_alarm:     'rgba(227,26,26,.06)',
    text_label:   '#6c757d',
    text_value:   '#212529',
    text_alarm:   '#e31a1a',
    text_warn:    '#d97d06',
    text_nominal: '#212529',
    bar_nominal:  '#159647',
    bar_warn:     '#d97d06',
    bar_alarm:    '#e31a1a',
  },

  // Alarm list / banner standard: ISA-101 reserved alarm colours
  ALARM_STD_01: {
    p1_color:   '#e31a1a',   // Priority 1 — Critical (red)
    p1_bg:      '#fcdcdc',
    p2_color:   '#d97d06',   // Priority 2 — High (yellow/orange)
    p2_bg:      '#fcecd5',
    p3_color:   '#cd5c08',   // Priority 3 — Medium (orange)
    p3_bg:      '#fce3d5',
    acked_color:'#adb5bd',   // Acknowledged: greyed
    text_label: '#6c757d',
    text_msg:   '#212529',
  },

  // P&ID schematic standard
  PID_STD_01: {
    pipe_cold:    '#343a40',    // cold leg pipes
    pipe_hot:     '#cd5c08',    // hot leg pipes (orange)
    pipe_steam:   '#cd5c08',    // steam lines dashed
    box_fill:     '#ced4da',
    box_stroke:   '#495057',
    text_label:   '#343a40',
    text_value:   '#6c757d',
    label_hot:    '#cd5c08',
    label_cold:   '#343a40',
  },

  // Action / actuator button standard
  ACTION_STD_01: {
    scram_bg:     '#e31a1a',     // SCRAM button
    scram_border: '#e31a1a',
    warn_border:  '#d97d06',
    warn_text:    '#d97d06',
    neutral_bg:   '#d1d6dc',
    neutral_border:'rgba(0,0,0,.1)',
    neutral_text: '#343a40',
    disabled_opacity: 0.25,
    locked_color: '#6c757d',
  },

  // AI feed / prediction standard
  AI_STD_01: {
    bg_panel:     '#e2e6ea',
    border_normal:'#495057',
    border_warn:  '#d97d06',
    border_crit:  '#e31a1a',
    text_ts:      '#6c757d',
    text_msg:     '#212529',
    icon_color:   '#343a40',
    active_dot:   '#159647',
  },

  // Data table standard
  TABLE_STD_01: {
    bg_header:    '#d1d6dc',
    bg_row_even:  'transparent',
    bg_row_alarm: 'rgba(227,26,26,.05)',
    bg_row_warn:  'rgba(217,125,6,.04)',
    border_row:   'rgba(0,0,0,.04)',
    text_header:  '#6c757d',
    text_tag:     '#212529',
    text_meta:    '#6c757d',
    status_nominal:'#159647',
    status_warn:   '#d97d06',
    status_alarm:  '#e31a1a',
  },

  // Digital twin 3D viewport standard
  TWIN_STD_01: {
    bg_container:     '#f4f6f8',
    hud_bg:           'rgba(226,230,234,.85)',
    hud_border:       'rgba(0,0,0,.1)',
    emergency_glow:   'rgba(227,26,26,.12)',
    wire_nominal:     0x495057,
    wire_danger:      0xe31a1a,
    text_value:       '#212529',
    text_unit:        '#6c757d',
  },
};

// ═════════════════════════════════════════════════════════════════════
// ACCESS CONTROL HELPERS
// ═════════════════════════════════════════════════════════════════════

/**
 * Parse an access string like "R/U" → Set{'R','U'}
 */
function parseAccess(accessStr) {
  if (!accessStr || accessStr === 'X') return new Set();
  return new Set(accessStr.split('/'));
}

/**
 * Check if a role can perform an action on a component
 * @param {string} role  - 'OL', 'OD', 'AS'
 * @param {object} cmp   - component registry entry
 * @param {string} action - 'R','U','C','D'
 * @returns {boolean}
 */
function canAccess(role, cmp, action = 'R') {
  if (!role || !cmp) return false;
  const accessStr = cmp.access[role];
  if (!accessStr || accessStr === 'X') return false;
  return parseAccess(accessStr).has(action);
}

/**
 * Get all visible components for a given role and panel
 * Returns only components where the role has at least 'R' access
 */
function getVisibleComponents(role, panel = 'ALL') {
  return COMPONENT_REGISTRY.filter(cmp => {
    const panelMatch = panel === 'ALL' || cmp.panel === panel || cmp.panel === 'ALL';
    return panelMatch && canAccess(role, cmp, 'R');
  });
}

/**
 * Get component config by ID
 */
function getComponent(id) {
  return COMPONENT_REGISTRY.find(c => c.id === id);
}

export {
  COMPONENT_REGISTRY,
  DESIGN_TOKENS,
  canAccess,
  getVisibleComponents,
  getComponent,
  parseAccess
};
