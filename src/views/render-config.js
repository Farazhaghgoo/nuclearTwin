/**
 * CORE-SENTINEL HMI — SCR-14 Platform Configuration Manager (CMP-24)
 * WP 1.3 — Graphical No-Code Configuration Interface
 * ISA-101.01 §5.4 / AAS IEC 63278 / IEC 62443 Audit Trail
 *
 * Renders the full 6-tab configuration panel for System Admin (AS) role.
 * All changes emit live updates via ConfigService → dao:config:updated CustomEvent.
 */

import { ConfigService } from '../config-service.js';
import { escHtml, dlFile } from '../../utils.js';
import { dispatch } from '../reducer.js';
import { ACTION_TYPES as A } from '../../constants/actionTypes.js';

// ── Priority labels ───────────────────────────────────────────────────────────
const P_LABEL = { 1: 'P1 — Critical', 2: 'P2 — Urgent', 3: 'P3 — High' };
const P_COLOR = { 1: '#e31a1a', 2: '#d97d06', 3: '#cd5c08' };
const SYS_COLOR = {
  Primary:   '#212529',
  Secondary: '#495057',
  Safety:    '#e31a1a',
  Grid:      '#159647',
};

// ── Pending changes buffer (local, not persisted until "Save as Version") ─────
const _pending = {}; // { [sensorKey]: { field: newValue, ... } }
let _pendingCount = 0;

function _clearPending() {
  Object.keys(_pending).forEach(k => delete _pending[k]);
  _pendingCount = 0;
}

function _setPending(sensorKey, field, value) {
  if (!_pending[sensorKey]) _pending[sensorKey] = {};
  _pending[sensorKey][field] = value;
  _pendingCount = Object.keys(_pending).reduce((t, k) => t + Object.keys(_pending[k]).length, 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main render entry point — called from render.js when activePanel === 'panel-config'
// ═══════════════════════════════════════════════════════════════════════════════
export function renderConfigPanel(s) {
  if (s.activePanel !== 'panel-config') return;

  const container = document.getElementById('panel-config');
  if (!container) return;

  // RBAC guard — SCR-14 is AS-only
  if (s.role !== 'AS') {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full gap-4">
        <span class="ms material-symbols-outlined text-[#e31a1a] text-5xl">lock</span>
        <div class="tv text-[13px] text-[#e31a1a] font-bold uppercase tracking-widest">Access Denied — CMP-24</div>
        <div class="tv text-[11px] text-[#6c757d]">System Admin (AS) role required to access Platform Configuration Manager.</div>
      </div>`;
    return;
  }

  const activeTab = s.configActiveTab ?? 'overview';
  const meta = ConfigService.getMeta();

  container.innerHTML = `
    <!-- ── SCR-14 Header ───────────────────────────────────────────────── -->
    <div class="flex-shrink-0 flex items-center justify-between px-5 py-2.5 border-b border-[rgba(0,0,0,.08)] bg-[#e2e6ea]">
      <div class="flex items-center gap-3">
        <span class="ms material-symbols-outlined text-[#343a40] text-[18px]">tune</span>
        <div>
          <div class="tv font-bold text-[11px] tracking-widest uppercase text-[#212529]">Platform Configuration Manager — SCR-14</div>
          <div class="tv text-[11px] text-[#6c757d]">
            AAS IEC 63278 · Config ${escHtml(meta.configVersion)} ·
            ${escHtml(meta.versionCount)} versions ·
            Last: <span class="text-[#343a40]">${escHtml(meta.lastModifiedBy)}</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button id="cfg-btn-export"
          class="flex items-center gap-1.5 px-3 py-1.5 border border-[rgba(0,0,0,.08)] tv text-[11px] text-[#343a40] font-bold uppercase tracking-wider hover:bg-[#d1d6dc] transition-colors">
          <span class="ms material-symbols-outlined text-[14px]">download</span> Export
        </button>
        <label id="cfg-lbl-import"
          class="flex items-center gap-1.5 px-3 py-1.5 border border-[rgba(0,0,0,.08)] tv text-[11px] text-[#343a40] font-bold uppercase tracking-wider hover:bg-[#d1d6dc] transition-colors cursor-pointer">
          <span class="ms material-symbols-outlined text-[14px]">upload</span> Import
          <input type="file" id="cfg-file-input" accept=".json" class="hidden"/>
        </label>
        <button id="cfg-btn-reset"
          class="flex items-center gap-1.5 px-3 py-1.5 border border-[rgba(227,26,26,.3)] tv text-[11px] text-[#e31a1a] font-bold uppercase tracking-wider hover:bg-[rgba(227,26,26,.05)] transition-colors">
          <span class="ms material-symbols-outlined text-[14px]">restore</span> Reset
        </button>
      </div>
    </div>

    <!-- ── Tab Bar ────────────────────────────────────────────────────── -->
    <div class="flex-shrink-0 flex border-b border-[rgba(0,0,0,.08)] bg-[#e2e6ea]">
      ${_renderTabBtn('overview',  'info',         'Overview',   activeTab)}
      ${_renderTabBtn('taxonomy',  'account_tree', 'Taxonomy',   activeTab)}
      ${_renderTabBtn('devices',   'sensors',      'Devices',    activeTab)}
      ${_renderTabBtn('measures',  'straighten',   'Measures',   activeTab)}
      ${_renderTabBtn('streams',   'stream',       'Streams',    activeTab)}
      ${_renderTabBtn('versions',  'history',      'Versions',   activeTab)}
    </div>

    <!-- ── Tab Content ───────────────────────────────────────────────── -->
    <div id="cfg-tab-content" class="flex-1 overflow-y-auto">
      ${_renderTab(activeTab, meta)}
    </div>`;

  // Bind after DOM is set
  _bindConfigEvents(s);
}

// ── Tab button helper ─────────────────────────────────────────────────────────
function _renderTabBtn(id, icon, label, active) {
  const isActive = active === id;
  return `
    <button data-cfg-tab="${id}"
      class="cfg-tab-btn flex items-center gap-1.5 px-4 py-2.5 tv text-[11px] font-bold uppercase tracking-wider transition-colors border-b-2
        ${isActive
          ? 'border-[#212529] text-[#212529] bg-[#d1d6dc]'
          : 'border-transparent text-[#6c757d] hover:text-[#343a40] hover:bg-[#d1d6dc]'}">
      <span class="ms material-symbols-outlined text-[14px]">${icon}</span>
      ${label}
    </button>`;
}

// ── Route to correct tab renderer ────────────────────────────────────────────
function _renderTab(tab, meta) {
  switch (tab) {
    case 'overview':  return _tabOverview(meta);
    case 'taxonomy':  return _tabTaxonomy();
    case 'devices':   return _tabDevices();
    case 'measures':  return _tabMeasures();
    case 'streams':   return _tabStreams();
    case 'versions':  return _tabVersions();
    default:          return _tabOverview(meta);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — OVERVIEW
// ══════════════════════════════════════════════════════════════════════════════
function _tabOverview(meta) {
  const cv = meta.currentVersion;
  const standards = ConfigService.get('standards') ?? {};
  const security  = ConfigService.get('security')  ?? {};

  return `
    <div class="p-5 grid grid-cols-2 gap-5">

      <!-- Current Version Card -->
      <div class="border border-[rgba(0,0,0,.08)] bg-white p-4">
        <div class="tv text-[11px] text-[#6c757d] uppercase tracking-widest mb-3">Active Configuration</div>
        <div class="tv text-2xl font-black text-[#212529] mb-1">v${escHtml(meta.configVersion)}</div>
        ${cv ? `
        <div class="tv text-[11px] text-[#6c757d] mb-3">${escHtml(cv.ts ? new Date(cv.ts).toLocaleString('it-IT') : '—')}</div>
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="ms material-symbols-outlined text-[#6c757d] text-[14px]">person</span>
            <span class="tv text-[11px] text-[#343a40]">By: <strong>${escHtml(cv.user)}</strong> [${escHtml(cv.role)}]</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="ms material-symbols-outlined text-[#6c757d] text-[14px] mt-0.5">comment</span>
            <span class="tv text-[11px] text-[#343a40]">${escHtml(cv.reason)}</span>
          </div>
          <div class="flex items-center gap-2 mt-2">
            <span class="ms material-symbols-outlined text-[#6c757d] text-[14px]">fingerprint</span>
            <span class="tv text-[10px] text-[#adb5bd] font-mono">${escHtml(cv.id)}</span>
          </div>
        </div>` : '<div class="tv text-[11px] text-[#adb5bd]">No version info</div>'}
      </div>

      <!-- Stats Card -->
      <div class="border border-[rgba(0,0,0,.08)] bg-white p-4">
        <div class="tv text-[11px] text-[#6c757d] uppercase tracking-widest mb-3">Platform Statistics</div>
        <div class="space-y-2">
          ${_statRow('Sensors Monitored', Object.keys(ConfigService.get('measures') ?? {}).length)}
          ${_statRow('Data Streams',      Object.keys(ConfigService.get('streams') ?? {}).length)}
          ${_statRow('Devices Registered',Object.keys(ConfigService.get('devices') ?? {}).length)}
          ${_statRow('Config Versions',   meta.versionCount)}
          ${_statRow('Asset ID',          meta.assetId ?? '—')}
          ${_statRow('Project ID',        meta.projectId ?? '—')}
        </div>
      </div>

      <!-- Applicable Standards -->
      <div class="border border-[rgba(0,0,0,.08)] bg-white p-4">
        <div class="tv text-[11px] text-[#6c757d] uppercase tracking-widest mb-3">Applicable Standards</div>
        <div class="space-y-1.5">
          ${Object.entries(standards).map(([k, v]) =>
            `<div class="flex items-center justify-between py-0.5 border-b border-[rgba(0,0,0,.04)]">
              <span class="tv text-[11px] text-[#6c757d] uppercase">${escHtml(k.replace(/_/g,' '))}</span>
              <span class="tv text-[11px] font-bold text-[#343a40]">${escHtml(v)}</span>
            </div>`
          ).join('')}
        </div>
      </div>

      <!-- Security Suite -->
      <div class="border border-[rgba(0,0,0,.08)] bg-white p-4">
        <div class="tv text-[11px] text-[#6c757d] uppercase tracking-widest mb-3">Security Suite (IEC 62443)</div>
        <div class="space-y-1.5">
          ${Object.entries(security).map(([k, v]) =>
            `<div class="flex items-center justify-between py-0.5 border-b border-[rgba(0,0,0,.04)]">
              <span class="tv text-[11px] text-[#6c757d] uppercase">${escHtml(k)}</span>
              <span class="tv text-[11px] font-bold text-[#343a40]">${escHtml(v)}</span>
            </div>`
          ).join('')}
        </div>
      </div>

    </div>`;
}

function _statRow(label, value) {
  return `
    <div class="flex items-center justify-between py-1 border-b border-[rgba(0,0,0,.04)]">
      <span class="tv text-[11px] text-[#6c757d]">${escHtml(String(label))}</span>
      <span class="tv text-[12px] font-bold text-[#212529]">${escHtml(String(value))}</span>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — TAXONOMY
// ══════════════════════════════════════════════════════════════════════════════
function _tabTaxonomy() {
  const tax = ConfigService.get('taxonomy');
  if (!tax) return '<div class="p-5 tv text-[11px] text-[#6c757d]">No taxonomy data</div>';

  return `
    <div class="p-5">
      <div class="tv text-[11px] text-[#6c757d] uppercase tracking-widest mb-4">
        LFR Plant Hierarchy (AAS IEC 63278 Asset Administration Shell)
      </div>
      <div class="border border-[rgba(0,0,0,.08)] bg-white p-4 overflow-auto">
        ${_renderTreeNode(tax, 0)}
      </div>
    </div>`;
}

function _renderTreeNode(node, depth) {
  const indent = depth * 20;
  const typeColor = { Plant: '#212529', System: '#343a40', Subsystem: '#495057' }[node.type] ?? '#6c757d';
  const typeIcon  = { Plant: 'factory', System: 'category', Subsystem: 'settings_input_component' }[node.type] ?? 'circle';

  const sensorChips = (node.sensors ?? []).map(key => {
    const m = ConfigService.get('measures')?.[key];
    const sysCol = SYS_COLOR[m?.sys ?? ''] ?? '#6c757d';
    return `<span class="tv text-[10px] px-1.5 py-0.5 border font-bold" style="border-color:${sysCol}33;color:${sysCol}">${escHtml(key)}</span>`;
  }).join('');

  return `
    <div class="py-1.5 fade-in" style="padding-left:${indent}px">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="ms material-symbols-outlined text-[14px]" style="color:${typeColor}">${typeIcon}</span>
        <span class="tv text-[11px] font-bold" style="color:${typeColor}">${escHtml(node.label)}</span>
        <span class="tv text-[10px] px-1.5 py-0.5 bg-[#e2e6ea] text-[#6c757d]">${escHtml(node.type)}</span>
        <span class="tv text-[10px] text-[#adb5bd] font-mono">${escHtml(node.id)}</span>
        ${sensorChips}
      </div>
      ${(node.children ?? []).map(c => _renderTreeNode(c, depth + 1)).join('')}
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 — DEVICES
// ══════════════════════════════════════════════════════════════════════════════
function _tabDevices() {
  const devices = ConfigService.get('devices') ?? {};
  const entries = Object.entries(devices);

  return `
    <div class="p-5">
      <div class="tv text-[11px] text-[#6c757d] uppercase tracking-widest mb-4">
        Device Registry — ${entries.length} Assets (AAS Digital ID Cards)
      </div>
      <div class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="bg-[#e2e6ea]">
              ${['Tag', 'Label', 'System', 'Unit', 'Manufacturer', 'Protocol', 'AAS ID', 'Status']
                .map(h => `<th class="tv text-[10px] text-[#6c757d] uppercase tracking-wider text-left px-3 py-2 border border-[rgba(0,0,0,.06)]">${h}</th>`)
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${entries.map(([key, d]) => {
              const col = SYS_COLOR[d.system] ?? '#6c757d';
              return `
                <tr class="sr border-b border-[rgba(0,0,0,.04)]">
                  <td class="px-3 py-1.5 border border-[rgba(0,0,0,.06)]">
                    <span class="tv text-[11px] font-bold" style="color:${col}">${escHtml(d.tag)}</span>
                  </td>
                  <td class="px-3 py-1.5 border border-[rgba(0,0,0,.06)] tv text-[11px] text-[#343a40]">${escHtml(d.label)}</td>
                  <td class="px-3 py-1.5 border border-[rgba(0,0,0,.06)]">
                    <span class="tv text-[10px] px-1.5 py-0.5 font-bold" style="border:1px solid ${col}33;color:${col}">${escHtml(d.system)}</span>
                  </td>
                  <td class="px-3 py-1.5 border border-[rgba(0,0,0,.06)] tv text-[11px] text-[#6c757d]">${escHtml(d.unit)}</td>
                  <td class="px-3 py-1.5 border border-[rgba(0,0,0,.06)] tv text-[11px] text-[#6c757d]">${escHtml(d.manufacturer)}</td>
                  <td class="px-3 py-1.5 border border-[rgba(0,0,0,.06)] tv text-[11px] text-[#6c757d]">${escHtml(d.protocol)}</td>
                  <td class="px-3 py-1.5 border border-[rgba(0,0,0,.06)] tv text-[10px] text-[#adb5bd] font-mono">${escHtml(d.aasId)}</td>
                  <td class="px-3 py-1.5 border border-[rgba(0,0,0,.06)]">
                    <span class="tv text-[10px] font-bold" style="color:${d.enabled ? '#159647' : '#e31a1a'}">
                      ${d.enabled ? '● ENABLED' : '○ DISABLED'}
                    </span>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 4 — MEASURES (The Key Tab — Inline Threshold Editor)
// ══════════════════════════════════════════════════════════════════════════════
function _tabMeasures() {
  const measures = ConfigService.get('measures') ?? {};
  const entries  = Object.entries(measures);

  const pendingCount = Object.keys(_pending).length;
  const hasPending   = pendingCount > 0;

  return `
    <div class="flex flex-col h-full">
      <!-- Measures toolbar -->
      <div class="flex-shrink-0 flex items-center justify-between px-5 py-2.5 border-b border-[rgba(0,0,0,.08)] bg-[#e2e6ea]">
        <div class="tv text-[11px] text-[#6c757d]">
          Edit trip setpoints and alarm thresholds inline.
          Changes are <strong class="text-[#343a40]">held locally</strong> until you click "Save as New Version".
        </div>
        <div class="flex items-center gap-2">
          ${hasPending ? `
            <div class="tv text-[11px] text-[#d97d06] font-bold animate-pulse">
              ● ${_pendingCount} unsaved change${_pendingCount !== 1 ? 's' : ''}
            </div>
            <button id="cfg-btn-discard"
              class="tv text-[11px] px-3 py-1.5 border border-[rgba(0,0,0,.1)] text-[#343a40] font-bold uppercase tracking-wider hover:bg-[#d1d6dc] transition-colors">
              DISCARD
            </button>
            <button id="cfg-btn-save"
              class="flex items-center gap-1.5 tv text-[11px] px-3 py-1.5 bg-[#212529] text-white font-bold uppercase tracking-wider hover:bg-[#343a40] transition-colors">
              <span class="ms material-symbols-outlined text-[13px]">save</span> SAVE AS NEW VERSION
            </button>` : `
            <div class="tv text-[11px] text-[#159647] font-bold">✓ No pending changes</div>`}
        </div>
      </div>

      <!-- Measures table -->
      <div class="flex-1 overflow-auto p-5">
        <table class="w-full border-collapse">
          <thead>
            <tr class="bg-[#e2e6ea] sticky top-0 z-10">
              ${['Tag', 'Label', 'System', 'Priority', 'Trip High', 'Trip Low', 'Nominal High', 'Unit']
                .map(h => `<th class="tv text-[10px] text-[#6c757d] uppercase tracking-wider text-left px-3 py-2 border border-[rgba(0,0,0,.06)] whitespace-nowrap">${h}</th>`)
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${entries.map(([key, m]) => _measureRow(key, m)).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function _measureRow(key, m) {
  const col = SYS_COLOR[m.sys] ?? '#6c757d';
  const pc  = _pending[key] ?? {};
  const isDirty = Object.keys(pc).length > 0;
  const rowBg = isDirty ? 'background:rgba(217,125,6,0.04)' : '';

  const fieldInput = (field, val, type = 'number') => {
    const pending = pc[field];
    const displayVal = pending !== undefined ? pending : val;
    const isPendingField = pending !== undefined;
    return `
      <input
        type="${type}"
        data-cfg-measure="${key}"
        data-cfg-field="${field}"
        value="${escHtml(String(displayVal))}"
        class="cfg-measure-input tv text-[11px] w-24 px-2 py-1 border transition-colors outline-none focus:border-[#343a40]
          ${isPendingField
            ? 'border-[#d97d06] bg-[rgba(217,125,6,.08)] text-[#d97d06] font-bold'
            : 'border-[rgba(0,0,0,.1)] bg-[#f4f6f8] text-[#212529]'}"
        step="any"
      />`;
  };

  const unitInput = () => {
    const pending = pc['unit'];
    const displayVal = pending !== undefined ? pending : m.unit;
    const isPendingField = pending !== undefined;
    return `
      <input
        type="text"
        data-cfg-measure="${key}"
        data-cfg-field="unit"
        value="${escHtml(displayVal)}"
        class="cfg-measure-input tv text-[11px] w-24 px-2 py-1 border transition-colors outline-none focus:border-[#343a40]
          ${isPendingField
            ? 'border-[#d97d06] bg-[rgba(217,125,6,.08)] text-[#d97d06] font-bold'
            : 'border-[rgba(0,0,0,.1)] bg-[#f4f6f8] text-[#212529]'}"
      />`;
  };

  const prioritySelect = () => {
    const pendingP = pc['priority'];
    const currentP = pendingP !== undefined ? pendingP : m.priority;
    const isPendingField = pendingP !== undefined;
    return `
      <select
        data-cfg-measure="${key}"
        data-cfg-field="priority"
        class="cfg-measure-input tv text-[11px] w-32 px-2 py-1 border transition-colors outline-none focus:border-[#343a40]
          ${isPendingField
            ? 'border-[#d97d06] bg-[rgba(217,125,6,.08)] text-[#d97d06] font-bold'
            : 'border-[rgba(0,0,0,.1)] bg-[#f4f6f8] text-[#212529]'}">
        ${[1, 2, 3].map(p =>
          `<option value="${p}" ${Number(currentP) === p ? 'selected' : ''}>${P_LABEL[p]}</option>`
        ).join('')}
      </select>`;
  };

  return `
    <tr class="sr border-b border-[rgba(0,0,0,.04)]" style="${rowBg}" data-measure-row="${key}">
      <td class="px-3 py-2 border border-[rgba(0,0,0,.06)]">
        <div class="flex items-center gap-1.5">
          ${isDirty ? '<span class="w-1.5 h-1.5 rounded-full bg-[#d97d06] flex-shrink-0"></span>' : '<span class="w-1.5 h-1.5 flex-shrink-0"></span>'}
          <span class="tv text-[11px] font-bold" style="color:${col}">${escHtml(m.tag)}</span>
        </div>
      </td>
      <td class="px-3 py-2 border border-[rgba(0,0,0,.06)] tv text-[11px] text-[#343a40]">${escHtml(m.label)}</td>
      <td class="px-3 py-2 border border-[rgba(0,0,0,.06)]">
        <span class="tv text-[10px] px-1.5 py-0.5 font-bold" style="border:1px solid ${col}33;color:${col}">${escHtml(m.sys)}</span>
      </td>
      <td class="px-3 py-2 border border-[rgba(0,0,0,.06)]">${prioritySelect()}</td>
      <td class="px-3 py-2 border border-[rgba(0,0,0,.06)]">${fieldInput('tripHigh', m.tripHigh)}</td>
      <td class="px-3 py-2 border border-[rgba(0,0,0,.06)]">${fieldInput('tripLow', m.tripLow)}</td>
      <td class="px-3 py-2 border border-[rgba(0,0,0,.06)]">${fieldInput('nominalHigh', m.nominalHigh)}</td>
      <td class="px-3 py-2 border border-[rgba(0,0,0,.06)]">${unitInput()}</td>
    </tr>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 5 — STREAMS
// ══════════════════════════════════════════════════════════════════════════════
function _tabStreams() {
  const streams = ConfigService.get('streams') ?? {};
  const entries = Object.entries(streams);

  return `
    <div class="p-5 space-y-4">
      <div class="tv text-[11px] text-[#6c757d] uppercase tracking-widest">
        Data Stream Definitions — OPC UA / IEC 62541 / ProtoBuf Encoding
      </div>
      ${entries.map(([id, st]) => {
        const enabledCol = st.enabled ? '#159647' : '#e31a1a';
        return `
          <div class="border border-[rgba(0,0,0,.08)] bg-white p-4">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <span class="ms material-symbols-outlined text-[#495057] text-[18px]">stream</span>
                <div>
                  <div class="tv font-bold text-[12px] text-[#212529]">${escHtml(st.label)}</div>
                  <div class="tv text-[10px] text-[#adb5bd] font-mono">${escHtml(id)}</div>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span class="tv text-[11px] font-bold" style="color:${enabledCol}">
                  ${st.enabled ? '● ENABLED' : '○ DISABLED'}
                </span>
                <span class="tv text-[11px] px-2 py-0.5 bg-[#e2e6ea] text-[#6c757d]">${escHtml(st.encoding)}</span>
                <span class="tv text-[11px] px-2 py-0.5 bg-[#e2e6ea] text-[#343a40] font-bold">${st.rateMs} ms</span>
              </div>
            </div>
            <div class="tv text-[11px] text-[#6c757d] mb-2">Protocol: <strong class="text-[#343a40]">${escHtml(st.protocol)}</strong></div>
            <div class="flex flex-wrap gap-1.5">
              ${(st.sensors ?? []).map(key => {
                const m = ConfigService.get('measures')?.[key];
                const sysCol = SYS_COLOR[m?.sys ?? ''] ?? '#6c757d';
                return `<span class="tv text-[10px] px-2 py-0.5 border font-bold" style="border-color:${sysCol}44;color:${sysCol};background:${sysCol}08">${escHtml(key)}</span>`;
              }).join('')}
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 6 — VERSIONS (Timeline + Diff + Rollback)
// ══════════════════════════════════════════════════════════════════════════════
function _tabVersions() {
  const versions = ConfigService.getVersions();
  const meta     = ConfigService.getMeta();
  const audit    = ConfigService.getAuditLog().slice(0, 20);

  return `
    <div class="p-5 grid grid-cols-3 gap-5">

      <!-- Version Timeline (left 2/3) -->
      <div class="col-span-2">
        <div class="tv text-[11px] text-[#6c757d] uppercase tracking-widest mb-4">
          Version History — ${versions.length} Snapshots (Max 50)
        </div>
        <div class="space-y-2">
          ${versions.slice(0, 30).map((v, i) => {
            const isCurrent = v.id === meta.currentVersionId;
            const isFirst   = i === versions.length - 1;
            return `
              <div class="border ${isCurrent ? 'border-[#212529]' : 'border-[rgba(0,0,0,.08)]'} bg-white p-3 flex items-start justify-between gap-3">
                <div class="flex items-start gap-3 flex-1 min-w-0">
                  <div class="flex flex-col items-center flex-shrink-0 mt-0.5">
                    <div class="w-2.5 h-2.5 rounded-full flex-shrink-0 ${isCurrent ? 'bg-[#159647]' : 'bg-[#adb5bd]'}"></div>
                    ${i < versions.length - 1 ? '<div class="w-px flex-1 bg-[rgba(0,0,0,.08)] mt-1" style="min-height:12px"></div>' : ''}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="tv text-[12px] font-bold ${isCurrent ? 'text-[#212529]' : 'text-[#495057]'}">${escHtml(v.label)}</span>
                      ${isCurrent ? '<span class="tv text-[10px] px-1.5 py-0.5 bg-[#212529] text-white font-bold">CURRENT</span>' : ''}
                      ${isFirst   ? '<span class="tv text-[10px] px-1.5 py-0.5 bg-[#e2e6ea] text-[#6c757d]">FACTORY DEFAULT</span>' : ''}
                    </div>
                    <div class="tv text-[11px] text-[#6c757d] mt-0.5">
                      ${escHtml(new Date(v.ts).toLocaleString('it-IT'))} · <strong>${escHtml(v.user)}</strong> [${escHtml(v.role)}]
                    </div>
                    ${v.changes?.length > 0 ? `
                      <div class="mt-1.5 flex flex-wrap gap-1">
                        ${v.changes.slice(0, 5).map(c =>
                          `<span class="tv text-[10px] px-1.5 py-0.5 bg-[rgba(0,0,0,.04)] text-[#6c757d]">
                            ${escHtml(c.path)}: <span class="text-[#e31a1a] line-through">${escHtml(String(c.oldValue))}</span>
                            → <span class="text-[#159647] font-bold">${escHtml(String(c.newValue))}</span>
                          </span>`
                        ).join('')}
                        ${v.changes.length > 5 ? `<span class="tv text-[10px] text-[#adb5bd]">+${v.changes.length - 5} more</span>` : ''}
                      </div>` : ''}
                  </div>
                </div>
                <div class="flex gap-1 flex-shrink-0">
                  ${!isCurrent && !isFirst ? `
                    <button data-cfg-rollback="${escHtml(v.id)}"
                      class="tv text-[10px] px-2 py-1 border border-[rgba(0,0,0,.1)] text-[#343a40] font-bold uppercase hover:bg-[#d1d6dc] transition-colors">
                      ROLLBACK
                    </button>` : ''}
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Audit Log (right 1/3) -->
      <div>
        <div class="tv text-[11px] text-[#6c757d] uppercase tracking-widest mb-4">
          Change Audit Log (IEC 62443)
        </div>
        <div class="space-y-1.5">
          ${audit.length === 0
            ? '<div class="tv text-[11px] text-[#adb5bd]">No audit entries yet</div>'
            : audit.map(a => `
              <div class="border border-[rgba(0,0,0,.06)] bg-white p-2">
                <div class="flex items-center gap-1.5 mb-0.5">
                  <span class="tv text-[10px] font-bold px-1 py-0.5 bg-[#e2e6ea] text-[#495057]">${escHtml(a.action.replace('CONFIG_', ''))}</span>
                  <span class="tv text-[10px] font-bold text-[#343a40]">${escHtml(a.version ?? '')}</span>
                </div>
                <div class="tv text-[10px] text-[#6c757d]">${escHtml(new Date(a.ts).toLocaleString('it-IT'))}</div>
                <div class="tv text-[10px] text-[#343a40]"><strong>${escHtml(a.user)}</strong> [${escHtml(a.role)}]</div>
                <div class="tv text-[10px] text-[#6c757d] mt-0.5 truncate">${escHtml(a.reason)}</div>
              </div>`
          ).join('')}
        </div>
      </div>

    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// EVENT BINDINGS for config panel
// ══════════════════════════════════════════════════════════════════════════════
function _bindConfigEvents(s) {
  // Tab switching — ES module circular refs are fine at call time (not load time)
  document.querySelectorAll('.cfg-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-cfg-tab');
      if (tab) dispatch(A.CONFIG_TAB_CHANGE, { tab });
    });
  });

  // Measures: input changes → pending buffer
  document.querySelectorAll('.cfg-measure-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const key   = inp.getAttribute('data-cfg-measure');
      const field = inp.getAttribute('data-cfg-field');
      let val     = inp.value.trim();
      if (inp.type === 'number' || field !== 'unit') {
        const n = parseFloat(val);
        if (!isNaN(n)) val = n;
        else if (field === 'priority') val = parseInt(val, 10) || 1;
      }
      _setPending(key, field, val);
      // Highlight the row as dirty immediately (no full re-render needed)
      const row = document.querySelector(`[data-measure-row="${key}"]`);
      if (row) row.style.background = 'rgba(217,125,6,0.04)';
      // Trigger re-render to update pending count in toolbar
      dispatch(A.CONFIG_TAB_CHANGE, { tab: s.configActiveTab ?? 'measures' });
    });
  });

  // Save pending changes as new version
  document.getElementById('cfg-btn-save')?.addEventListener('click', () => {
    if (Object.keys(_pending).length === 0) return;

    const reason = prompt('Reason for this configuration change (required for audit trail):',
      `Setpoint update by ${s.role}`);
    if (!reason || !reason.trim()) return;

    // Build delta for measures submodel
    const currentMeasures = ConfigService.get('measures') ?? {};
    const delta = {};
    for (const [sKey, fields] of Object.entries(_pending)) {
      delta[sKey] = { ...currentMeasures[sKey], ...fields };
    }

    const success = ConfigService.update('measures', delta, {
      reason: reason.trim(),
      role:   s.role,
      user:   `Operator (${s.role})`,
    });

    if (success) {
      _clearPending();
      dispatch(A.LOG, { msg: `Config updated: ${reason.trim()}` });
      dispatch(A.CONFIG_TAB_CHANGE, { tab: 'measures' });
    }
  });

  // Discard pending
  document.getElementById('cfg-btn-discard')?.addEventListener('click', () => {
    _clearPending();
    dispatch(A.CONFIG_TAB_CHANGE, { tab: 'measures' });
  });

  // Export
  document.getElementById('cfg-btn-export')?.addEventListener('click', () => {
    const json = ConfigService.export();
    dlFile(json, `core-sentinel-config-${Date.now()}.json`, 'application/json');
    dispatch(A.LOG, { msg: 'Platform configuration exported to JSON' });
  });

  // Import
  document.getElementById('cfg-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const jsonStr = ev.target.result;
      const result = ConfigService.import(jsonStr, {
        reason: `Imported from file: ${file.name}`,
        role:   s.role,
        user:   `Operator (${s.role})`,
      });
      if (result.ok) {
        alert(`Configuration imported successfully. ${result.version}`);
        dispatch(A.LOG, { msg: `Config imported: ${file.name}` });
        dispatch(A.CONFIG_TAB_CHANGE, { tab: 'overview' });
      } else {
        alert(`Import failed: ${result.error}`);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset so same file can be re-imported
  });

  // Reset
  document.getElementById('cfg-btn-reset')?.addEventListener('click', () => {
    if (!confirm('⚠ Factory reset will discard ALL configuration changes and restore defaults. Continue?')) return;
    ConfigService.reset({ reason: 'Factory reset via SCR-14', role: s.role, user: `Operator (${s.role})` });
    _clearPending();
    dispatch(A.LOG, { msg: 'Platform configuration factory reset' });
    dispatch(A.CONFIG_TAB_CHANGE, { tab: 'overview' });
  });

  // Version rollback buttons
  document.querySelectorAll('[data-cfg-rollback]').forEach(btn => {
    btn.addEventListener('click', () => {
      const vId = btn.getAttribute('data-cfg-rollback');
      const reason = prompt('Reason for rollback (required for audit trail):', 'Manual rollback via SCR-14');
      if (!reason || !reason.trim()) return;

      const ok = ConfigService.rollback(vId, {
        reason: reason.trim(),
        role:   s.role,
        user:   `Operator (${s.role})`,
      });
      if (ok) {
        _clearPending();
        dispatch(A.LOG, { msg: `Config rolled back: ${reason.trim()}` });
        dispatch(A.CONFIG_TAB_CHANGE, { tab: 'versions' });
      }
    });
  });
}
