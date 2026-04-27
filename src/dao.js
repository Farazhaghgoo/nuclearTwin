import { ConfigService } from './config-service.js';

// Abstracts Physical sensors vs Simulated (Politecnico) physics model
// ═══════════════════════════════════════════════════════════════════
export const DAO = {
  mode: 'SIMULATED',

  // Nominal values — pre-seeded from _s defaults, overridden by init() from ConfigService
  NOMINAL: {
    CORE_TEMP:1100, COOLANT_IN:580, COOLANT_OUT:870, PRIM_PRESS:230,
    PUMP_A:3400, PUMP_B:3400, NEUTRON_FLUX:3.8, FUEL_BURNUP:55,
    SG_INLET:510, STEAM_PRESS:172, TURBINE_RPM:3150, GRID_OUT:500,
    ROD_POS:90, SCRAM_V:0, LEAD_LEVEL:0, SEC_FLOW:3000,
  },

  // Initial sensor map — v is seeded to nominal defaults so renderHUD
  // never sees undefined before DAO.init() completes (ISA-101 §5.3 safe defaults)
  _s: {
    CORE_TEMP:    { tag:'T-CORE-01',   label:'Core Temperature',       sys:'Primary',   u:'°C',          vlt:1.4,  v:1100, trip:1200, low:900  },
    COOLANT_IN:   { tag:'T-CL-IN-01',  label:'Coolant Inlet Temp',     sys:'Primary',   u:'K',           vlt:0.7,  v:580,  trip:620,  low:480  },
    COOLANT_OUT:  { tag:'T-CL-OUT-01', label:'Coolant Outlet Temp',    sys:'Primary',   u:'K',           vlt:0.8,  v:870,  trip:900,  low:750  },
    PRIM_PRESS:   { tag:'P-PRI-01',    label:'Primary Pressure ΔP',    sys:'Primary',   u:'PSI',         vlt:0.55, v:230,  trip:250,  low:150  },
    PUMP_A:       { tag:'N-PMP-A-01',  label:'Pump A Speed',           sys:'Primary',   u:'RPM',         vlt:5,    v:3400, trip:3600, low:2800 },
    PUMP_B:       { tag:'N-PMP-B-01',  label:'Pump B Speed',           sys:'Secondary', u:'RPM',         vlt:5,    v:3400, trip:3600, low:2800 },
    NEUTRON_FLUX: { tag:'F-NEUT-01',   label:'Neutron Flux',           sys:'Primary',   u:'e14 n/cm²·s', vlt:0.02, v:3.8,  trip:4.0,  low:2.5  },
    FUEL_BURNUP:  { tag:'B-FUEL-01',   label:'Fuel Burnup',            sys:'Primary',   u:'GWd/t',       vlt:0,    v:55,   trip:60,   low:0    },
    SG_INLET:     { tag:'T-SG-IN-01',  label:'SG Inlet Temperature',   sys:'Secondary', u:'°C',          vlt:0.65, v:510,  trip:550,  low:420  },
    STEAM_PRESS:  { tag:'P-STM-01',    label:'Steam Pressure',         sys:'Secondary', u:'bar',         vlt:0.28, v:172,  trip:180,  low:130  },
    TURBINE_RPM:  { tag:'N-TRB-01',    label:'Turbine Speed',          sys:'Secondary', u:'RPM',         vlt:3,    v:3150, trip:3200, low:2800 },
    GRID_OUT:     { tag:'P-GRID-01',   label:'Grid Electrical Output', sys:'Grid',      u:'MWe',         vlt:0.4,  v:500,  trip:510,  low:400  },
    ROD_POS:      { tag:'R-ROD-AVG',   label:'Control Rod Pos (avg)',  sys:'Safety',    u:'%',           vlt:0.08, v:90,   trip:95,   low:5    },
    SCRAM_V:      { tag:'V-SCR-01',    label:'SCRAM Bus Voltage',      sys:'Safety',    u:'V',           vlt:0.04, v:0,    trip:0,    low:40   },
    LEAD_LEVEL:   { tag:'L-PB-01',     label:'Lead Coolant Level',     sys:'Primary',   u:'%',           vlt:0.04, v:0,    trip:0,    low:90   },
    SEC_FLOW:     { tag:'F-SEC-01',    label:'Secondary Flow Rate',    sys:'Secondary', u:'kg/s',        vlt:3.5,  v:3000, trip:3200, low:2400 },
  },

  init() {
    // Register DAO sensor metadata with ConfigService (enriches devices + taxonomy)
    ConfigService.setDaoRef(this._s);

    // Read live setpoints from ConfigService measures submodel
    const measures = ConfigService.get('measures') ?? {};

    Object.entries(this._s).forEach(([k, s]) => {
      const cfg = measures[k];
      if (cfg) {
        s.v    = cfg.nominalHigh;
        s.trip = cfg.tripHigh;
        s.low  = cfg.tripLow;
        s.u    = cfg.unit; // Override internal unit with config unit
      }
    });

    // Rebuild NOMINAL lookup from ConfigService measures
    this.NOMINAL = Object.fromEntries(
      Object.entries(measures).map(([k, v]) => [k, v.nominalHigh])
    );

    // Live config reload — when SCR-14 saves a new version, DAO reloads instantly
    document.addEventListener('dao:config:updated', (e) => {
      const { submodel } = e.detail ?? {};
      if (submodel === 'measures' || submodel === '*') {
        const updated = ConfigService.get('measures') ?? {};
        Object.entries(this._s).forEach(([k, s]) => {
          const cfg = updated[k];
          if (cfg) {
            s.trip = cfg.tripHigh;
            s.low  = cfg.tripLow;
            s.u    = cfg.unit;
          }
        });
        this.NOMINAL = Object.fromEntries(
          Object.entries(updated).map(([k, v]) => [k, v.nominalHigh])
        );
      }
    });
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
  },

  inject(key, delta) {
    if (this._s[key]) {
      const s = this._s[key];
      s.v = Math.max(s.low * 0.92, Math.min(s.trip * 0.985, s.v + delta));
    }
  },

  override(key, value) {
    if (this._s[key]) {
      this._s[key].v = value;
    }
  }
};