# CORE-SENTINEL HMI — Reactor Control & Digital Twin
> **ISA-101 / NUREG-0700 Compliant High-Performance HMI for InRebus DAO LFR-4G Unit 4**

![Version](https://img.shields.io/badge/version-4.3.0-blue.svg)
![License](https://img.shields.io/badge/license-PROPRIETARY-red.svg)
![Standards](https://img.shields.io/badge/compliance-ISA--101%20|%20NUREG--0700%20|%20IEC--61511-green.svg)

CORE-SENTINEL is a mission-critical High-Performance HMI logic layer designed for the Fourth-Generation Lead-Cooled Fast Reactor (LFR). It utilizes a professional **Model-View-Intent (MVI)** architecture to provide deterministic, auditable, and role-guarded control over reactor telemetry and safety systems.

---

##  Key Modules & Features

###  3D Digital Twin Integration
Real-time synchronization with the reactor core via Three.js. Provides operators with a high-fidelity visual representation of control rod positions, coolant flow patterns, and thermal gradients.
###  Safety-Critical RBAC Guards
Unconditional Enforcement of **ISA-101 §6.5** security guards. Critical operations (SCRAM, Interlock Reset) are hard-bound to specific roles (Operation Director, System Admin) at the state-machine level, preventing unauthorized or accidental triggers.

###  Emergency Scenario Engine
A built-in physics simulation for stress-testing and training. High-fidelity simulation of LOCA (Loss of Coolant), Station Blackout, and Thermal Escalation scenarios with autonomous AI advisory integration.

###  Smart Alarm Management
Fully compliant with **ISA-101 §5**:
*   **First-Out Tracking**: Automatically identifies the root cause in an alarm cascade.
*   **Intelligent Shelving**: Suppression of nuisance alarms during maintenance or known transients.
*   **Audit Trail**: 100% logging of every alarm transition and operator acknowledgment.

---

## 📁 Project Architecture

```
hmi/
├── src/
│   ├── main.js             # Application entry point & service initialization
│   ├── reducer.js          # Central MVI state machine (The Brain)
│   ├── model.js            # Immutable state definition
│   ├── events.js           # Event delegation & binding logic
│   ├── scenario-engine.js  # Emergency procedure simulation logic
│   ├── three-twin.js       # 3D Digital Twin (Three.js) synchronization
│   ├── dao.js              # Data Access Object (Sensor Simulation/API)
│   └── views/              # Pure high-performance render functions
├── constants/
│   └── actionTypes.js      # Type-safe intent constants (No Magic Strings)
├── tests/
│   └── reducer.test.js     # Headless Vitest suite (System Validation)
├── rbac-factory.js         # Role-based component factory & guards
├── utils.js                # Shared industrial utilities (timestamps, formatting)
└── index.html              # High-Performance HMI shell
```

---

## 🛠 Operation & Deployment

### Development Environment
```bash
npm install   # Install industrial dependencies
npm run dev   # Launch Vite HMR server (http://localhost:3000)
```

### System Validation (Headless)
Run the automated test suite to verify all ISA-101 logic gates and RBAC barriers.
```bash
npm test
```

### Production Build (Air-Gapped)
Generates a minified, self-contained bundle in `/dist` for deployment on isolated industrial networks.
```bash
npm run build
```

---

## 🔐 Permission Access Matrix

| Feature / Action | OL | OD | AS |
|:---|:---:|:---:|:---:|
| **Navigation & Monitoring** | ✅ | ✅ | ✅ |
| **Alarm Acknowledgment** | ✅ | ✅ | ✅ |
| **Emergency Scenario Control** | ❌ | ✅ | ✅ |
| **SCRAM / Shutdown** | ❌ | ✅ | ✅ |
| **Interlock Manual Reset** | ❌ | ❌ | ✅ |
| **Cybersecurity Configuration** | ❌ | ❌ | ✅ |

> **OL**: Local Operator · **OD**: Operations Director · **AS**: Authorized Supervisor

---

## 🗺️ Path to Real-World Connectivity
The system is currently configured for high-fidelity simulation. For instructions on connecting to live PLCs or SCADA gateways, refer to the **[RECOVERY_AND_ROADMAP.md](./RECOVERY_AND_ROADMAP.md)**.

---
*CORE-SENTINEL HMI v4.3.0 · InRebus DAO · Strictly Proprietary & Confidential*
