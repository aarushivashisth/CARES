# CARES — Healthcare Navigation & Appointment Platform

CARES is an integrated full-stack healthcare coordination platform designed to empower patients, healthcare providers, institutional facilities, and health system administrators. It combines verified doctor discovery, institutional facility directories, real-time appointment booking and lifecycle coordination, provider credentialing workflows, and administrative audit trails.

---

## 1. Architecture & Technology Stack

```
                          ┌────────────────────────────┐
                          │   React 19 / Vite Client   │
                          │   (Vanilla CSS, SPA Router)│
                          └─────────────┬──────────────┘
                                        │ HTTP / JSON (REST)
                                        │ JWT Bearer Auth
                                        ▼
                          ┌────────────────────────────┐
                          │     Node.js / Express      │
                          │   REST API & Security Core │
                          └─────────────┬──────────────┘
                                        │ Database Driver
                                        ▼
                          ┌────────────────────────────┐
                          │    SQLite Database Engine  │
                          │   (cares.db / test.db)     │
                          └────────────────────────────┘
```

- **Frontend (`frontend/`):** React 19, Vite, React Router v7, Context API for authentication state, Vanilla CSS design system.
- **Backend (`backend/`):** Node.js 18+, Express 4, JSON Web Token (JWT) authentication, bcryptjs password hashing, Morgan logging.
- **Security Middleware:** Native HTTP defense-in-depth headers (CSP, HSTS, frame protections), token-bucket authentication rate limiting, role-based access control (RBAC).
- **Data Persistence:** SQLite 3 with transactional state machines, foreign-key constraints, and audit logging.
- **Testing:** Node.js native test runner (`node:test`) for backend integration; Vitest + React Testing Library + JSDOM for frontend components.

---

## 2. Prerequisites

- **Node.js:** v18.17.0 or higher (v20+ recommended).
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
cp .env.example .env

# Backend template
cp backend/.env.example backend/.env

# Frontend template
cp frontend/.env.example frontend/.env
```

Review [`.env.example`](.env.example), [`backend/.env.example`](backend/.env.example), and [`frontend/.env.example`](frontend/.env.example) for documentation of each variable.

---

## 4. Starting the Application

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
| `DATABASE_PATH` | Backend | No | SQLite file location (default: `./data/cares.db`) |
| `TRUST_PROXY` | Backend | Contextual | Reverse proxy trust (`1`, `true`, or proxy IP). Required when behind TLS-terminator. |
| `CLIENT_ORIGIN` | Backend | No | Allowed frontend origin for CORS (default: `http://localhost:5173`) |
| `VITE_API_URL` | Frontend| No | Backend API endpoint URL (default: `http://localhost:5000/api`) |

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
| `npm test` | **SAFE** | Executes against isolated `backend/data/cares.test.db`. Strict path guard blocks live DB access. |
| `npm run lint` | **SAFE** | Read-only static analysis on source files. |
| `npm run build` | **SAFE** | Read-only bundle generation into `frontend/dist/`. |
| `npm run start:*` | **SAFE** | Runs services with existing database records. |
| `npm run db:init` | **DESTRUCTIVE** | **DO NOT RUN against existing copy.** Creates or resets tables. |
| `npm run db:seed` | **DESTRUCTIVE** | **DO NOT RUN against existing copy.** Wipes and reseeds synthetic records. |
| `node src/scripts/importLocalProviders.js` | **DATABASE MUTATION** | Provider import pipeline. |

---

## 8. Demo Roles & Verified Accounts

The application includes the following pre-configured demo accounts:

| Role | Email | Password | Entity / Person Represented | Status / Access |
| :--- | :--- | :--- | :--- | :--- |
| **System Administrator** | `admin@cares.org` | `Admin@12345` | Platform Governance | Full audit logs, credential verification queue |
| **Patient** | `patient@cares.org` | `Patient@12345` | Ananya Sharma | Profile editing, appointment booking & cancellation |
| **Verified Doctor** | `dr.maya@cares.org` | `Doctor@12345` | Dr. Maya Bennett (Primary Care) | Practice settings, schedule availability, appointment triage |
| **Pending Doctor** | `dr.daniel@cares.org` | `Doctor@12345` | Dr. Daniel Park (Cardiology) | Unverified profile, verification application submission |
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
   - Review the immutable **Administrative & Security Audit Trail** recording all availability changes, status updates, and credential decisions.

---

## 10. Known Limitations & Manual Verification Items

- **Single-Node Rate Limiter:** The in-memory token bucket rate limiter is scoped per process. If deploying to multi-instance container clusters behind a load balancer, a distributed cache (e.g., Redis) should be introduced.
- **Browser Automation Suite:** Automated tests run via Node.js native runner and Vitest JSDOM. Full browser layout rendering, screen reader speech output, and CSS media queries should be verified manually in target browsers.
- **Telemetry Feeds:** Live hospital bed counts and queue wait times are displayed as `Unavailable` per CARES truth policy, pending live hospital IoT integrations.

---

## 11. Production Deployment Checklist

- [ ] **Secret Configuration:** Generate a cryptographically secure `JWT_SECRET` (minimum 32 characters):
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] **Environment Mode:** Set `NODE_ENV=production`. Verify startup refuses to boot if `JWT_SECRET` is unset or default.
- [ ] **Reverse Proxy & TLS:** Place behind Nginx, Caddy, or cloud load balancer terminating TLS. Set `TRUST_PROXY=1` so HSTS and client IP rate limiting function accurately.
- [ ] **Persistent Storage:** Mount a persistent volume for `backend/data/cares.db`. SQLite requires POSIX filesystem locks; avoid NFS mounts with broken locking.
- [ ] **Database Backups:** Schedule automated read-only backups using SQLite online backup API or `.backup` CLI:
  ```bash
  sqlite3 backend/data/cares.db ".backup 'backend/data/backup_$(date +%Y%m%d).db'"
  ```
- [ ] **Frontend Production Build:** Compile assets with `npm run build` and serve static files via Nginx or CDN with long-lived caching on hashed assets.
- [ ] **CORS Configuration:** Restrict `CLIENT_ORIGIN` to the exact production domain.
