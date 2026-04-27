# CORE-SENTINEL HMI — Project Memory (CLAUDE.md)
# InRebus DAO | LFR-4G Unit 4 | Nuclear Diagnostic Platform

## Project Context
- **Client:** newcleo (nuclear SMR startup)
- **Deliverable:** CORE-SENTINEL HMI for WP 1.6 (UI state-of-the-art) within the DAO project
- **Scope:** Lead-cooled Fast Reactor (LFR-4G) advanced diagnostic platform
- **Stack:** Pure Vite + Vanilla JS (ES Modules), Tailwind CSS (CDN), Three.js 3D twin — NO backend
- **Architecture:** MVI (Model-View-Intent), unidirectional data flow, immutable state
- **Persistence:** localStorage only (no server)

## Key Standards
- ISA-101.01 — High-Performance HMI (color palette, alarm management)
- NUREG-0700 Rev. 3 — Nuclear HMI design
- IEC 61511 SIL-2 — Functional Safety
- IEC 62443 — Cybersecurity
- ISA-5.1 — Tag naming (T-CORE-01, P-PRI-01, etc.)
- AAS IEC 63278 — Asset Administration Shell (submodel structure)
- OPC UA IEC 62541 — Data model for streaming

## ISA-101 Color Palette
- Background: `#f4f6f8`
- Alarm P1 (Critical): `#e31a1a`
- Alarm P2 (Urgent): `#d97d06`
- Alarm P3 (High): `#cd5c08`
- Nominal: `#159647`
- Neutral/Border: `#343a40`, `#495057`, `#6c757d`

## RBAC Roles
| Role | Label | Permissions |
|------|-------|-------------|
| OL | Local Operator | READ |
| OD | Diagnostic Operator | READ, UPDATE, SCRAM |
| AS | System Admin | READ, UPDATE, CREATE, DELETE, SCRAM, RESET_INTERLOCKS |

## Project Files

### Core Architecture
- `src/model.js` — Global state factory `mkModel()`, state export `S`
- `src/reducer.js` — Pure reducer `reduce(s,intent,p)`, `dispatch()`, RBAC guard
- `src/events.js` — DOM event bindings, `startDataLoop()`, `showModal()`
- `src/dao.js` — Sensor abstraction (SIMULATED/PHYSICAL), 16 sensors
- `constants/actionTypes.js` — Frozen `ACTION_TYPES` constants

### Views
- `src/views/render.js` — Main render dispatcher `render(s)`
- `src/views/render-config.js` — SCR-14 Config Panel (CMP-24)

### Configuration Layer (Requirement WP 1.2 / WP 1.3)
- `src/config-service.js` — ConfigService singleton (localStorage, AAS submodels, versioning)
- `hmi-config.json` — Seed configuration v4.2 (sensors, roles, alarmManagement, security, standards)

### Other
- `src/component-registry.js` — 24 components (CMP-01..CMP-24) with RBAC access matrix
- `src/rbac-factory.js` — `RBACContext`, `bindGuardedButton()`
- `src/scenario-engine.js` — Demo scenario runner
- `utils.js` — `ts()`, `mkEntry()`, `setText()`, `escHtml()`, `dlFile()`
- `index.html` — Full HTML structure

## 16 Sensors (DAO._s)
| Key | Tag | System | Unit |
|-----|-----|--------|------|
| CORE_TEMP | T-CORE-01 | Primary | °C |
| COOLANT_IN | T-CL-IN-01 | Primary | K |
| COOLANT_OUT | T-CL-OUT-01 | Primary | K |
| PRIM_PRESS | P-PRI-01 | Primary | PSI |
| PUMP_A | N-PMP-A-01 | Primary | RPM |
| PUMP_B | N-PMP-B-01 | Secondary | RPM |
| NEUTRON_FLUX | F-NEUT-01 | Primary | e14 n/cm²·s |
| FUEL_BURNUP | B-FUEL-01 | Primary | GWd/t |
| SG_INLET | T-SG-IN-01 | Secondary | °C |
| STEAM_PRESS | P-STM-01 | Secondary | bar |
| TURBINE_RPM | N-TRB-01 | Secondary | RPM |
| GRID_OUT | P-GRID-01 | Grid | MWe |
| ROD_POS | R-ROD-AVG | Safety | % |
| SCRAM_V | V-SCR-01 | Safety | V |
| LEAD_LEVEL | L-PB-01 | Primary | % |
| SEC_FLOW | F-SEC-01 | Secondary | kg/s |

## Configuration Layer Architecture (WP 1.3 Implementation)

### AAS Submodels (ConfigService)
- `session` — timeout, warn timings
- `dataLoop` — scan rates
- `roles` — RBAC role definitions
- `measures` — sensor setpoints (tripHigh/tripLow/nominalHigh/unit/priority) ← KEY
- `devices` — device registry (tag, label, sys, manufacturer, protocol)
- `streams` — data stream definitions (STREAM-PRIM, STREAM-SEC, STREAM-SAFETY, STREAM-GRID)
- `taxonomy` — LFR plant hierarchy tree
- `alarmManagement` — flood suppression, colors, shapes
- `security` — encryption suite
- `standards` — applicable standards

### Versioning
- djb2 hash-based version IDs
- Full snapshot per version (max 50)
- Audit trail per change (who/what/when)
- Rollback to any version
- CustomEvent `dao:config:updated` for live reload without page refresh

### SCR-14 (panel-config) — AS Role Only
- Tab 1: Overview (version info, export/import/reset)
- Tab 2: Taxonomy (plant hierarchy tree)
- Tab 3: Devices (device registry table)
- Tab 4: Measures (inline threshold editor — THE KEY TAB)
- Tab 5: Streams (stream definitions)
- Tab 6: Version History (timeline + diff + rollback)

## KPIs & Use Cases (from D1.1.1_OR1_WP1.2_2.xlsx)
- UC-ACG-001: Configure multisensor acquisition
- UC-ALR-001: Configure alarm thresholds
- REQ-ACG-001-01: Platform supports ≥8 configurable sensors
- KPI-ACG-001-01-1: ≥8 sensors verified (currently 16)

## Research Key Findings (research 1.0.pdf)
- Recommends: AAS + OPC UA + Protocol Buffers
- Architecture: MFE + MVI pattern
- Future: gRPC for backend, WebSockets for streaming
- Current: localStorage as proxy for AAS registry
