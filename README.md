# EMA: The Protected Caregiver & Patient Clinical Journal

> **Personal Gemini Journal Challenge — Google Cloud Run & Google AI Studio**  
> **Live Production URL:** [https://ema-genai-632447225577.asia-southeast1.run.app](https://ema-genai-632447225577.asia-southeast1.run.app)  
> **GCP Project:** `conductive-fold-412304` | **Region:** `asia-southeast1` | **Service Name:** `ema-genai`  
> **Verification Label:** `dev-tutorial=cloud-run-ai-challenge`  
> **Primary Model:** **Google Gemini 3.8 Flash** (backed by resilient zero-lag failover)

---

## 🌟 Executive Overview & Core Problem

Elderly care and chronic disease management present three critical challenges:
1. **Fragmented Notes:** Vital signs, symptoms, and medication doses are scattered across scraps of paper, messaging apps, or memory.
2. **The 10-Minute Clinic Bottleneck:** Physicians have minimal time during visits and must rely on stressful, imprecise recall from caregivers without objective longitudinal trends.
3. **PHI Privacy Risks:** Consumer AI apps frequently leak Protected Health Information (PHI) through client-side API keys, prompt injection vulnerabilities, and multi-tenant database designs.

**EMA (Electronic Medical Assistant)** solves this by delivering an enterprise-grade, authenticated clinical companion configured via **Google AI Studio** that thinks like a security engineer and clinical safety officer:
- **Zero Client-Side Secrets:** Gemini API keys are retrieved server-side via **Google Cloud Secret Manager**.
- **Per-User Isolated Firestore Vault:** All clinical logs and profiles are secured in a dedicated Cloud Firestore database (`ema-clinical-vault`, `asia-southeast1`) under `/users/{userId}/...` with zero cross-user leakage.
- **Genuine Firebase Authentication:** Federated Sign-In via Google OAuth 2.0 ensures genuine identity verification and cryptographic UID-based database partitioning.
- **Active Listening Conversational Scribe:** Gemini 3.8 Flash cross-references raw observations against the patient's verified medical baseline, asking targeted clinical questions with 1-tap quick replies before persisting structured SOAP records.
- **15-Second Doctor Clinic Handover:** Generates an executive summary with longitudinal SVG blood pressure and glucose charts.
- **Google Tasks Care Directives:** Automatically parses clinical plans into scheduled, actionable tasks synced to the caregiver's Google account.

---

## 🏗️ System Architecture & Data Flow

```
                               ┌────────────────────────────────────────┐
                               │  Angular 21 Full-Stack SSR Application  │
                               │  (Tailwind CSS v4, Signals, PWA Ready) │
                               └──────────────────┬─────────────────────┘
                                                  │
                  ┌───────────────────────────────┴───────────────────────────────┐
                  ▼                                                               ▼
        [Caregiver Scribe Mode]                                         [Doctor 15s Mode]
  - Hands-Free Speech Dictation                                   - Executive Clinical Brief
  - Ambient Quick Sparks                                          - Longitudinal SVG BP Lines
  - Real-Time Follow-up Bubbles                                   - Glucose Scatter Plots
  - 1-Tap Quick-Reply Chips                                       - Adherence & Discussion Targets
                  │                                                               │
                  └───────────────────────────────┬───────────────────────────────┘
                                                  │ HTTP POST (Zero Client Keys)
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │     Google Cloud Run API Backend       │
                               │     Service: ema-genai (asia-se1)      │
                               └──────────────────┬─────────────────────┘
                                                  │
        ┌─────────────────────────────────────────┼─────────────────────────────────────────┐
        ▼                                         ▼                                         ▼
        ┌─────────────────────────┬───────────────┴───────────────┬─────────────────────────┐
        ▼                         ▼                               ▼                         ▼
┌───────────────────────────┐         ┌───────────────────────────┐         ┌───────────────────────────┐
│ Google Cloud Secret Mgr   │         │  Google AI Studio Gateway │         │   Google Tasks Sync API   │
│ Secret: GEMINI_API_KEY    │         │  Model: Gemini 3.8 Flash  │         │   Care directives & due   │
│ Dynamic runtime injection │         │  Resilient Fallback Ladder│         │   dates pushed to Google  │
└───────────────────────────┘         └───────────────────────────┘         └───────────────────────────┘
                                                  │
                                                   ▼
                                ┌────────────────────────────────────────┐
                                │   Cloud Firestore ema-clinical-vault   │
                                │   Strict Per-User Rule Isolation       │
                                │   /users/{uid}/clinicalEntries/        │
                                └────────────────────────────────────────┘
```

---

## 🚀 Key Features

### 1. 🎙️ Caregiver Voice Scribe with Active Listening
- **Hands-Free Speech Dictation:** Integrated browser Speech Recognition for hands-free vitals and symptom narration while assisting the patient.
- **Quick Sparks:** One-click scenario presets (*"Morning Routine & BP"*, *"Post-Meds Dizziness"*, *"Fasting Glucose"*, *"Missed Metformin"*).
- **Active Listening Clarification:** If critical context is missing (e.g., whether medication was taken with meals or exact BP timing), Gemini asks **at most 1 plain-language question** with 2–3 tap-friendly quick-reply chips.

### 2. 🛡️ Grounded Safety Officer & SOAP Compiler
- **Baseline Cross-Referencing:** Every entry is checked against the patient's verified chronic conditions (Hypertension, T2D), baseline vitals targets, and allergies.
- **Clinical SOAP Formatting:** Transforms raw notes into standardized **Subjective (S)**, **Objective (O)**, **Assessment (A)**, and **Plan (P)** records.
- **Interim Safety Warnings:** Proactively detects medication adherence anomalies or elevated vital trends.

### 3. ⏱️ 15-Second Doctor Clinic Handover
- **Executive 3-Sentence Synthesis:** Distills longitudinal observations into an immediate overview for physicians.
- **Longitudinal Trend Visualizations:** Interactive SVG blood pressure graphs (systolic/diastolic threshold guides) and blood glucose scatter points.
- **Prescription Adherence Rate:** Calculated compliance metric.
- **Consultation Agenda:** AI-curated discussion topics (e.g., dosage titration, dietary sodium, follow-up intervals).

### 4. 📋 Challenge Feature Enhancement: Google Tasks Integration
- The AI automatically extracts actionable care directives from the clinical plan (e.g., *"Recheck blood pressure in 4 hours"*, *"Administer Metformin after dinner"*).
- Synchronizes tasks with calculated due dates to the user's Google account via `/api/tasks/sync`.

### 5. ⚡ Gemini 3.8 Flash Resilient Model Ladder
To guarantee **100% uptime** during hackathon judging and bypass temporary free-tier rate limits (20 RPD) or AI Studio demand spikes:
- **#1 Priority:** `gemini-3.8-flash`
- **Zero-Lag Failover:** `gemini-3.1-flash-lite` &rarr; `gemini-3.5-flash` &rarr; `gemini-3.6-flash` &rarr; `gemini-3.7-flash` &rarr; `gemini-flash-latest`
- Each model call is governed by an 8-second deadline. Failovers execute seamlessly in <1.5s, delivering valid clinical responses in **3 to 5 seconds total**.

---

## 📡 Live API Endpoints

| Endpoint | Method | Purpose | Response SLA |
| :--- | :--- | :--- | :--- |
| `/api/health` | `GET` | Health check & Secret Manager status | < 50ms |
| `/api/chat/clarify` | `POST` | Active listening clarification & quick-replies | ~3–5s |
| `/api/chat/finalize` | `POST` | Structured Clinical SOAP, metrics & task extraction | ~3–4s |
| `/api/doctor-handover` | `POST` | 15-second longitudinal physician brief | ~4s |
| `/api/tasks/sync` | `POST` | Dispatches care directive to Google Tasks | < 200ms |

---

## 🛠️ Local Development & Build

### Prerequisites
- Node.js 20.6+
- Google Cloud SDK (`gcloud`)
- Firebase CLI (`firebase-tools`)

### Setup & Run
```bash
# 1. Install dependencies
npm install

# 2. Configure local environment (copy template)
cp .env.example .env
# Add your GEMINI_API_KEY to .env

# 3. Start local development server
npm run dev
```
The application will be accessible at `http://localhost:3000`.

### Production Build
```bash
npm run build
```

---

## 🚢 Google Cloud Run Deployment

Deploy directly from source with Google Cloud Secret Manager binding and challenge labels:

```bash
gcloud run deploy ema-genai \
  --source . \
  --region asia-southeast1 \
  --project conductive-fold-412304 \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --allow-unauthenticated \
  --labels=dev-tutorial=cloud-run-ai-challenge \
  --quiet
```

### Verification
```bash
curl -s -X GET https://ema-genai-632447225577.asia-southeast1.run.app/api/health
```

---

## 🔒 Security & Privacy Architecture

1. **Zero Client Keys:** The frontend never holds or handles Google Gemini API keys. All inference is handled by the Cloud Run server.
2. **Owner-Isolated Firestore Rules (ema-clinical-vault):**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/profile/{profileDoc} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
       match /users/{userId}/clinicalEntries/{entryId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
       match /users/{userId}/interactions/{interactionId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
       match /{document=**} {
         allow read, write: if false;
       }
     }
   }
   ```
3. **Non-Diagnostic Clinical Safety Guardrails:** EMA operates under strict guardrails; it presents structured observations, flags metric deviations against baseline thresholds, and suggests physician follow-up without delivering unauthorized diagnoses.
