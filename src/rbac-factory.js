'use strict';
// ╔══════════════════════════════════════════════════════════════════╗
// ║  CORE-SENTINEL — COMPONENT FACTORY (RBAC + Design Tokens)      ║
// ║  Reads COMPONENT_REGISTRY, applies role access matrix,          ║
// ║  renders ISA-101 standard shells, and enforces fallback logic   ║
// ╚══════════════════════════════════════════════════════════════════╝

import {
  COMPONENT_REGISTRY,
  DESIGN_TOKENS,
  canAccess,
  getComponent,
  parseAccess
} from './component-registry.js';

// ─────────────────────────────────────────────────────────────────────
// SECTION 1: ISA-101 STANDARD VISUALIZATION SHELLS
// Each function returns an HTMLElement styled to the given token set
// ─────────────────────────────────────────────────────────────────────

/**
 * TREND_STD_01 — Predictive telemetry chart shell
 * Wraps an SVG canvas with ISA-101 muted palette and trip line
 */
const VizShells = {

  /**
   * Render a DEGRADED badge overlay on a parent element.
   * ISA-101 §6.3: degraded data MUST be visually distinct.
   */
  degradedBadge(parentEl, tokens) {
    if (!parentEl) return;
    // Remove existing badge if any
    parentEl.querySelectorAll('.isa-degraded-badge').forEach(el => el.remove());
    const badge = document.createElement('div');
    badge.className = 'isa-degraded-badge';
    badge.style.cssText = `
      position:absolute; top:4px; right:4px; padding:2px 6px;
      background:${tokens?.p2_bg || '#161300'};
      border:1px solid ${tokens?.p2_color || '#ffd020'}55;
      color:${tokens?.p2_color || '#ffd020'};
      font-family:'Courier New',monospace; font-size:9px;
      font-weight:700; text-transform:uppercase; letter-spacing:.1em;
      pointer-events:none; z-index:20;
    `;
    badge.textContent = 'DEGRADED';
    parentEl.style.position = 'relative';
    parentEl.appendChild(badge);
  },

  /**
   * Render a NO ACCESS lock overlay on a element.
   * ISA-101: hidden elements must not render at all (factory returns null),
   * but for Interactive actuators with 'X' access we render a lock state.
   */
  lockedOverlay(el, cmpLabel, tokens) {
    if (!el) return;
    el.setAttribute('disabled', 'true');
    el.style.opacity = String(tokens?.disabled_opacity || 0.25);
    el.style.cursor  = 'not-allowed';
    el.title         = `ACCESS DENIED — ${cmpLabel}`;
    el.setAttribute('data-rbac-locked', 'true');
  },

  /**
   * Restore a previously locked element
   */
  unlockElement(el) {
    if (!el) return;
    el.removeAttribute('disabled');
    el.style.opacity = '';
    el.style.cursor  = '';
    el.title         = '';
    el.removeAttribute('data-rbac-locked');
    el.querySelectorAll('.isa-degraded-badge').forEach(b => b.remove());
  },

  /**
   * STATE_STD_01 — KPI value card shell
   * Returns a newly built card div (used for dynamic renders)
   */
  stateCard({ label, value, unit, status, tag, tokens }) {
    const tk   = tokens || DESIGN_TOKENS.STATE_STD_01;
    const color = status === 'alarm'   ? tk.text_alarm
                : status === 'warning' ? tk.text_warn
                : status === 'low'     ? '#ff8020'
                :                        tk.text_nominal;
    const bg     = status === 'alarm' ? tk.bg_alarm : tk.bg;
    const border = status === 'alarm' ? tk.border_alarm : tk.border;

    const card = document.createElement('div');
    card.style.cssText = `
      background:${bg}; border:1px solid ${border};
      padding:12px; margin-bottom:8px; position:relative;
    `;
    card.innerHTML = `
      <div style="font-family:'Courier New',monospace;font-size:9px;
                  color:${tk.text_label};text-transform:uppercase;
                  letter-spacing:.12em;font-weight:700;margin-bottom:4px;"
      >${label}${tag ? ` <span style="color:#3a4050;font-size:8px;">[${tag}]</span>` : ''}</div>
      <div style="font-family:'Courier New',monospace;font-size:20px;
                  font-weight:700;color:${color};">
        ${value} <span style="font-size:11px;font-weight:400;color:${tk.text_label};">${unit}</span>
      </div>
    `;
    return card;
  },

  /**
   * ALARM_STD_01 — alarm item shell (ISA-101 reserved colours P1/P2/P3)
   */
  alarmItem(alarm) {
    const tk  = DESIGN_TOKENS.ALARM_STD_01;
    const col = alarm.p === 1 ? tk.p1_color : alarm.p === 2 ? tk.p2_color : tk.p3_color;
    const bg  = alarm.p === 1 ? tk.p1_bg    : alarm.p === 2 ? tk.p2_bg    : tk.p3_bg;
    const div = document.createElement('div');
    div.style.cssText = `
      padding:10px 12px; border-left:4px solid ${col};
      border:1px solid ${col}33; border-left:4px solid ${col};
      background:${bg}09; margin-bottom:8px;
    `;
    div.innerHTML = `
      <div style="font-family:'Courier New',monospace;font-size:9px;
                  font-weight:700;color:${col};text-transform:uppercase;">
        P${alarm.p} — ${alarm.tag}</div>
      <div style="font-family:'Courier New',monospace;font-size:10px;
                  color:${tk.text_msg};margin-top:2px;">${alarm.msg}</div>
      <div style="font-family:'Courier New',monospace;font-size:9px;
                  color:${tk.text_label};margin-top:3px;">${alarm.ts}</div>
    `;
    return div;
  },
};

// ─────────────────────────────────────────────────────────────────────
// SECTION 2:  COMPONENT FACTORY
// The central HOC/factory. Given a role and a component ID,
// it enforces the access matrix and returns the correct render mode.
// ─────────────────────────────────────────────────────────────────────

const ComponentFactory = {

  /**
   * Apply RBAC enforcement to a single component.
   *
   * Render modes:
   *   'hidden'    — role has 'X' access on a READ. Component must not appear.
   *   'locked'    — role has 'X' on an actuator type. Renders disabled.
   *   'read_only' — role has 'R' only. Actuators are disabled.
   *   'full'      — role has 'U'/'C'/'D'. Full interactivity.
   *   'degraded'  — data stream is degraded (applied separately via applyDegradedState)
   *
   * @param {string} role   - current user role ('OL','OD','AS')
   * @param {string} cmpId  - registry ID (e.g. 'CMP-09')
   * @returns {'hidden'|'locked'|'read_only'|'full'} renderMode
   */
  getRenderMode(role, cmpId) {
    const cmp = getComponent(cmpId);
    if (!cmp) return 'hidden';

    const accessStr = cmp.access[role];
    if (!accessStr || accessStr === 'X') {
      // Actuators get locked overlay; non-actuators get completely hidden
      return cmp.tipologia_ui === 'ActuatorControl' ||
             cmp.tipologia_ui === 'ToggleControl' ||
             cmp.tipologia_ui === 'ExportControl'
        ? 'locked'
        : 'hidden';
    }

    const perms = parseAccess(accessStr);
    if (perms.has('U') || perms.has('C') || perms.has('D')) return 'full';
    return 'read_only';
  },

  /**
   * Apply the render mode to a DOM element by its component ID.
   * Call this after every role change.
   *
   * @param {string} role
   * @param {string} cmpId
   */
  applyToDOM(role, cmpId) {
    const cmp = getComponent(cmpId);
    if (!cmp || !cmp.dom_id) return;

    const el = document.getElementById(cmp.dom_id);
    if (!el) return;

    const mode = this.getRenderMode(role, cmpId);
    const tokens = DESIGN_TOKENS[cmp.standard_viz] || {};

    // Clean previous RBAC state
    VizShells.unlockElement(el);

    switch (mode) {
      case 'hidden':
        el.style.display = 'none';
        break;

      case 'locked':
        el.style.display = '';
        VizShells.lockedOverlay(el, cmp.label, tokens);
        break;

      case 'read_only':
        el.style.display = '';
        el.style.opacity = '';
        // For actuator types in read_only: disable but show
        if (cmp.tipologia_ui === 'ActuatorControl' ||
            cmp.tipologia_ui === 'ToggleControl'   ||
            cmp.tipologia_ui === 'ExportControl') {
          el.setAttribute('disabled', 'true');
          el.style.opacity = '0.5';
          el.style.cursor = 'not-allowed';
          el.title = `READ ONLY — ${cmp.label}`;
        }
        break;

      case 'full':
        el.style.display = '';
        el.style.opacity = '';
        el.removeAttribute('disabled');
        el.style.cursor = '';
        el.title = '';
        break;
    }
  },

  /**
   * Apply RBAC enforcement to all components in the registry for a given role.
   * Call this once on role selection and on panel navigation.
   *
   * @param {string} role
   */
  applyAll(role) {
    COMPONENT_REGISTRY.forEach(cmp => this.applyToDOM(role, cmp.id));

    // Special case: CMP-23 Cybersecurity Panel — build the panel if AS
    this._renderCyberPanel(role);

    // Log to console (dev aid)
    const visible = COMPONENT_REGISTRY.filter(c => {
      const m = this.getRenderMode(role, c.id);
      return m !== 'hidden';
    }).length;
    console.info(
      `[RBAC] Role: ${role} | Visible: ${visible}/${COMPONENT_REGISTRY.length} components`
    );
  },

  /**
   * Apply degraded data state to a component (ISA-101 §6.3).
   * Called by the data loop when a sensor value is stale/invalid.
   *
   * @param {string} cmpId
   * @param {boolean} isDegraded
   */
  applyDegradedState(cmpId, isDegraded) {
    const cmp = getComponent(cmpId);
    if (!cmp) return;
    const el = document.getElementById(cmp.dom_id);
    if (!el) return;

    const tokens = DESIGN_TOKENS[cmp.standard_viz] || DESIGN_TOKENS.ALARM_STD_01;
    if (isDegraded) {
      VizShells.degradedBadge(el, tokens);
    } else {
      el.querySelectorAll('.isa-degraded-badge').forEach(b => b.remove());
    }
  },

  /**
   * CMP-23: Cybersecurity panel — only rendered for AS role.
   * Uses ISA-101 STATE_STD_01 tokens.
   * Injected into the header area as a small overlay indicator.
   */
  _renderCyberPanel(role) {
    const CYBER_ID = 'cyber-panel';
    let panel = document.getElementById(CYBER_ID);

    if (role !== 'AS') {
      if (panel) panel.style.display = 'none';
      return;
    }

    // Build panel if not yet created
    if (!panel) {
      panel = document.createElement('div');
      panel.id = CYBER_ID;
      const footer = document.querySelector('footer');
      if (footer) footer.insertBefore(panel, footer.firstChild);
    }

    panel.style.display = '';
    const tk = DESIGN_TOKENS.STATE_STD_01;
    panel.style.cssText = `
      display:flex; align-items:center; gap:10px;
      font-family:'Courier New',monospace; font-size:9px;
      text-transform:uppercase; letter-spacing:.1em;
    `;
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:5px;padding:0 12px;
                  border-right:1px solid rgba(255,255,255,.08);">
        <span style="font-family:'Material Symbols Outlined';font-size:13px;
                     color:#5a6573;">shield</span>
        <span style="color:#4a5260;">CYBERSEC:</span>
        <span style="color:#20c060;font-weight:700;">AES-512 · TLS 1.3 · ACTIVE</span>
      </div>
      <div style="display:flex;align-items:center;gap:5px;padding:0 12px;
                  border-right:1px solid rgba(255,255,255,.08);">
        <span style="color:#4a5260;">NODES:</span>
        <span style="color:#e0e4e8;font-weight:700;">7/7 ONLINE</span>
      </div>
      <div style="display:flex;align-items:center;gap:5px;padding:0 12px;">
        <span style="color:#4a5260;">INTRUSION:</span>
        <span style="color:#20c060;font-weight:700;">NONE DETECTED</span>
      </div>
    `;
  },
};

// ─────────────────────────────────────────────────────────────────────
// SECTION 3: RBAC CONTEXT (global state holder)
// Single source of truth for the current authenticated role.
// ─────────────────────────────────────────────────────────────────────

const RBACContext = {
  _role: null,
  _listeners: [],

  get role() { return this._role; },

  /**
   * Set the active role and propagate RBAC enforcement to all components.
   * Also dispatches to all registered listeners.
   */
  setRole(role) {
    if (!['OL', 'OD', 'AS'].includes(role)) {
      console.error(`[RBAC] Invalid role: ${role}`);
      return;
    }
    this._role = role;
    ComponentFactory.applyAll(role);
    this._listeners.forEach(fn => fn(role));
    console.info(`[RBAC] Context set — Role: ${role}`);
  },

  /**
   * Register a callback to be called when the role changes.
   */
  onChange(fn) {
    this._listeners.push(fn);
  },

  /**
   * Check if the current role can perform an action on a component.
   * Convenience wrapper around canAccess().
   */
  can(cmpId, action = 'R') {
    return canAccess(this._role, getComponent(cmpId), action);
  },

  /**
   * Clear role (on logout)
   */
  clear() {
    this._role = null;
    this._listeners.forEach(fn => fn(null));
  },
};

// ─────────────────────────────────────────────────────────────────────
// SECTION 4: RBAC-AWARE ACCESS GUARD FUNCTIONS
// Higher-order wrappers for event handlers — enforce RBAC at call-site
// ─────────────────────────────────────────────────────────────────────

/**
 * Wrap a button's click handler with an RBAC permission check.
 * If the role fails the check, shows an Access Denied modal instead.
 *
 * Usage:
 *   guardedClick('CMP-09', 'U', () => dispatch('SCRAM'));
 *
 * @param {string}   cmpId    - Component ID from registry
 * @param {string}   action   - Required permission ('R','U','C','D')
 * @param {Function} handler  - Original click handler
 * @param {Function} showModal - showModal function from script.js
 */
function guardedClick(cmpId, action, handler, showModalFn) {
  return function(event) {
    const role = RBACContext.role;
    if (!canAccess(role, getComponent(cmpId), action)) {
      const cmp = getComponent(cmpId);
      showModalFn({
        icon: 'lock',
        title: 'Access Denied',
        content: `
          <div style="font-family:'Courier New',monospace;">
            <div style="color:#ff2020;font-weight:700;font-size:13px;margin-bottom:8px;">
              PERMISSION DENIED
            </div>
            <div style="color:#7a8590;font-size:11px;margin-bottom:12px;">
              Component <strong style="color:#e0e4e8;">${cmp?.id || cmpId}</strong> —
              ${cmp?.label || ''}<br/>
              Required permission: <strong style="color:#ffd020;">${action}</strong> |
              Your role: <strong style="color:#e0e4e8;">${role}</strong>
            </div>
            <div style="border:1px solid rgba(255,255,255,.08);padding:8px;font-size:10px;color:#4a5260;">
              Access matrix: OL=${cmp?.access?.OL || 'X'} · OD=${cmp?.access?.OD || 'X'} · AS=${cmp?.access?.AS || 'X'}
            </div>
          </div>`,
      });
      return;
    }
    handler(event);
  };
}

/**
 * Apply guardedClick to a DOM element, replacing any previous listener.
 * Stores the unguarded handler as data attribute key for re-application on role change.
 */
function bindGuardedButton(elementId, cmpId, action, handler, showModalFn) {
  const el = document.getElementById(elementId);
  if (!el) return;
  // Clone to remove old listeners
  const clone = el.cloneNode(true);
  el.parentNode?.replaceChild(clone, el);
  clone.addEventListener('click', guardedClick(cmpId, action, handler, showModalFn));
}

// ─────────────────────────────────────────────────────────────────────
// SECTION 5: ROLE PERMISSION SUMMARY RENDERER
// Generates a per-role capabilities summary for the role selector overlay
// ─────────────────────────────────────────────────────────────────────

/**
 * Returns an HTML string summarising what a role can and cannot access.
 * Injected into the role selection overlay as a quick reference.
 *
 * @param {string} role  - 'OL', 'OD', 'AS'
 * @returns {string} HTML
 */
function renderRoleSummary(role) {
  const screens = ['SCR-01','SCR-02','SCR-03','SCR-04','SCR-05','ALL'];
  const rows = COMPONENT_REGISTRY.map(cmp => {
    const perms = cmp.access[role] || 'X';
    const color = perms === 'X' ? '#3a4050' : '#7a8590';
    return `<div style="display:flex;justify-content:space-between;
                         font-family:'Courier New',monospace;font-size:9px;
                         padding:2px 0;border-bottom:1px solid rgba(255,255,255,.04);">
      <span style="color:${color};">${cmp.id} — ${cmp.label}</span>
      <span style="color:${perms === 'X' ? '#3a4050' : '#20c060'};
                   font-weight:700;min-width:60px;text-align:right;">${perms}</span>
    </div>`;
  }).join('');

  const total   = COMPONENT_REGISTRY.length;
  const had_access = COMPONENT_REGISTRY.filter(c => (c.access[role] || 'X') !== 'X').length;

  return `
    <div style="font-family:'Courier New',monospace;">
      <div style="color:#4a5260;font-size:9px;text-transform:uppercase;
                  letter-spacing:.12em;margin-bottom:8px;">
        Component Permissions — Role: ${role} · ${had_access}/${total} accessible
      </div>
      <div style="max-height:260px;overflow-y:auto;">${rows}</div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────
// SECTION 6: EXPORT TO GLOBAL SCOPE
// ─────────────────────────────────────────────────────────────────────

export {
  ComponentFactory,
  RBACContext,
  VizShells,
  guardedClick,
  bindGuardedButton,
  renderRoleSummary
};
