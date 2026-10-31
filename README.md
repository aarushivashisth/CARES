# CARES — Healthcare Navigation & Appointment Platform

CARES is an integrated full-stack healthcare coordination platform designed to empower patients, healthcare providers, institutional facilities, and health system administrators. It combines verified doctor discovery, institutional facility directories, appointment requests and lifecycle coordination, provider credentialing workflows, and administrative audit trails.

---

## 1. Architecture & current status

React/Vite frontend and Express Node 24 backend are configured as independently built services in one Vercel project, with managed PostgreSQL. Public `/api` routes go to `backend`; other paths go to `frontend`. Python in `ml/` is offline training; current inference and retrieval run inside the backend. Service names, public paths, and whether to introduce a separate Python inference service are pending owner confirmation. Local SQLite development remains supported with an explicitly selected disposable file. No protected live SQLite database has been opened or migrated. No deployment has been performed.

Implemented additions: persistent Care at Home enquiries and administrator review; source-qualified emergency contacts and unknown hours; doctor application/clarification sessions; real trained specialty-intent prototype; local vector retrieval with a real backend Anthropic integration; controlled directory/private appointment lookups; async PostgreSQL adapter, versioned migrations and shared rate limits.

**Release gates:** managed PostgreSQL network/restore validation, owner-approved Vercel preview, real LLM credentials/budget and live answer-quality evaluation. CareMatch uses 80 synthetic explicit-intent examples, not clinically validated symptom mapping. Home-care enquiries are not confirmed bookings.

- [Architecture and diagrams](docs/ARCHITECTURE.md)
- [Implementation tracker and gap matrix](docs/IMPLEMENTATION_TRACKER.md)
- [Executed test evidence](docs/TEST_EVIDENCE.md)
- [ML/RAG methods and actual results](docs/AI_EVALUATION.md)
- [Deployment and recovery guide](docs/DEPLOYMENT_GUIDE.md)
- [Capstone report](docs/CAPSTONE_REPORT.md)
- [Owner actions](MANUAL_ACTIONS_REQUIRED.md)

## 2. Prerequisites

- **Node.js:** v24.x (required; includes the local node:sqlite runtime).
- **npm:** v9.0.0 or higher.
- **Operating System:** Windows, macOS, or Linux.
- **SQLite:** Embedded SQLite runtime (no external database server installation required).

---

## 3. Safe Local Setup Instructions

### Step 1: Install Dependencies
Run npm installation from the repository root, which installs both root and workspace dependencies:

```bash
# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### Step 2: Configure Environment Variables
Copy the provided safe environment templates. **Never commit real `.env` files to version control.**

```bash
# Root template
# Root .env is not loaded; use the backend template below

# Backend template
cp backend/.env.example backend/.env

# Frontend template
cp frontend/.env.example frontend/.env
```

Review [`.env.example`](.env.example), [`backend/.env.example`](backend/.env.example), and [`frontend/.env.example`](frontend/.env.example) for documentation of each variable.

---

## 4. Starting the Application

For Vercel Services development, run `vercel dev` from the repository root. Use `vercel dev --local` to test without cloud linking. Vercel owns the shared frontend/API routing; service bindings, when declared for server-side callers, are injected at function runtime and must not be manually set or exposed as `VITE_*` variables.

### Development Mode (Concurrent)
Open two terminal windows from the repository root:

**Terminal 1 — Backend REST API:**
```bash
npm run start:backend
# Starts Express server at http://localhost:5000
```

**Terminal 2 — Frontend Client:**
```bash
npm run start:frontend
# Starts Vite dev server at http://localhost:5173
```

---

## 5. Environment Variables & Secret Enforcement

| Variable | Scope | Required in Prod | Purpose / Default |
| :--- | :--- | :---: | :--- |
| `PORT` | Backend | No | Server port (default: `5000`) |
| `NODE_ENV` | Backend | **Yes** | `development`, `production`, or `test` |
| `JWT_SECRET` | Backend | **Yes** | Signing key. **In production, server strictly refuses to start if missing, blank, fallback, or <32 characters.** |
| `JWT_EXPIRES_IN`| Backend | No | Token lifetime (default: `7d`) |
| `DATABASE_PATH` | Local backend | No | Explicit new disposable SQLite file; protected default access is refused |
| `DATABASE_URL` | Backend/Vercel | **Yes** | Durable pooled PostgreSQL URL; production TLS uses sslmode=verify-full |
| `LLM_PROVIDER` | Backend only | For generation | `gemini` for the free-tier demo; `anthropic` remains supported |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Backend only | Key **secret**, model public | Gemini configuration; never expose in Vite |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Backend only | Optional alternative | Existing Anthropic configuration; never expose in Vite |
| `TRUST_PROXY` | Backend | Contextual | Reverse proxy trust (bounded hop count such as `1`; production rejects blanket `true`). Required when behind TLS-terminator. |
| `CLIENT_ORIGIN` | Backend | No | Allowed frontend origin for CORS (default: `http://localhost:5173`) |
| `VITE_API_URL` | Frontend | No | Public base URL, default `/api`; never put secrets here |

---

## 6. Verification & Quality Commands

```bash
# Run both test suites in one command (fails if either suite fails)
npm test

# Run backend integration tests only (uses isolated test database)
npm run test:backend

# Run frontend component tests only
npm run test:frontend

# Run frontend ESLint checks
npm run lint

# Build production bundle for frontend
npm run build
```

---

## 7. Database Safety & Command Safety Classification

> [!CAUTION]
> **LIVE DATABASE SAFETY GUARD:** The live database resides at `backend/data/cares.db`. NEVER delete, reseed, initialize, or run migrations against this database on an existing working copy.

### Command Classification

| Command | Safety Classification | Description |
| :--- | :--- | :--- |
| `npm test` | **SAFE** | Creates a new temporary SQLite database and a disposable PostgreSQL engine; no existing test database is reused. |
| `npm run lint` | **SAFE** | Read-only static analysis on source files. |
| `npm run build` | **BUILD OUTPUT** | Generates ignored production files in `frontend/dist/`. |
| `npm run start:*` | **DATABASE ACCESS** | Local startup initializes schema; use an explicitly selected disposable file. Protected access is refused by default. |
| `npm run db:init` | **DESTRUCTIVE** | **DO NOT RUN against existing copy.** Creates or resets tables. |
| `npm run db:seed` | **DESTRUCTIVE** | **DO NOT RUN against existing copy.** Creates synthetic records only in a new file; refuses existing nonempty databases. |
| `node src/scripts/importLocalProviders.js` | **DATABASE MUTATION** | Provider import pipeline. |

---

## 8. Demo Roles & Verified Accounts

The isolated synthetic demo fixture creates the following fictional accounts. They are never production bootstrap accounts or evidence of real credentials:

| Role | Email | Password | Entity / Person Represented | Status / Access |
| :--- | :--- | :--- | :--- | :--- |
| **System Administrator** | `admin@cares.org` | `Admin@12345` | Platform Governance | Full audit logs, credential verification queue |
| **Patient** | `patient@cares.org` | `Patient@12345` | Ananya Sharma | Profile editing, appointment booking & cancellation |
| **Synthetic Doctor** | `dr.maya@cares.org` | `Doctor@12345` | Dr. Maya Bennett (Primary Care) | Practice settings, schedule availability, appointment triage |
| **Synthetic Doctor** | `dr.daniel@cares.org` | `Doctor@12345` | Dr. Daniel Park (Cardiology) | Synthetic verification flags and appointment workflow |
| **Hospital Manager** | `hospital@riverside.org` | `Hospital@12345` | Riverside Community Health Center | Facility profile editing, clinician roster affiliation |

---

## 9. Step-by-Step Demonstration Script

### Walkthrough 1: Public Visitor (No Login Required)
1. Navigate to `http://localhost:5173/`.
2. Inspect the landing page, emergency notices, and service cards.
3. Click **"Explore doctors"** (`/doctors`) to search clinicians by name, specialty, or city. Observe verified badges (`✓ Verified`) and registration council details.
4. Click **"View hospital insights"** (`/hospitals`) to search facilities, filter by emergency availability, and inspect clinical departments. Real public institutions display source attribution without simulated wait times.
5. Click into a doctor profile (`/doctors/1`). Observe that booking controls prompt for patient authentication.

### Walkthrough 2: Patient Journey
1. Navigate to `/login` and log in with `patient@cares.org` / `Patient@12345`.
2. You will be redirected to the Patient Portal (`/patient/dashboard`).
3. Click **"Edit Profile Details"** to open the accessible profile modal. Test keyboard accessibility:
   - Notice focus automatically moves to the first field.
   - Press `Tab` and `Shift+Tab` to verify focus trapping.
   - Press `Escape` to dismiss the modal and confirm focus returns to the button.
4. Browse to `/doctors/1` (Dr. Maya Bennett).
5. Select an available slot in the booking panel (e.g., a future date/time) and submit an appointment request.
6. Return to `/patient/dashboard` to verify the request appears with status `Pending`.
7. Test cancellation: click **"Cancel Request"** and confirm status updates to `Cancelled`.

### Walkthrough 3: Doctor Journey
1. Log out, then log in with `dr.maya@cares.org` / `Doctor@12345`.
2. On `/doctor/dashboard`, inspect the triage list:
   - Accept or decline incoming patient appointments.
   - Add clinical notes to accepted requests.
   - Mark completed consultations.
3. Scroll to **Practice Profile & Availability**:
   - Update consultation fees, languages, and wheelchair accessibility.
   - Adjust intake status (`Accepting New Patients` toggle).
   - Edit available booking time slots.
4. Save changes and confirm audit notification feedback.

### Walkthrough 4: Hospital Facility Manager Journey
1. Log out, then log in with `hospital@riverside.org` / `Hospital@12345`.
2. On `/hospital/dashboard`:
   - Inspect facility verification status and emergency department indicators.
   - Click **"Edit Facility Info ✎"** to modify phone, address, or operating hours.
   - View affiliated physicians roster.
   - Affiliate a new doctor from the registered pool using the dropdown.

### Walkthrough 5: System Administrator Journey
1. Log out, then log in with `admin@cares.org` / `Admin@12345`.
2. On `/admin/dashboard`:
   - Review platform metrics (registered users by role, verification queue size).
   - Review **Credential Verification Queue**: review submissions, request clarification, or approve credentials.
   - Notice self-approval prohibition if an admin's own record appears.
   - Review the recorded **Administrative & Security Audit Trail** recording all availability changes, status updates, and credential decisions.

---

## 10. Known limitations and owner gates

- Managed PostgreSQL TLS/pooling, distributed rate limits, backup/restore and actual Vercel routing require owner-approved staging verification.
- LLM credentials and billing approval are unavailable; live generation, faithfulness, usefulness and cost are unmeasured. Local retrieval and mocked citation contracts are separately tested.
- CareMatch is a small synthetic explicit-specialty prototype, not a clinically validated symptom classifier.
- Bearer tokens remain in localStorage for compatibility. Logout clears the browser token; a copied token remains valid until expiration or account suspension.
- Phone information is sourced, but calls, capacity, ambulances and provider availability are not monitored by CARES.
- Automated Chromium desktop/mobile checks do not replace independent screen-reader, additional-browser or clinical/privacy review.

## 11. Production deployment

Use the [current Vercel Services quickstart](docs/VERCEL_QUICKSTART.md), [PostgreSQL operations guide](docs/DEPLOYMENT_GUIDE.md) and [manual checklist](MANUAL_ACTIONS_REQUIRED.md). `backend/index.js` exports Express without a listener, initialization or seeding. SQLite files cannot provide durable storage in Vercel Functions. Create isolated managed databases and apply reviewed versioned SQL explicitly; never point a preview at production.

For the current Supabase-backed demo with sample data, follow the [Vercel dashboard quickstart](docs/VERCEL_QUICKSTART.md), including the deployed certificate path and exact environment settings.

Do not commit, push, deploy publicly, create billable services or transfer existing records without owner approval. No existing records are imported by setup or migration commands. A schema-only dry-run plan is in `docs/DATA_MIGRATION_DRY_RUN.json`.

## 12. Safe isolated demonstration and AI reproduction

```sh
npm run build
node backend/src/scripts/startIsolatedDemo.js
# Open http://127.0.0.1:4173; Ctrl-C cleans the newly created synthetic database.
```

The fixture uses labeled synthetic seed accounts, suitable only for local evaluation. Do not expose it publicly. Alternatively, copy `backend/.env.example` privately, choose a newly named `DATABASE_PATH`, seed that new file once if desired, and start the local backend/frontend. The backend loads `backend/.env`; root `.env` is not auto-loaded. Vite proxies `/api` locally.

```sh
npm --prefix frontend exec playwright install chromium
npm --prefix frontend run test:e2e
npm --prefix backend run knowledge:build
npm --prefix backend run evaluate:ai
```

For offline training, create a Python virtual environment, install `ml/requirements.txt`, then run `python ml/train.py`. This exports the trained Node JSON model and actual evaluation/parity files. Current held-out macro-F1: logistic regression 0.667619, two-layer MLP 0.670000, on only 15 synthetic examples. See the evaluation document for class metrics, confusion matrix, limitations and latency scope.

For the Gemini demo, privately configure `LLM_PROVIDER=gemini`, `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-3.5-flash-lite` in `backend/.env`. The existing Anthropic path remains available with `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`. Without the selected provider key/model the Navigator reports unavailability. Retrieval and structured lookups still operate. Do not present mocked provider tests as real generation. The owner-run live evaluation command is `node backend/src/scripts/evaluateLiveNavigator.js --authorize-live-evaluation`; it requires explicit live-evaluation authorization and private configuration, plus budget approval for any paid account, and saves unscored human-review fields. It has not been executed here.

## Gemini free-tier configuration update

Gemini transport is implemented with header-only key authentication, 15-second timeout, bounded JSON Schema output, the existing source/citation validator and no automatic cross-provider fallback. The recommended demo model is listed with free-tier input/output on [Google pricing](https://ai.google.dev/gemini-api/docs/pricing), checked 2026-10-29; account eligibility and quotas still control actual access/cost. Do not enable paid billing for a free-only demo. Use synthetic non-sensitive service questions because free-tier content may be used to improve Google products.

The owner reported creating a Gemini key. No `backend/.env` or configured Gemini key was present during the local setup check, so no live provider request was made. Copy `backend/.env.example` to `backend/.env` privately and enter the key there; never put it in chat, frontend variables, Git or screenshots. Restart the backend after configuration.

## Sample data for an approved development PostgreSQL database

After configuring verified TLS and applying migrations 001–003, an owner-authorized development sample import is available:

```sh
npm --prefix backend run db:sample:postgres -- --confirm-sample-data
```

This separate PostgreSQL command adds six fictional accounts, one patient, three doctors, one hospital, one future appointment, one home-care enquiry and one pending doctor application. It preserves existing records, refuses conflicting sample identities, rolls back on failure and skips an already imported dataset. It refuses production mode. It does not read or modify SQLite databases.

Random demo passwords are saved only in `backend/.sample-accounts.json`, with owner-only file permissions. That file is excluded from Git and Vercel uploads. Accounts use `demo.admin@example.com`, `demo.patient@example.com`, `demo.maya@example.com`, `demo.daniel@example.com`, `demo.sofia@example.com` and `demo.hospital@example.com`. Sofia uses application-status sign-in until an administrator reviews the fictional application. The SQLite fixture credentials listed earlier do not apply to this PostgreSQL dataset.

Providers and the patient are explicitly marked synthetic. Provider names include “Demo”; registration numbers start with `DEMO-`, and no real credentials, emergency coverage or verification are asserted.
