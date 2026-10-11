# 🛡️ HeatGuard — Occupational Heat-Risk Intervention & Compliance System
> **Track:** Heat & Water • AI-Assisted Decision Support • AWS Cloud  
> **Built for:** WeMakeDevs Hackathon — Designed to Compete for 1st Place

[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![AWS](https://img.shields.io/badge/AWS-Bedrock%20%7C%20EventBridge%20%7C%20DynamoDB-232F3E?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/)
[![Standards](https://img.shields.io/badge/Standards-NIOSH%20%7C%20OSHA%20%7C%20Liljegren%20WBGT-10B981)](#)

---

## 🎯 The Core Innovation: Closing the Loop
Most environmental hackathon entries fail because they are **passive dashboards**—showing a red heat index map or sending a generic *"drink water"* push notification that workers and supervisors ignore.

Previous winning patterns (*Suraksha*, *Beacon Night Shift*, *CampusEvac*) succeed because they turn a hazard into an **actionable, human-in-the-loop closed loop**:

```
[ Real-Time Weather Stream ] + [ Site Workload Profile ]
               │
               ▼
   [ Scientific Liljegren WBGT Physical Engine ]
               │
               ▼
   [ Amazon Bedrock Constraint-Aware Optimizer ] ──► [ Concrete Schedule & Logistics Proposal ]
                                                                   │
                                                                   ▼
                                                   [ Supervisor Approval / Override ]
                                                                   │
                                           ┌───────────────────────┴───────────────────────┐
                                           ▼                                               ▼
                              [ Worker Field Directive ]                        [ Live Verification Feed ]
                               • Tamil / Hindi / English                         • 1-Tap Shade & Water Check-ins
                               • Web Speech API Readouts                         • Immutable EventBridge Stream
                               • Sunlight High-Contrast Mode                     • Exposure Hours Averted Metrics
```

---

## 🌟 Key Capabilities

### 1. Scientific Heat Physics vs. Generic Weather Apps
- **Generic Apps:** *"It is 38°C in Chennai. Drink water."* (Useless for construction managers facing pour deadlines).
- **HeatGuard:** Calculates **Wet-Bulb Globe Temperature (WBGT)** using the **Liljegren / Australian Bureau of Meteorology physical radiation formulation**:
  $$\text{WBGT}_{\text{outdoor}} = 0.7\,T_{nw} + 0.2\,T_g + 0.1\,T_a$$
  - Accounts for dry-bulb temperature, relative humidity, wind speed ($u$), and direct solar irradiance ($W/m^2$).
  - Maps against **NIOSH Publication No. 2016-106** occupational tables according to metabolic workload:
    - **Heavy (400W+)**: Rebar tying, concrete pouring, masonry.
    - **Moderate (300W)**: Gig delivery couriers, municipal street sweepers.
    - **Light (200W)**: Equipment operators, site gate controllers.

### 2. Constraint-Aware Intervention Optimizer
When WBGT exceeds the NIOSH Recommended Alert Limit, the engine doesn't just say *"stop work"*. It synthesizes actionable alternatives:
- **Strategy A (Temporal Shift):** Moves 2.5–3 hours of strenuous physical work to cooler morning windows (06:30–09:30 AM), avoiding peak heat spikes while preventing costly project delays.
- **Strategy B (Crew Split & Micro-Pacing):** Divides crew into Team Alpha and Team Beta with 30m work / 30m shaded rest rotations.
- **Strategy C (Active Cooling Surge):** Deploys industrial misting fans and cold neck vests on elevated viaducts.

### 3. Human-in-the-Loop Accountability
- **Approve & Broadcast:** Dispatches safety directives to workers with 1 tap.
- **Modify Parameters:** Customizes shift timing, break ratios (15m, 20m, 30m, 45m), and water quotas.
- **Reject with Exception Log:** Enforces mandatory logging of an operational reason (e.g. *"Chiller trucks active for concrete pour"*), generating an auditable compliance exception.

### 4. Zero-Friction Worker PWA (Sunlight-Engineered)
- **Zero Login:** Instant access via short link or QR code.
- **Multilingual:** Instant switch between **Tamil (தமிழ்)**, **Hindi (हिंदी)**, and **English**.
- **Voice Readout (Web Speech API):** Reads the safety alert aloud for workers with limited literacy.
- **1-Tap Actions:** *"✅ I am in the Shade & Hydrated"*, *"💧 Log 1 Glass Water (Target: 8/day)"*, and *"🚨 Report Heat Sickness / Dizziness"* (triggers instant supervisor alarm).
- **Sunlight High-Contrast Mode:** Inverts interface to ultra-high contrast black-on-white for direct outdoor sun readability.

### 5. Interactive Judge Evaluation Playground
Included directly on screen for hackathon evaluators:
- Live sliders for **Temperature (25–48°C)**, **Humidity (15–95%)**, **Solar Irradiance (200–1100 W/m²)**, and **Wind Speed (0.5–6 m/s)**.
- **🔥 Heat Spike Trigger:** Instantly simulates a critical 42.5°C heat wave to test real-time system reaction.
- **⚡ Stream Worker Acks:** Simulates progressive worker check-ins appearing live on the supervisor screen.
- **📶 Simulate Offline Mode:** Tests offline caching and background synchronization.
- **Split Demo Mode:** Side-by-side supervisor dashboard and worker mobile device.
- **OSHA/NIOSH Compliance Certificate Modal:** Printable legal safety audit document with cryptographic block hash.

---

## 🏗️ Architecture & AWS Cloud Integration

| Component | AWS Cloud Service | Function in HeatGuard |
|---|---|---|
| **API Layer** | Amazon API Gateway | Ingests sensor data & worker telemetry endpoints |
| **Compute** | AWS Lambda | Serverless execution of Liljegren WBGT math & NIOSH matrices |
| **AI Reasoning** | Amazon Bedrock (Claude 3.5 Sonnet) | Generates plain-language trade-offs & multilingual worker directives |
| **Event Pipeline** | Amazon EventBridge | Real-time event broker recording all safety decisions & acks |
| **Audit Ledger** | Amazon DynamoDB | Single-table storage for site profiles, worker rosters, and audit trails |
| **Alert Dispatch** | Amazon SNS | Broadcasts SMS and WhatsApp alerts to field personnel |
| **Hosting** | AWS Amplify / S3 + CloudFront | High-availability global edge delivery for PWA |

---

## 🚀 Quickstart & Demonstration

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation & Run
```bash
# Clone the repository
git clone https://github.com/your-team/heatguard.git
cd heatguard

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/) in your browser.

---

## ⏱️ 3-Minute Hackathon Pitch Script

| Time | Action on Screen | Voiceover Script |
|---|---|---|
| **0:00–0:30** | Show ambient temperature 39°C vs calculated WBGT 32.4°C | *"Weather apps tell 350 million outdoor workers it's hot. But they don't reschedule shifts, set up shade hubs, or verify if anyone rested. Today, heat illness costs thousands of lives. Meet HeatGuard."* |
| **0:30–1:00** | Click **"🔥 Heat Spike"** in Judge Playground | *"Here in our Chennai Metro site with 42 workers, WBGT spikes to 33.6°C. Our Liljegren physical engine flags severe risk—exceeding NIOSH limits by 3.1°C."* |
| **1:00–1:40** | Highlight Bedrock AI Intervention Card & Click **"Approve & Dispatch"** | *"Instead of just a red warning, our Amazon Bedrock engine proposes moving heavy rebar work to 6:30 AM and deploying 30-min shade rest cycles. The supervisor approves with one click, creating an immutable audit log."* |
| **1:40–2:20** | Switch to **"Worker PWA"** or **"Split Demo"** | *"Workers receive a zero-login link in Tamil or Hindi. Senthil in Chennai taps 'Listen Aloud' to hear instructions, then taps 'Verified in Shade & Hydrated'."* |
| **2:20–3:00** | Show live compliance ticking to 95% & Open **"Audit Certificate"** | *"Back on the dashboard, 42 workers are verified, averting 58 person-hours of dangerous heat exposure. HeatGuard turns passive climate data into verified human safety."* |

---

## 📜 Regulatory Standards Cited
- **NIOSH Publication No. 2016-106**: *Criteria for a Recommended Standard: Occupational Exposure to Heat and Hot Environments*
- **OSHA General Duty Clause Section 5(a)(1)**: *Mandatory protection from recognized heat-related hazards*
- **ACGIH Threshold Limit Values (TLVs)** for Work/Rest thermal stress evaluation
