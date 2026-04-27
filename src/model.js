import { DAO } from './dao.js';
import { ts } from '../utils.js';
// ═══════════════════════════════════════════════════════════════════

// ── XSS escape utility (WCAG / security best practice) ──────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

export const mkModel = () => ({
  role:         null,
  sessionStart: null,
  lastActivity: null,
  activePanel:  'panel-primary',

  alarms: [
    { id:'A001', p:1, tag:'P-PRI-01', msg:'Sub-Valve 04-B pressure delta +14.2 PSI vs simulation', acked:false, ts:ts() },
    { id:'A002', p:2, tag:'P-STM-01', msg:'Secondary steam pressure trending +0.4 bar/min',        acked:false, ts:ts() },
  ],
  bannerOn: true,

  sensors: DAO.snapshot(),

  controlRods: Array.from({length:8}, (_, i) => ({
    id:`ROD-${String(i+1).padStart(2,'0')}`, pos:68 + Math.random()*9, st:'NORMAL',
  })),

  interlocks: [
    { id:'I001', label:'Hi-Hi Core Temp Trip',   tag:'T-CORE-01', st:'ARMED',   sp:'1200°C'   },
    { id:'I002', label:'Lo Primary Flow Trip',   tag:'F-PRI-01',  st:'ARMED',   sp:'2400 kg/s'},
    { id:'I003', label:'Hi Primary Pressure',    tag:'P-PRI-01',  st:'ARMED',   sp:'250 PSI'  },
    { id:'I004', label:'Hi Neutron Flux Trip',   tag:'F-NEUT-01', st:'ARMED',   sp:'4.0e14'   },
    { id:'I005', label:'Node Gamma ERV',         tag:'V-ERV-01',  st:'OFFLINE', sp:'Auto'     },
    { id:'I006', label:'SCRAM Bus Undervoltage', tag:'V-SCR-01',  st:'ARMED',   sp:'< 40 V'   },
  ],

  scramActive:  false,
  protocolStep: 2,
  autoPilot:    false,

  histTemp:  Array(20).fill(null).map(() => 1045 + (Math.random()-0.5)*20),
  histPress: Array(20).fill(null).map(() => 215  + (Math.random()-0.5)*8),

  auditLog: [],
  auditPanelOpen: false,
  demoMode: false,

  // SCR-14 Platform Configuration Manager (CMP-24) — AS only
  configActiveTab: 'overview',
});


export let S = mkModel();
export function setS(val) { if(val) S = val; }
