import config from '../hmi-config.json';

// Abstracts Physical sensors vs Simulated (Politecnico) physics model
// ═══════════════════════════════════════════════════════════════════
export const DAO = {
  mode: 'SIMULATED',

  // Nominal values from config
  NOMINAL: Object.fromEntries(
    Object.entries(config.sensors).map(([k, v]) => [k, v.nominalHigh])
  ),

  // Initial sensor map (partially driven by config)
  _s: {
    CORE_TEMP:    { tag:'T-CORE-01', label:'Core Temperature',        sys:'Primary',   u:'°C',          vlt:1.4  },
    COOLANT_IN:   { tag:'T-CL-IN-01',label:'Coolant Inlet Temp',      sys:'Primary',   u:'K',           vlt:0.7  },
    COOLANT_OUT:  { tag:'T-CL-OUT-01',label:'Coolant Outlet Temp',    sys:'Primary',   u:'K',           vlt:0.8  },
    PRIM_PRESS:   { tag:'P-PRI-01',  label:'Primary Pressure ΔP',     sys:'Primary',   u:'PSI',         vlt:0.55 },
    PUMP_A:       { tag:'N-PMP-A-01',label:'Pump A Speed',            sys:'Primary',   u:'RPM',         vlt:5    },
    PUMP_B:       { tag:'N-PMP-B-01',label:'Pump B Speed',            sys:'Secondary', u:'RPM',         vlt:5    },
    NEUTRON_FLUX: { tag:'F-NEUT-01', label:'Neutron Flux',            sys:'Primary',   u:'e14 n/cm²·s', vlt:0.02 },
    FUEL_BURNUP:  { tag:'B-FUEL-01', label:'Fuel Burnup',             sys:'Primary',   u:'GWd/t',       vlt:0    },
    SG_INLET:     { tag:'T-SG-IN-01',label:'SG Inlet Temperature',    sys:'Secondary', u:'°C',          vlt:0.65 },
    STEAM_PRESS:  { tag:'P-STM-01',  label:'Steam Pressure',          sys:'Secondary', u:'bar',         vlt:0.28 },
    TURBINE_RPM:  { tag:'N-TRB-01',  label:'Turbine Speed',           sys:'Secondary', u:'RPM',         vlt:3    },
    GRID_OUT:     { tag:'P-GRID-01', label:'Grid Electrical Output',  sys:'Grid',      u:'MWe',         vlt:0.4  },
    ROD_POS:      { tag:'R-ROD-AVG', label:'Control Rod Pos (avg)',   sys:'Safety',    u:'%',           vlt:0.08 },
    SCRAM_V:      { tag:'V-SCR-01',  label:'SCRAM Bus Voltage',       sys:'Safety',    u:'V',           vlt:0.04 },
    LEAD_LEVEL:   { tag:'L-PB-01',   label:'Lead Coolant Level',      sys:'Primary',   u:'%',           vlt:0.04 },
    SEC_FLOW:     { tag:'F-SEC-01',  label:'Secondary Flow Rate',     sys:'Secondary', u:'kg/s',        vlt:3.5  },
  },

  init() {
    Object.entries(this._s).forEach(([k, s]) => {
      const cfg = config.sensors[k];
      if (cfg) {
        s.v    = cfg.nominalHigh;
        s.trip = cfg.tripHigh;
        s.low  = cfg.tripLow;
        s.u    = cfg.unit; // Override internal unit with config unit
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