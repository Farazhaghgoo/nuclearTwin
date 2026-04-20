// Abstracts Physical sensors vs Simulated (Politecnico) physics model
// ═══════════════════════════════════════════════════════════════════
export const DAO = {
  mode: 'SIMULATED',

  NOMINAL: {
    CORE_TEMP:1045.2, COOLANT_IN:542.4, COOLANT_OUT:823.1, PRIM_PRESS:214.8,
    PUMP_A:3200, PUMP_B:3185, NEUTRON_FLUX:3.42, FUEL_BURNUP:24.7,
    SG_INLET:480.2, STEAM_PRESS:165.4, TURBINE_RPM:3000, GRID_OUT:478.2,
    ROD_POS:72.4, SCRAM_V:48.2, LEAD_LEVEL:98.7, SEC_FLOW:2840,
  },

  _s: {
    CORE_TEMP:    { tag:'T-CORE-01', label:'Core Temperature',        sys:'Primary',   v:1045.2, u:'°C',          trip:1200, low:900,  vlt:1.4  },
    COOLANT_IN:   { tag:'T-CL-IN-01',label:'Coolant Inlet Temp',      sys:'Primary',   v:542.4,  u:'K',           trip:620,  low:480,  vlt:0.7  },
    COOLANT_OUT:  { tag:'T-CL-OUT-01',label:'Coolant Outlet Temp',    sys:'Primary',   v:823.1,  u:'K',           trip:900,  low:750,  vlt:0.8  },
    PRIM_PRESS:   { tag:'P-PRI-01',  label:'Primary Pressure ΔP',     sys:'Primary',   v:214.8,  u:'PSI',         trip:250,  low:150,  vlt:0.55 },
    PUMP_A:       { tag:'N-PMP-A-01',label:'Pump A Speed',            sys:'Primary',   v:3200,   u:'RPM',         trip:3600, low:2800, vlt:5    },
    PUMP_B:       { tag:'N-PMP-B-01',label:'Pump B Speed',            sys:'Secondary', v:3185,   u:'RPM',         trip:3600, low:2800, vlt:5    },
    NEUTRON_FLUX: { tag:'F-NEUT-01', label:'Neutron Flux',            sys:'Primary',   v:3.42,   u:'e14 n/cm²·s', trip:4.0, low:2.5,  vlt:0.02 },
    FUEL_BURNUP:  { tag:'B-FUEL-01', label:'Fuel Burnup',             sys:'Primary',   v:24.7,   u:'GWd/t',       trip:60,   low:0,    vlt:0    },
    SG_INLET:     { tag:'T-SG-IN-01',label:'SG Inlet Temperature',    sys:'Secondary', v:480.2,  u:'°C',          trip:550,  low:420,  vlt:0.65 },
    STEAM_PRESS:  { tag:'P-STM-01',  label:'Steam Pressure',          sys:'Secondary', v:165.4,  u:'bar',         trip:180,  low:130,  vlt:0.28 },
    TURBINE_RPM:  { tag:'N-TRB-01',  label:'Turbine Speed',           sys:'Secondary', v:3000,   u:'RPM',         trip:3200, low:2800, vlt:3    },
    GRID_OUT:     { tag:'P-GRID-01', label:'Grid Electrical Output',  sys:'Grid',      v:478.2,  u:'MWe',         trip:510,  low:400,  vlt:0.4  },
    ROD_POS:      { tag:'R-ROD-AVG', label:'Control Rod Pos (avg)',   sys:'Safety',    v:72.4,   u:'%',           trip:95,   low:5,    vlt:0.08 },
    SCRAM_V:      { tag:'V-SCR-01',  label:'SCRAM Bus Voltage',       sys:'Safety',    v:48.2,   u:'V',           trip:0,    low:40,   vlt:0.04 },
    LEAD_LEVEL:   { tag:'L-PB-01',   label:'Lead Coolant Level',      sys:'Primary',   v:98.7,   u:'%',           trip:0,    low:90,   vlt:0.04 },
    SEC_FLOW:     { tag:'F-SEC-01',  label:'Secondary Flow Rate',     sys:'Secondary', v:2840,   u:'kg/s',        trip:3200, low:2400, vlt:3.5  },
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