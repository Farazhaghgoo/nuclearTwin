/**
 * CORE-SENTINEL HMI — ConfigService
 * WP 1.3 — Configuration Layer (AAS IEC 63278 / ISA-101 §5.4 / OPC UA IEC 62541)
 *
 * Single source of truth for all platform configuration.
 * Implements:
 *   - AAS-style submodel structure (measures, devices, streams, taxonomy, …)
 *   - Full versioning with djb2 hash IDs and per-version snapshots
 *   - Audit trail (who / what / when) per IEC 62443
 *   - CustomEvent `dao:config:updated` for zero-reload live propagation
 *   - LocalStorage persistence (browser-side AAS registry proxy)
 *   - Import / Export / Reset (no-code administration)
 *
 * Access via: import { ConfigService } from './config-service.js'
 */

import rawConfig from '../hmi-config.json';

const STORE_KEY = 'dao-sentinel-cfg';
const AUDIT_KEY = 'dao-sentinel-cfg-audit';
const MAX_VERSIONS = 50;

// ── djb2 hash (fast, deterministic, collision-resistant for config payloads) ──
function _hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h.toString(16).padStart(8, '0').toUpperCase();
}

// ── Deep non-destructive merge (target is NOT mutated) ───────────────────────
function _merge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      out[key] = _merge(target[key], source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

// ── Diff two objects, return array of {path, oldValue, newValue} ─────────────
function _diff(oldObj, newObj, prefix = '') {
  const changes = [];
  const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
  for (const key of allKeys) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const oldVal = oldObj?.[key];
    const newVal = newObj?.[key];
    if (
      typeof oldVal === 'object' && oldVal !== null &&
      typeof newVal === 'object' && newVal !== null &&
      !Array.isArray(oldVal) && !Array.isArray(newVal)
    ) {
      changes.push(..._diff(oldVal, newVal, fullPath));
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ path: fullPath, oldValue: oldVal, newValue: newVal });
    }
  }
  return changes;
}

// ── Build plant taxonomy from sensor definitions ──────────────────────────────
function _buildTaxonomy(sensors) {
  return {
    id: 'LFR-4G-UNIT-4',
    label: 'LFR-4G Unit 4',
    type: 'Plant',
    children: [
      {
        id: 'SYS-PRIMARY',
        label: 'Primary Circuit',
        type: 'System',
        children: [
          {
            id: 'SUB-CORE', label: 'Reactor Core', type: 'Subsystem',
            sensors: Object.entries(sensors)
              .filter(([, v]) => v.sys === 'Primary')
              .map(([k]) => k),
          },
          {
            id: 'SUB-PUMP', label: 'Primary Pumps', type: 'Subsystem',
            sensors: ['PUMP_A', 'LEAD_LEVEL'],
          },
        ],
      },
      {
        id: 'SYS-SECONDARY',
        label: 'Secondary Circuit',
        type: 'System',
        children: [
          {
            id: 'SUB-SG', label: 'Steam Generators', type: 'Subsystem',
            sensors: ['SG_INLET', 'STEAM_PRESS', 'SEC_FLOW'],
          },
          {
            id: 'SUB-TURB', label: 'Turbine / Grid', type: 'Subsystem',
            sensors: ['TURBINE_RPM', 'GRID_OUT', 'PUMP_B'],
          },
        ],
      },
      {
        id: 'SYS-SAFETY',
        label: 'Safety Systems',
        type: 'System',
        children: [
          {
            id: 'SUB-RPS', label: 'Reactor Protection System', type: 'Subsystem',
            sensors: ['ROD_POS', 'SCRAM_V', 'NEUTRON_FLUX'],
          },
        ],
      },
    ],
  };
}

// ── Build device registry from sensor map ────────────────────────────────────
function _buildDevices(sensors) {
  const protocolMap = {
    Primary:   'OPC UA (IEC 62541)',
    Secondary: 'OPC UA (IEC 62541)',
    Safety:    'IEC 61850',
    Grid:      'IEC 61968',
  };
  const manufacturerMap = {
    Primary:   'Endress+Hauser',
    Secondary: 'ABB Measurement',
    Safety:    'Westinghouse',
    Grid:      'Siemens Energy',
  };
  return Object.fromEntries(
    Object.entries(sensors).map(([key, s]) => [
      key,
      {
        assetId:      `urn:inrebus:lfr4g:unit4:${key.toLowerCase()}`,
        tag:          s.tag,
        label:        s.label,
        system:       s.sys,
        unit:         s.u,
        manufacturer: manufacturerMap[s.sys] ?? 'Unknown',
        protocol:     protocolMap[s.sys]    ?? 'OPC UA',
        aasId:        `AAS-${s.tag}`,
        enabled:      true,
      },
    ])
  );
}

// ── Build stream definitions ──────────────────────────────────────────────────
function _buildStreams(scanRateMs) {
  return {
    'STREAM-PRIM': {
      id: 'STREAM-PRIM',
      label: 'Primary Circuit Stream',
      sensors: ['CORE_TEMP', 'COOLANT_IN', 'COOLANT_OUT', 'PRIM_PRESS', 'PUMP_A', 'NEUTRON_FLUX', 'FUEL_BURNUP', 'LEAD_LEVEL'],
      rateMs: scanRateMs,
      protocol: 'OPC UA',
      encoding: 'ProtoBuf',
      enabled: true,
    },
    'STREAM-SEC': {
      id: 'STREAM-SEC',
      label: 'Secondary Circuit Stream',
      sensors: ['PUMP_B', 'SG_INLET', 'STEAM_PRESS', 'TURBINE_RPM', 'SEC_FLOW'],
      rateMs: scanRateMs,
      protocol: 'OPC UA',
      encoding: 'ProtoBuf',
      enabled: true,
    },
    'STREAM-SAFETY': {
      id: 'STREAM-SAFETY',
      label: 'Safety Systems Stream',
      sensors: ['ROD_POS', 'SCRAM_V'],
      rateMs: Math.min(scanRateMs, 400), // Safety streams run at 2× rate minimum
      protocol: 'IEC 61850 GOOSE',
      encoding: 'ProtoBuf',
      enabled: true,
    },
    'STREAM-GRID': {
      id: 'STREAM-GRID',
      label: 'Grid Output Stream',
      sensors: ['GRID_OUT'],
      rateMs: scanRateMs * 2,
      protocol: 'IEC 61968',
      encoding: 'JSON',
      enabled: true,
    },
  };
}

// ── Seed submodels from hmi-config.json ───────────────────────────────────────
function _buildSubmodels(raw, daoSensors) {
  // measures submodel: merge config setpoints + DAO runtime metadata
  const measures = {};
  for (const [key, cfg] of Object.entries(raw.sensors || {})) {
    const dao = daoSensors?.[key] ?? {};
    measures[key] = {
      tripHigh:    cfg.tripHigh,
      tripLow:     cfg.tripLow,
      nominalHigh: cfg.nominalHigh,
      unit:        cfg.unit,
      priority:    cfg.priority,
      tag:         dao.tag   ?? key,
      label:       dao.label ?? key,
      sys:         dao.sys   ?? 'Unknown',
    };
  }

  return {
    session:         { ...raw.session },
    dataLoop:        { ...raw.dataLoop },
    roles:           JSON.parse(JSON.stringify(raw.roles)),
    measures,
    devices:         _buildDevices(
      Object.fromEntries(
        Object.entries(measures).map(([k, v]) => [k, { tag: v.tag, label: v.label, sys: v.sys, u: v.unit }])
      )
    ),
    streams:         _buildStreams(raw.dataLoop?.scanRateMs ?? 800),
    taxonomy:        _buildTaxonomy(
      Object.fromEntries(
        Object.entries(measures).map(([k, v]) => [k, { sys: v.sys }])
      )
    ),
    alarmManagement: JSON.parse(JSON.stringify(raw.alarmManagement)),
    security:        JSON.parse(JSON.stringify(raw.security)),
    standards:       JSON.parse(JSON.stringify(raw.standards)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// _ConfigService — singleton class
// _────────────────────────────────────────────────────────────────────────────
class _ConfigService {
  constructor() {
    this._store  = null; // { meta, submodels, versions[] }
    this._audit  = [];
    this._daoRef = null; // lazy reference to DAO._s set by DAO.init()
    this._init();
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  _init() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        this._store = JSON.parse(raw);
        // Validate store has required shape
        if (!this._store?.meta || !this._store?.submodels || !Array.isArray(this._store?.versions)) {
          throw new Error('Invalid store shape — reseeding');
        }
      } else {
        this._seedFromDefaults();
      }
    } catch (e) {
      console.warn('[ConfigService] Init error, falling back to seed:', e.message);
      this._seedFromDefaults();
    }

    try {
      const rawAudit = localStorage.getItem(AUDIT_KEY);
      if (rawAudit) this._audit = JSON.parse(rawAudit);
    } catch {
      this._audit = [];
    }
  }

  _seedFromDefaults() {
    // DAO._s not available at module load time (circular dependency risk),
    // so we pass a minimal sensor structure derived from raw config only.
    const daoSensors = {}; // will be enriched when DAO calls setDaoRef()
    for (const key of Object.keys(rawConfig.sensors || {})) {
      daoSensors[key] = { tag: key, label: key, sys: 'Unknown', u: rawConfig.sensors[key].unit };
    }

    const submodels = _buildSubmodels(rawConfig, daoSensors);
    const versionId = this._makeVersionId(submodels, 'SEED');

    this._store = {
      meta: {
        schemaVersion: '1.0',
        configVersion: '4.2.0',
        projectId:     'DAO-LFR4G-UNIT4',
        assetId:       'urn:inrebus:lfr4g:unit4:hmi',
        currentVersionId: versionId,
        lastModified:  new Date().toISOString(),
        lastModifiedBy: 'SYSTEM',
        lastReason:    'Initial seed from hmi-config.json v4.2',
      },
      submodels,
      versions: [
        {
          id:          versionId,
          label:       'v4.2.0 — Factory Default',
          ts:          new Date().toISOString(),
          user:        'SYSTEM',
          role:        'SYSTEM',
          reason:      'Initial seed from hmi-config.json v4.2',
          snapshot:    JSON.parse(JSON.stringify(submodels)),
          changes:     [],
        },
      ],
    };
    this._persist();
  }

  /** Call from DAO.init() to enrich device metadata retroactively */
  setDaoRef(daoSensorMap) {
    this._daoRef = daoSensorMap;
    // Enrich measures.label / measures.tag / measures.sys from DAO if not already set
    const m = this._store.submodels.measures;
    let changed = false;
    for (const [key, dao] of Object.entries(daoSensorMap)) {
      if (m[key]) {
        if (m[key].tag !== dao.tag || m[key].label !== dao.label || m[key].sys !== dao.sys) {
          m[key].tag   = dao.tag;
          m[key].label = dao.label;
          m[key].sys   = dao.sys;
          changed = true;
        }
      }
    }
    if (changed) {
      // Also rebuild devices & taxonomy with enriched data
      this._store.submodels.devices  = _buildDevices(
        Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { tag: v.tag, label: v.label, sys: v.sys, u: v.unit }]))
      );
      this._store.submodels.taxonomy = _buildTaxonomy(
        Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { sys: v.sys }]))
      );
      this._persist();
    }
  }

  // ── Persistence ────────────────────────────────────────────────────────────
  _persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this._store));
    } catch (e) {
      console.error('[ConfigService] Persist failed (storage quota?):', e.message);
    }
  }

  _persistAudit() {
    try {
      // Keep last 200 audit entries in storage
      const trimmed = this._audit.slice(-200);
      localStorage.setItem(AUDIT_KEY, JSON.stringify(trimmed));
    } catch { /* non-critical */ }
  }

  // ── Version helpers ────────────────────────────────────────────────────────
  _makeVersionId(submodels, reason) {
    const payload = JSON.stringify(submodels) + reason + Date.now();
    return _hash(payload);
  }

  _parseVersion(vStr) {
    // vStr: "4.2.0" → [4, 2, 0]
    return vStr.split('.').map(Number);
  }

  _bumpPatch(vStr) {
    const parts = this._parseVersion(vStr);
    parts[2] = (parts[2] ?? 0) + 1;
    return parts.join('.');
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * get(submodel) — synchronous getter
   * Returns a deep copy of the requested submodel.
   * Callers MUST NOT mutate the returned object.
   */
  get(submodel) {
    if (!submodel) return JSON.parse(JSON.stringify(this._store.submodels));
    const sm = this._store.submodels[submodel];
    if (sm === undefined) {
      console.warn(`[ConfigService] Unknown submodel: "${submodel}"`);
      return null;
    }
    return JSON.parse(JSON.stringify(sm));
  }

  /**
   * getMeta() — returns config metadata + current version label
   */
  getMeta() {
    return {
      ...this._store.meta,
      versionCount: this._store.versions.length,
      currentVersion: this._store.versions.find(v => v.id === this._store.meta.currentVersionId),
    };
  }

  /**
   * update(submodel, delta, { reason, role, user })
   * Deep-merges delta into the submodel, creates a new version snapshot,
   * appends audit entry, emits CustomEvent.
   */
  update(submodel, delta, { reason = 'Config update', role = 'SYSTEM', user = 'SYSTEM' } = {}) {
    if (!this._store.submodels[submodel]) {
      console.warn(`[ConfigService] Cannot update unknown submodel: "${submodel}"`);
      return false;
    }

    const oldSubmodel = JSON.parse(JSON.stringify(this._store.submodels[submodel]));
    const newSubmodel = _merge(oldSubmodel, delta);
    const changes = _diff(oldSubmodel, newSubmodel, submodel);

    if (changes.length === 0) return false; // no-op

    // Apply
    this._store.submodels[submodel] = newSubmodel;

    // New version
    const newVersion = this._bumpPatch(this._store.meta.configVersion);
    const versionId  = this._makeVersionId(this._store.submodels, reason);

    // Trim oldest versions if at capacity
    if (this._store.versions.length >= MAX_VERSIONS) {
      // Always keep first (factory default) and last 49
      this._store.versions = [
        this._store.versions[0],
        ...this._store.versions.slice(-(MAX_VERSIONS - 2)),
      ];
    }

    this._store.versions.push({
      id:       versionId,
      label:    `v${newVersion} — ${reason.slice(0, 60)}`,
      ts:       new Date().toISOString(),
      user,
      role,
      reason,
      snapshot: JSON.parse(JSON.stringify(this._store.submodels)),
      changes,
    });

    this._store.meta.configVersion    = newVersion;
    this._store.meta.currentVersionId = versionId;
    this._store.meta.lastModified     = new Date().toISOString();
    this._store.meta.lastModifiedBy   = user;
    this._store.meta.lastReason       = reason;

    // Audit
    const auditEntry = {
      ts:      new Date().toISOString(),
      role,
      user,
      action:  'CONFIG_UPDATE',
      submodel,
      reason,
      version: `v${newVersion}`,
      changes,
    };
    this._audit.push(auditEntry);

    this._persist();
    this._persistAudit();

    // Live propagation — zero-reload
    this._emit(submodel, changes, `v${newVersion}`);

    return true;
  }

  /**
   * rollback(versionId, { reason, role, user })
   * Restores full submodel snapshot from a historical version.
   */
  rollback(versionId, { reason = 'Manual rollback', role = 'SYSTEM', user = 'SYSTEM' } = {}) {
    const target = this._store.versions.find(v => v.id === versionId);
    if (!target) {
      console.warn(`[ConfigService] Rollback failed — version not found: ${versionId}`);
      return false;
    }

    const oldSubmodels = JSON.parse(JSON.stringify(this._store.submodels));
    this._store.submodels = JSON.parse(JSON.stringify(target.snapshot));

    const newVersion = this._bumpPatch(this._store.meta.configVersion);
    const newVerId   = this._makeVersionId(this._store.submodels, reason);

    this._store.versions.push({
      id:       newVerId,
      label:    `v${newVersion} — ROLLBACK to ${target.label}`,
      ts:       new Date().toISOString(),
      user,
      role,
      reason,
      snapshot: JSON.parse(JSON.stringify(this._store.submodels)),
      changes:  _diff(oldSubmodels, this._store.submodels, 'root'),
    });

    this._store.meta.configVersion    = newVersion;
    this._store.meta.currentVersionId = newVerId;
    this._store.meta.lastModified     = new Date().toISOString();
    this._store.meta.lastModifiedBy   = user;
    this._store.meta.lastReason       = `ROLLBACK → ${target.label}`;

    const auditEntry = {
      ts:      new Date().toISOString(),
      role,
      user,
      action:  'CONFIG_ROLLBACK',
      reason,
      version: `v${newVersion}`,
      rolledBackTo: target.label,
    };
    this._audit.push(auditEntry);

    this._persist();
    this._persistAudit();

    // Emit for all submodels (wholesale replacement)
    this._emit('*', [], `v${newVersion}`);

    return true;
  }

  /**
   * getVersions() — returns version list, most recent first
   */
  getVersions() {
    return [...this._store.versions].reverse();
  }

  /**
   * getAuditLog() — returns audit entries, most recent first
   */
  getAuditLog() {
    return [...this._audit].reverse();
  }

  /**
   * export() — returns full config JSON string for download
   */
  export() {
    return JSON.stringify({
      _exported:  new Date().toISOString(),
      _tool:      'CORE-SENTINEL ConfigService v1.0',
      _standard:  'AAS IEC 63278 / ISA-101.01',
      meta:       this._store.meta,
      submodels:  this._store.submodels,
    }, null, 2);
  }

  /**
   * import(jsonStr, { reason, role, user })
   * Replaces submodels from imported JSON. Validates schema before applying.
   */
  import(jsonStr, { reason = 'Config import', role = 'SYSTEM', user = 'SYSTEM' } = {}) {
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      return { ok: false, error: 'Invalid JSON: ' + e.message };
    }

    // Accept both raw submodel objects and exported bundles
    const incoming = parsed.submodels ?? parsed;

    // Validate: must have at least `measures`
    if (!incoming.measures || typeof incoming.measures !== 'object') {
      return { ok: false, error: 'Invalid config: missing "measures" submodel' };
    }

    const oldSubmodels = JSON.parse(JSON.stringify(this._store.submodels));

    // Merge incoming submodels (non-destructive: unknown submodels are discarded)
    const KNOWN = ['session','dataLoop','roles','measures','devices','streams','taxonomy','alarmManagement','security','standards'];
    for (const key of KNOWN) {
      if (incoming[key] !== undefined) {
        this._store.submodels[key] = JSON.parse(JSON.stringify(incoming[key]));
      }
    }

    const newVersion = this._bumpPatch(this._store.meta.configVersion);
    const newVerId   = this._makeVersionId(this._store.submodels, reason);

    this._store.versions.push({
      id:       newVerId,
      label:    `v${newVersion} — IMPORT: ${reason.slice(0, 40)}`,
      ts:       new Date().toISOString(),
      user,
      role,
      reason,
      snapshot: JSON.parse(JSON.stringify(this._store.submodels)),
      changes:  _diff(oldSubmodels, this._store.submodels, 'root'),
    });

    this._store.meta.configVersion    = newVersion;
    this._store.meta.currentVersionId = newVerId;
    this._store.meta.lastModified     = new Date().toISOString();
    this._store.meta.lastModifiedBy   = user;
    this._store.meta.lastReason       = reason;

    this._audit.push({
      ts: new Date().toISOString(), role, user,
      action: 'CONFIG_IMPORT', reason, version: `v${newVersion}`,
    });

    this._persist();
    this._persistAudit();
    this._emit('*', [], `v${newVersion}`);

    return { ok: true, version: `v${newVersion}` };
  }

  /**
   * reset({ reason, role, user })
   * Factory reset — re-seeds from hmi-config.json defaults.
   */
  reset({ reason = 'Factory reset', role = 'SYSTEM', user = 'SYSTEM' } = {}) {
    this._audit.push({
      ts: new Date().toISOString(), role, user,
      action: 'CONFIG_RESET', reason,
    });
    this._persistAudit();

    // Clear store and re-seed
    localStorage.removeItem(STORE_KEY);
    this._seedFromDefaults();

    this._emit('*', [], this._store.meta.configVersion);
    return true;
  }

  // ── Internal ───────────────────────────────────────────────────────────────
  _emit(submodel, changes, version) {
    try {
      document.dispatchEvent(new CustomEvent('dao:config:updated', {
        detail: { submodel, changes, version, ts: new Date().toISOString() },
        bubbles: true,
      }));
    } catch { /* SSR / test guard */ }
  }
}

// Singleton export
export const ConfigService = new _ConfigService();
