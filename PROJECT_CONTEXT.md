# CARES Platform — Comprehensive Project Context & Architecture Reference

> **Update 2026-10-29:** This file preserves the original baseline audit except the replaced deployment roadmap. Current implementation/status/evidence live in `docs/IMPLEMENTATION_TRACKER.md`, `docs/ARCHITECTURE.md` and `docs/TEST_EVIDENCE.md`; earlier proposed/absent-feature statements below are historical.
>
> **Document Classification:** Persistent Project Reference for AI Coding Agents and Human Engineers  
> **Repository Location:** `C:\Users\Hp\Desktop\CARES`  
> **Target Output Path:** `PROJECT_CONTEXT.md`  
> **Initial Baseline Assessment:** October 28, 2026  
> **Mode:** Read-Only Audit & Architectural Baseline (Zero application code or database mutations)

---

## Table of Contents
1. [Section A: Project Overview](#section-a-project-overview)
2. [Section B: Technology Stack](#section-b-technology-stack)
3. [Section C: Actual Repository Structure](#section-c-actual-repository-structure)
4. [Section D: Existing Features and User Journeys](#section-d-existing-features-and-user-journeys)
5. [Section E: Architecture and Data Flow](#section-e-architecture-and-data-flow)
6. [Section F: Environment and Local Development](#section-f-environment-and-local-development)
7. [Section G: Database Safety Requirements (Mandatory & Prominent)](#section-g-database-safety-requirements-mandatory--prominent)
8. [Section H: Existing Quality Checks](#section-h-existing-quality-checks)
9. [Section I: CARES Product Requirements](#section-i-cares-product-requirements)
10. [Section J: Planned ML/DL Feature: CareMatch AI](#section-j-planned-mldl-feature-carematch-ai)
11. [Section K: Planned LLM + RAG Feature: CARES AI Care Navigator](#section-k-planned-llm--rag-feature-cares-ai-care-navigator)
12. [Section L: Safety, Security, and Privacy](#section-l-safety-security-and-privacy)
13. [Section M: Deployment Roadmap](#section-m-deployment-roadmap)
14. [Section N: Prioritized Backlog and Seven-Day Plan](#section-n-prioritized-backlog-and-seven-day-plan)
15. [Section O: Instructions for Future AI Coding Sessions](#section-o-instructions-for-future-ai-coding-sessions)

---

## Section A: Project Overview

### 1. Project Name and Purpose
**CARES** (**C**oordinated **A**ccess, **R**eferral, and **E**mergency **S**ervices) is an integrated, full-stack healthcare navigation, provider discovery, and care-coordination platform. Its primary purpose is to bridge the fragmentation between patients seeking appropriate clinical care, licensed physicians managing practice availability, institutional hospitals operating specialized facilities, and platform governance teams enforcing regulatory verification and audit transparency.

### 2. Problem Being Solved
1. **Navigation Friction & Information Asymmetry:** Patients struggle to identify suitable medical specialists, distinguish between emergency services and routine outpatient consultations, and understand institutional facility capabilities.
2. **Unverified & Misleading Provider Credentials:** Medical directories frequently contain scraped, inaccurate, or unverified claims regarding doctor licensing, credentials, and institutional affiliations.
3. **Disjointed Appointment Coordination:** Patients face complex, opaque booking workflows without clear visibility into confirmation states, while doctors lack direct triage controls to accept, decline, or reschedule visits with clinical notes.
4. **Institutional Silos:** Hospitals and clinics lack coordinated, lightweight portals to manage institutional service directories, publish accurate operating hours and emergency capabilities, and maintain verified rosters of attending physicians.
5. **Emergency Misdirection:** Lack of prominent, unambiguous safety disclaimers can lead individuals to delay seeking life-saving trauma care while interacting with digital appointment prototypes.

### 3. Intended Users and User Roles
The platform implements explicit role-based access control (RBAC) across five discrete user roles:

| Role Identifier | Intended User Class | Primary Platform Capabilities |
| :--- | :--- | :--- |
| `patient` | General Public / Care Seekers | Search clinician directory; filter by specialty/languages/accessibility; book appointment slots; cancel pending appointments; view and update personal contact and emergency details. |
| `doctor` | Healthcare Providers / Clinicians | Manage professional profile (bio, fees, languages, accessibility); define booking slots and intake status; triage incoming patient appointment requests (accept/decline/complete); submit credentialing applications; respond to administrative clarification inquiries. |
| `hospital` | Facility / Clinic Administrators | Maintain institutional profile (operating hours, trauma/emergency readiness, department roster); manage affiliated physician rosters (attach registered doctors to facilities, remove affiliations). |
| `admin` | Platform Security & Governance | Monitor aggregate system health; manage the centralized credential verification queue (approve, reject, request clarification, suspend); inspect immutable administrative and security audit event streams. **Self-approval of own credentials is strictly prohibited.** |
| *(anonymous)* | Unauthenticated Visitors | Browse public doctor directory, search hospital network, inspect credentials and provenance badges, read emergency guidance notices. Interacting with booking controls automatically prompts for patient authentication. |

### 4. Current Product Vision
The overarching vision of CARES is to evolve from an academic, database-backed prototype into a production-grade, secure digital health gateway. Key planned evolutions include:
- Grounded clinical navigation via an explainable machine learning classifier (**CareMatch AI**).
- Safe, hallucination-resistant retrieval-augmented generation (**CARES AI Care Navigator**).
- End-to-end data provenance tracking that cleanly separates synthetic demonstration records from real, verified, publicly sourced healthcare data.

### 5. Confirmed Implementation Status
As of the current audit:
- The core full-stack monolith is fully implemented and operational.
- The React 19 frontend communicates seamlessly with an Express 4 REST API.
- All primary CRUD, authentication, RBAC, appointment triage, verification workflows, and audit logging pipelines are persisted in an embedded SQLite database (`node:sqlite`).
- Automated integration and component tests exist and historically pass (56 backend tests, 39 frontend tests).
- **ML/DL and LLM/RAG pipelines are currently proposed designs only.** No machine learning code, model checkpoints, vector databases, or LLM integrations exist in the current repository codebase.

### 6. Data Provenance & Classification Rules
CARES enforces strict data hygiene by categorizing all provider and facility records into explicit provenance states:

```
                                 ┌───────────────────────────────┐
                                 │     CARES Data Provenance     │
                                 └──────────────┬────────────────┘
                                                │
         ┌──────────────────────────────┬───────┴──────────────────────┬─────────────────────────────┐
         ▼                              ▼                              ▼                             ▼
┌──────────────────┐           ┌──────────────────┐           ┌──────────────────┐          ┌──────────────────┐
│  synthetic_demo  │           │ publicly_sourced │           │registration_check│          │  cares_verified  │
├──────────────────┤           ├──────────────────┤           ├──────────────────┤          ├──────────────────┤
│ Seeded test data │           │ Public directory │           │ Council registry │          │ Formally audited │
│ Fictional records│           │ Real hospitals   │           │ Checked license  │          │ Admin approved   │
│ Demo crowd stats │           │ Zero fake claims │           │ Status recorded  │          │ "✓ Verified"     │
└──────────────────┘           └──────────────────┘           └──────────────────┘          └──────────────────┘
```

1. `synthetic_demo`: Fictional demonstration data seeded for development and testing (e.g., Dr. Maya Bennett, Riverside Medical Center). Explicitly marked with **"Demo Data"** badges in the UI. Simulated crowd levels are only ever shown for demo records.
2. `publicly_sourced`: Real facilities and medical practitioners imported from official public directories in the Chandigarh/Mohali tricity region (`localProvidersChandigarhMohali.json`). Displayed with **"Official Sourced"** badges and verifiable source URLs. Simulated telemetry (bed counts, wait times) is strictly barred for these records.
3. `registration_checked`: Medical licenses verified against official state or national medical council registries (e.g., Punjab Medical Council, Delhi Medical Council, National Medical Commission).
4. `cares_verified`: Clinicians and facilities whose submitted credentials have been formally approved by a CARES platform administrator via the verification application workflow. Only these records display the official **"✓ Verified"** badge.
5. `unverified` / `not_submitted`: Providers lacking formal verification. Clearly labeled with **"Not Verified"** warning badges.

---

## Section B: Technology Stack

All technologies listed below have been verified directly against `package.json`, `backend/package.json`, `frontend/package.json`, and source manifests.

### 1. Frontend Architecture
- **Framework:** React 19 (`react: ^19.3.1`, `react-dom: ^19.3.1`)
- **Build System & Dev Server:** Vite 8 (`vite: ^8.3.4`, `@vitejs/plugin-react: ^6.1.2`)
- **Client Routing:** React Router v7 (`react-router-dom: ^7.18.4`) utilizing `<BrowserRouter>`, `<Routes>`, and `<Route>`
- **State Management:** React Context API (`AuthProvider`, `AuthContextInstance`, and custom `useAuth` hook)
- **Styling Paradigm:** Vanilla CSS with modular stylesheets (`index.css`, `App.css`, `DoctorDiscovery.css`, `DoctorProfile.css`, `HospitalDiscovery.css`, `HospitalDetail.css`, `Dashboard.css`, `LoginPage.css`)
- **HTTP Client:** Native `window.fetch` encapsulated in a centralized client wrapper (`frontend/src/services/apiClient.js`) featuring automatic JWT injection and structured error translation.
- **Static Asset Serving:** Vite public directory (`frontend/public/` containing `favicon.svg`, `icons.svg`, `images/`)

### 2. Backend Architecture
- **Runtime Environment:** Node.js (v18.17.0+ required, ES Modules enabled via `"type": "module"`)
- **Web Application Framework:** Express 4 (`express: ^4.21.2`)
- **Database Engine & Driver:** `node:sqlite` (`DatabaseSync` - Node.js built-in synchronous SQLite implementation). **Zero third-party npm database drivers required.**
- **Authentication & Security:**
  - `jsonwebtoken: ^9.0.2` (HMAC SHA-256 JWT issuance, signing, and verification)
  - `bcryptjs: ^3.0.2` (One-way salted password hashing, 10 rounds)
  - `cors: ^2.8.5` (Configurable CORS origin validation)
  - Custom defense-in-depth HTTP headers middleware (CSP, HSTS, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy, Permissions-Policy)
  - Custom token-bucket rate limiter (`backend/src/middleware/rateLimitMiddleware.js`)
  - Custom payload schema validator (`backend/src/middleware/validateMiddleware.js`)
- **Logging & Utilities:** `morgan: ^1.10.0` (HTTP access logging) and custom structured logger (`backend/src/utils/logger.js`)
- **Configuration Management:** `dotenv: ^16.4.7`

### 3. Testing and Static Analysis Tools
- **Backend Testing:** Node.js Native Test Runner (`node:test`, `node:assert/strict`) executing against isolated test database
- **Frontend Testing:** Vitest (`vitest: ^5.0.5`), `@testing-library/react: ^16.3.3`, and `jsdom: ^29.1.1`
- **Linting & Code Quality:** ESLint 10 (`eslint: ^10.13.0`, `@eslint/js: ^10.0.1`, `eslint-plugin-react-hooks: ^7.1.1`, `eslint-plugin-react-refresh: ^0.5.7`, `globals: ^17.13.0`)

### 4. Technology Separation: Installed vs. Proposed

| Category | Actually Installed & Configured | Proposed / Planned (Not Present in Codebase) |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite 8, React Router 7, Vitest, Testing Library, JSDOM | TailwindCSS, Next.js, Redux, Zustand |
| **Backend** | Node.js 18+, Express 4, `node:sqlite`, JWT, bcryptjs, Morgan, Dotenv | Python, FastAPI, NestJS, Prisma, TypeORM |
| **Persistence** | Embedded SQLite 3 (`cares.db`, `cares.demo.db`, `cares.test.db`) | PostgreSQL, MySQL, MongoDB, Redis, DynamoDB |
| **ML / DL** | *None* | Scikit-learn, PyTorch, TensorFlow, Hugging Face, TF-IDF |
| **LLM / RAG** | *None* | OpenAI SDK, Anthropic SDK, LangChain, LlamaIndex, ChromaDB, FAISS |
| **Cloud / Infra** | Local Node processes, `.env.example` templates | Vercel static hosting/Node functions, managed PostgreSQL |

---

## Section C: Actual Repository Structure

Below is the verified repository tree of all non-ignored project assets:

```
c:\Users\Hp\Desktop\CARES\
├── .env.example                               # Root-level environment template
├── .gitignore                                 # Git ignore rules (node_modules, .env, *.db)
├── CARES-source-clean.zip                     # Clean archive backup of project source
├── package.json                               # Root workspace script definitions
├── PROJECT_CONTEXT.md                         # This comprehensive project context reference
├── README.md                                  # Human-readable platform overview and user guide
│
├── backend\
│   ├── .env                                   # Actual backend environment (NOT committed to Git)
│   ├── .env.example                           # Backend environment template
│   ├── package.json                           # Backend package definition and dependencies
│   ├── package-lock.json                      # Backend dependency lockfile
│   │
│   ├── data\                                  # SQLite databases and verified backups
│   │   ├── cares.db                           # PROTECTED LIVE DATABASE (DO NOT MUTATE)
│   │   ├── cares.db-shm                       # SQLite shared memory file (WAL mode)
│   │   ├── cares.db-wal                       # SQLite write-ahead log file
│   │   ├── cares.db.backup.<timestamp>        # Verified snapshot backups of live DB
│   │   ├── cares.demo.db                      # DEDICATED DEMO DATABASE (for feature demos)
│   │   └── cares.test.db                      # ISOLATED TEST DATABASE (for test runners)
│   │
│   ├── src\
│   │   ├── app.js                             # Express app setup, security headers, route mounting
│   │   ├── server.js                          # HTTP server entry point and graceful shutdown
│   │   │
│   │   ├── config\
│   │   │   └── env.js                         # Centralized environment parsing & JWT validation
│   │   │
│   │   ├── data\
│   │   │   └── localProvidersChandigarhMohali.json # Curated real hospital/doctor directory dataset
│   │   │
│   │   ├── db\
│   │   │   ├── connection.js                  # DatabaseSync connection factory & query wrapper
│   │   │   ├── initDb.js                      # Table creation DDL and schema migration runner
│   │   │   ├── schema.sql                     # Canonical SQL DDL defining all 8 tables & indexes
│   │   │   └── seed.js                        # Synthetic demo dataset seeding script (WIPES DB)
│   │   │
│   │   ├── middleware\
│   │   │   ├── authMiddleware.js              # Bearer token parsing & active account validation
│   │   │   ├── errorMiddleware.js             # Centralized 404 and 500 JSON error handlers
│   │   │   ├── rateLimitMiddleware.js         # In-memory sliding token-bucket rate limiter
│   │   │   ├── roleMiddleware.js              # Role-Based Access Control (RBAC) guard factory
│   │   │   └── validateMiddleware.js          # Declarative request body schema validation
│   │   │
│   │   ├── routes\
│   │   │   ├── adminRoutes.js                 # Admin dashboard, audit logs, credential reviews
│   │   │   ├── authRoutes.js                  # User registration, authentication, session introspect
│   │   │   ├── doctorRoutes.js                # Provider directory, doctor portal, triage, slots
│   │   │   ├── healthRoutes.js                # Unauthenticated system health check endpoint
│   │   │   ├── hospitalRoutes.js              # Hospital portal, facility profile, doctor affiliations
│   │   │   ├── patientRoutes.js               # Patient portal, appointments, profile management
│   │   │   └── publicHospitalRoutes.js        # Public hospital search, detail view, filtering
│   │   │
│   │   ├── scripts\
│   │   │   ├── backupDb.js                    # Database checkpointing and verified backup utility
│   │   │   ├── checkDuplicates.js             # SQL verification of facility/doctor unique constraints
│   │   │   ├── correctMilestone4Data.js       # Data patch utility for hospital coordinates/hours
│   │   │   ├── correctProviderData.js         # Data patch utility enforcing provenance rules
│   │   │   └── importLocalProviders.js        # Transactional JSON provider import pipeline
│   │   │
│   │   └── utils\
│   │       └── logger.js                      # Console logger with ISO timestamping
│   │
│   └── test\
│       └── api.test.js                        # Complete backend integration test suite (56 tests)
│
└── frontend\
    ├── .env                                   # Actual frontend environment (VITE_API_URL)
    ├── .env.example                           # Frontend environment template
    ├── eslint.config.js                       # ESLint 10 flat configuration file
    ├── index.html                             # Single Page Application HTML entry point
    ├── package.json                           # Frontend package definition and dev dependencies
    ├── package-lock.json                      # Frontend dependency lockfile
    ├── README.md                              # Vite standard readme
    ├── vite.config.js                         # Vite 8 config with React plugin and Vitest setup
    │
    ├── public\
    │   ├── favicon.svg                        # Platform brand favicon
    │   ├── icons.svg                          # Inline SVG sprite collection
    │   └── images\
    │       ├── cares-logo.svg                 # Vector brand mark
    │       └── home-care.png                  # Home care marketing graphic
    │
    └── src\
        ├── App.css                            # Global layout and design system styling
        ├── App.jsx                            # Root application component & client-side route table
        ├── doctorData.js                      # Static fallback mock clinician records
        ├── DoctorDiscovery.css                # Doctor search and filter layout styles
        ├── DoctorDiscovery.jsx                # Public clinician discovery page
        ├── DoctorProfile.css                  # Doctor detail and appointment booking panel styles
        ├── DoctorProfile.jsx                  # Single clinician profile & appointment booking page
        ├── Footer.jsx                         # Site-wide persistent footer
        ├── HospitalDetail.css                 # Hospital detail layout styles
        ├── HospitalDetail.jsx                 # Single hospital view with affiliated doctors
        ├── HospitalDiscovery.css              # Hospital directory search styles
        ├── HospitalDiscovery.jsx              # Public hospital directory with emergency filter
        ├── index.css                          # Typography, CSS variables, and base resets
        ├── main.jsx                           # React DOM mount point (`createRoot`)
        ├── Navbar.jsx                         # Responsive navigation bar with auth session controls
        ├── SiteLayout.jsx                     # Layout shell wrapping Navbar, main content, Footer
        │
        ├── assets\                            # Component graphics (hero image, react.svg, vite.svg)
        │
        ├── components\
        │   └── ProtectedRoute.jsx             # Client route guard enforcing role-based access
        │
        ├── context\
        │   ├── AuthContext.jsx                # AuthProvider component managing token & user state
        │   ├── AuthContextInstance.js         # Raw React createContext instance
        │   └── useAuth.js                     # Consumer hook returning auth context
        │
        ├── pages\
        │   ├── AdminDashboard.jsx             # Admin governance portal & verification queue UI
        │   ├── Dashboard.css                  # Shared portal and dashboard design styles
        │   ├── DoctorDashboard.jsx            # Doctor triage, slot editor, & credential submission UI
        │   ├── HospitalDashboard.jsx          # Facility manager, operating hours, & roster UI
        │   ├── LoginPage.css                  # Authentication form styling
        │   ├── LoginPage.jsx                  # Multi-role authentication page
        │   ├── PatientDashboard.jsx           # Patient portal, appointment list, & profile modal UI
        │   └── RegisterPage.jsx               # Patient self-registration form
        │
        ├── services\
        │   └── apiClient.js                   # Unified fetch API service with JWT headers
        │
        ├── tests\                             # Frontend Vitest / RTL test suites (39 tests)
        │   ├── AdminDashboard.test.jsx        # Admin metrics and credential decision testing
        │   ├── AppointmentWorkflow.test.jsx   # Booking, triage, cancellation lifecycle testing
        │   ├── HospitalDashboard.test.jsx     # Facility editing and affiliation testing
        │   ├── HospitalDiscovery.test.jsx     # Facility search, emergency filters, & notices
        │   └── verificationBadges.test.jsx    # Provenance badge logic testing
        │
        └── utils\
            └── hospitalUtils.js               # Department name normalizer utility
```

---

## Section D: Existing Features and User Journeys

Every capability below has been audited against actual source code and automated tests:

### 1. Public Home Page
- **Status:** *Implemented and verified by source/test evidence.*
- **Components:** [`frontend/src/App.jsx`](file:///c:/Users/Hp/Desktop/CARES/frontend/src/App.jsx) (`HomePage`, `NotFoundPage`).
- **Capabilities:** High-level service overview cards, navigation links to `/doctors` and `/hospitals`, anchor links to home-care and emergency sections, and a prominent emergency safety note informing users that CARES is a navigation prototype and instructing them to dial 112 for urgent care.

### 2. Doctor Discovery, Filters, Profiles, and Availability
- **Status:** *Implemented and verified by source/test evidence.*
- **Components:** [`frontend/src/DoctorDiscovery.jsx`](file:///c:/Users/Hp/Desktop/CARES/frontend/src/DoctorDiscovery.jsx), [`frontend/src/DoctorProfile.jsx`](file:///c:/Users/Hp/Desktop/CARES/frontend/src/DoctorProfile.jsx), [`backend/src/routes/doctorRoutes.js`](file:///c:/Users/Hp/Desktop/CARES/backend/src/routes/doctorRoutes.js).
- **Capabilities:**
  - Fetches from `GET /api/doctors`; falls back to static `doctorData.js` if backend is unreachable.
  - Multi-criteria filtering by specialty, location/city, consultation type (In-person / Video), availability horizon (Today, This week, Next 3 days), languages spoken, gender, wheelchair accessibility, and accepting new patients.
  - Dynamic display of doctor provenance (`Demo Data`, `Official Sourced`) and verification badges (`✓ Verified`, `Not Verified`).
  - Clinician profile details page displaying qualifications, experience, bio, consultation fee, primary hospital affiliation, and interactive appointment booking slot selector.

### 3. Hospital Directory and Hospital Insights
- **Status:** *Implemented and verified by source/test evidence.*
- **Components:** [`frontend/src/HospitalDiscovery.jsx`](file:///c:/Users/Hp/Desktop/CARES/frontend/src/HospitalDiscovery.jsx), [`frontend/src/HospitalDetail.jsx`](file:///c:/Users/Hp/Desktop/CARES/frontend/src/HospitalDetail.jsx), [`backend/src/routes/publicHospitalRoutes.js`](file:///c:/Users/Hp/Desktop/CARES/backend/src/routes/publicHospitalRoutes.js).
- **Capabilities:**
  - Fetches from `GET /api/hospitals` with query parameters (`city`, `emergency=true`).
  - Text search across facility names, addresses, and clinical departments.
  - Dedicated 24/7 Emergency toggle filtering facilities equipped with emergency departments.
  - Prominent emergency guidance banner explaining dial-112 protocols and static directory limitations.
  - Hospital detail page showing full address, phone, emergency readiness, operating hours (regular vs OPD vs emergency), clinical departments, and affiliated doctors roster.
  - Simulated crowd metrics are strictly constrained to synthetic records (`Demo Crowd: ...`) and suppressed on real public facilities.

### 4. Patient Authentication, Profile, and Dashboard
- **Status:** *Implemented and verified by source/test evidence.*
- **Components:** [`frontend/src/context/AuthContext.jsx`](file:///c:/Users/Hp/Desktop/CARES/frontend/src/context/AuthContext.jsx), [`frontend/src/pages/LoginPage.jsx`](file:///c:/Users/Hp/Desktop/CARES/frontend/src/pages/LoginPage.jsx), [`frontend/src/pages/RegisterPage.jsx`](file:///c:/Users/Hp/Desktop/CARES/frontend/src/pages/RegisterPage.jsx), [`frontend/src/pages/PatientDashboard.jsx`](file:///c:/Users/Hp/Desktop/CARES/frontend/src/pages/PatientDashboard.jsx), [`backend/src/routes/patientRoutes.js`](file:///c:/Users/Hp/Desktop/CARES/backend/src/routes/patientRoutes.js).
- **Capabilities:**
  - Self-service registration at `POST /api/auth/register` creates `users` and `patient_profiles` records atomically.
  - JWT session storage in `localStorage`; validation via `GET /api/auth/me`.
  - Accessible profile modal with keyboard focus trapping, Escape-to-dismiss, and validation on phone, DOB, gender, and emergency contact.
  - Active appointment requests list with status indicators (`pending`, `accepted`, `confirmed`, `declined`, `cancelled`, `completed`).
  - Patient self-cancellation of pending requests via `PATCH /api/patient/appointments/:id/cancel`.

### 5. Doctor Dashboard, Profile, and Availability Management
- **Status:** *Implemented and verified by source/test evidence.*
- **Components:** [`frontend/src/pages/DoctorDashboard.jsx`](file:///c:/Users/Hp/Desktop/CARES/frontend/src/pages/DoctorDashboard.jsx), [`backend/src/routes/doctorRoutes.js`](file:///c:/Users/Hp/Desktop/CARES/backend/src/routes/doctorRoutes.js).
- **Capabilities:**
  - Appointment triage feed with status filtering.
  - Status updates: Accept or decline appointments with optional clinical notes.
  - Mark consultations completed.
  - Practice profile editor: Consultation fee, spoken languages, wheelchair accessibility, and accepting-new-patients toggle.
  - Interactive schedule availability editor: Add and remove booking time slots.
  - Credential verification tab: Submit license numbers, issuing medical councils, qualifications, and evidence URLs; view status (`pending`, `needs_clarification`, `verified`, `rejected`); submit clarification responses.

### 6. Hospital Portal and Doctor Affiliations
- **Status:** *Implemented and verified by source/test evidence.*
- **Components:** [`frontend/src/pages/HospitalDashboard.jsx`](file:///c:/Users/Hp/Desktop/CARES/frontend/src/pages/HospitalDashboard.jsx), [`backend/src/routes/hospitalRoutes.js`](file:///c:/Users/Hp/Desktop/CARES/backend/src/routes/hospitalRoutes.js).
- **Capabilities:**
  - Facility operational settings: Update address, telephone, regular operating hours, emergency hours, and emergency department active toggle (`emergency_available`).
  - Affiliated clinicians roster: Inspect attending physicians and specialties.
  - Roster management: Associate an existing registered doctor with the hospital (`POST /api/hospital/affiliations`); remove affiliations (`DELETE /api/hospital/affiliations/:doctorId`).

### 7. Admin Portal and Verification Workflow
- **Status:** *Implemented and verified by source/test evidence.*
- **Components:** [`frontend/src/pages/AdminDashboard.jsx`](file:///c:/Users/Hp/Desktop/CARES/frontend/src/pages/AdminDashboard.jsx), [`backend/src/routes/adminRoutes.js`](file:///c:/Users/Hp/Desktop/CARES/backend/src/routes/adminRoutes.js).
- **Capabilities:**
  - High-level platform health metrics (user counts by role, active verifications count, total appointments).
  - Centralized Credential Verification Queue for reviewing submitted doctor and facility licenses.
  - Action modal to approve credentials, reject credentials, or request specific clarification inquiries.
  - **Self-approval prohibition:** Server strictly blocks administrators from reviewing or approving their own verification records (`SELF_APPROVAL_NOT_ALLOWED`).
  - Immutable Administrative & Security Audit Trail viewer (`GET /api/admin/dashboard` queries `audit_events`).

### 8. Appointment Request and Lifecycle Coordination
- **Status:** *Implemented and verified by source/test evidence.*
- **Components:** Full end-to-end flow spanning `DoctorProfile.jsx`, `patientRoutes.js`, `DoctorDashboard.jsx`, `doctorRoutes.js`, and `appointment_status_history`.
- **Capabilities:**
  - Patient selects doctor, date (up to 90 days out), slot, visit type, and reason.
  - Submits `POST /api/patient/appointments` -> inserts into `appointment_requests` with status `pending`.
  - Concurrency guard: A unique SQLite index (`idx_unique_accepted_slot`) strictly prevents double-booking accepted or confirmed slots for the same doctor on the same date.
  - State machine transitions: `pending` -> `accepted` | `declined` | `cancelled`. Accepted -> `completed` | `rescheduled`.
  - Every transition logs an entry to `appointment_status_history` and `audit_events`.

### 9. Care at Home
- **Status:** *UI/demo only.*
- **Components:** [`frontend/src/App.jsx`](file:///c:/Users/Hp/Desktop/CARES/frontend/src/App.jsx) (`#home-care` landing section), [`frontend/src/pages/PatientDashboard.jsx`](file:///c:/Users/Hp/Desktop/CARES/frontend/src/pages/PatientDashboard.jsx) (navigational link).
- **Details:** The current repository only contains marketing copy and illustrations (`home-care.png`) describing home nursing, physiotherapy, and elder care. **There are zero backend database tables, zero API endpoints, and zero booking forms for home care in the codebase.**

### 10. Emergency Information Page
- **Status:** *Partially implemented.*
- **Components:** Anchor link `#emergency-safety` on the home page (`frontend/src/App.jsx`), and dedicated emergency guidance banners on `HospitalDiscovery.jsx` and `HospitalDetail.jsx`.
- **Details:** Emergency notices and dial-112 disclaimers are present and tested. However, **there is no standalone `/emergency` route or page component**; it currently anchors to sections on the landing and hospital discovery pages.

### 11. Existing Notifications and Audit Logs
- **Status:** *Implemented and verified by source/test evidence.*
- **Components:** `audit_events` and `appointment_status_history` tables; [`backend/src/routes/adminRoutes.js`](file:///c:/Users/Hp/Desktop/CARES/backend/src/routes/adminRoutes.js).
- **Capabilities:** Real-time audit recording of logins, registrations, appointment state transitions, facility profile edits, and verification decisions with timestamps, actor IDs, and IP addresses. In-memory flash alerts and toast feedback exist in frontend dashboards.

---

## Section E: Architecture and Data Flow

### 1. End-to-End Request Lifecycle
The diagram below illustrates how client interactions flow through security, authentication, and business layers down to the SQLite persistence engine:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 19 Frontend (SPA)                         │
│  - User triggers interaction (e.g. Book Appointment, Triage, Filter)   │
│  - apiClient.js injects Authorization: Bearer <JWT> from localStorage  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP Request (JSON)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Express 4 HTTP Server                           │
│  1. Security Headers: CSP, HSTS, X-Frame-Options: DENY, nosniff        │
│  2. CORS Policy Middleware: Validates Origin against CLIENT_ORIGIN     │
│  3. Body Parser Middleware: express.json({ limit: '1mb' })             │
│  4. Access Logger: Morgan (suppressed during automated tests)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Endpoint Security Chain                          │
│  5. Rate Limiter: createAuthRateLimiter (10 req/15 min on auth routes) │
│  6. Authentication: authenticateToken verifies JWT & user active status│
│  7. Authorization: requireRole('patient'|'doctor'|'hospital'|'admin')  │
│  8. Payload Validation: validateBody checks required fields and enums  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Route Controller Execution                        │
│  - Business logic execution (e.g. appointment triage, license review)  │
│  - Enforces entity boundaries and ownership (e.g. doctor owns slot)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Synchronous Call
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Data Access Layer (node:sqlite)                      │
│  - db.get(), db.all(), db.run(), db.transaction()                      │
│  - PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;                │
│  - Enforces UNIQUE constraints, foreign keys, CHECK constraints        │
│  - Writes immutable audit trail to audit_events                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       SQLite Persistence Engine                        │
│   cares.db / cares.demo.db / cares.test.db (+ .db-shm & .db-wal)       │
└────────────────────────────────────────────────────────────────────────┘
```

### 2. Error Handling & Normalization Architecture
- Backend: [`backend/src/middleware/errorMiddleware.js`](file:///c:/Users/Hp/Desktop/CARES/backend/src/middleware/errorMiddleware.js) intercepts all uncaught errors and unknown routes (`notFoundHandler`), serializing errors into a predictable JSON structure:
  ```json
  {
    "success": false,
    "error": "Human readable error description",
    "code": "SPECIFIC_MACHINE_READABLE_ERROR_CODE",
    "details": ["Optional validation failure messages"]
  }
  ```
- Frontend: [`frontend/src/services/apiClient.js`](file:///c:/Users/Hp/Desktop/CARES/frontend/src/services/apiClient.js) wraps `fetch`. If an HTTP status $\ge 400$ is encountered, it unpacks the server's `error`, `code`, and `details` properties onto an `Error` object. If the network drops or the server is offline, it raises a specific `BACKEND_UNAVAILABLE` code for graceful UI handling.

### 3. Entity-Relationship Schema Architecture
The SQLite database schema is defined in [`backend/src/db/schema.sql`](file:///c:/Users/Hp/Desktop/CARES/backend/src/db/schema.sql). Below is the relational structure of all 8 core tables:

```
   ┌─────────────────────────────────────────────────────────────────────────┐
   │                                  users                                  │
   ├─────────────────────────────────────────────────────────────────────────┤
   │ id (PK)                                                                 │
   │ email (UNIQUE, NOCASE)                                                  │
   │ password_hash                                                           │
   │ role ('patient' | 'doctor' | 'hospital' | 'admin')                      │
   │ status ('active' | 'pending_approval' | 'suspended' | 'rejected')       │
   │ created_at, updated_at                                                  │
   └──────────┬──────────────────────────┬─────────────────────────┬─────────┘
              │ 1:1                      │ 1:1                     │ 1:1 (optional)
              ▼                          ▼                         ▼
┌───────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐
│     patient_profiles      │ │      doctor_profiles      │ │         hospitals         │
├───────────────────────────┤ ├───────────────────────────┤ ├───────────────────────────┤
│ id (PK)                   │ │ id (PK)                   │ │ id (PK)                   │
│ user_id (FK -> users, UQ) │ │ user_id (FK -> users, UQ) │ │ user_id (FK -> users, UQ) │
│ full_name                 │ │ full_name, specialty      │ │ name (UNIQUE, TRIM)       │
│ phone, date_of_birth      │ │ license_number (UNIQUE)   │ │ address, city, state      │
│ gender, emergency_contact │ │ issuing_council, qualifs  │ │ phone, email, website_url │
│ city                      │ │ experience_years, bio     │ │ operating_hours_json      │
│ is_synthetic (0/1)        │ │ rating, reviews_count     │ │ crowd_level, emergency_avl│
│ created_at, updated_at    │ │ consultation_fee          │ │ is_verified, verif_status │
└─────────────┬─────────────┘ │ languages_json            │ │ departments_json          │
              │               │ visit_types_json          │ │ is_synthetic (0/1)        │
              │               │ available_slots_json      │ │ source_url, source_org    │
              │               │ is_accepting_new_patients │ │ provenance_status         │
              │               │ is_wheelchair_accessible  │ │ created_at, updated_at    │
              │               │ is_verified, verif_status │ └─────────────┬─────────────┘
              │               │ registration_check_status │               │
              │               │ is_synthetic, source_url  │               │
              │               │ provenance_status         │               │
              │               │ created_at, updated_at    │               │
              │               └─────────────┬─────────────┘               │
              │                             │                             │
              │                             │ 1:N                         │ 1:N
              │                             ▼                             ▼
              │               ┌─────────────────────────────────────────────────────────┐
              │               │              doctor_hospital_affiliations               │
              │               ├─────────────────────────────────────────────────────────┤
              │               │ id (PK)                                                 │
              │               │ doctor_id (FK -> doctor_profiles, CASCADE)              │
              │               │ hospital_id (FK -> hospitals, CASCADE)                  │
              │               │ role_at_facility, distance_text                         │
              │               │ affiliation_source, is_verified_affiliation             │
              │               │ is_primary (0/1), created_at                            │
              │               │ UNIQUE(doctor_id, hospital_id)                          │
              │               └─────────────────────────────────────────────────────────┘
              │
              │ 1:N (patient)               1:N (doctor)                  1:N (optional hospital)
              ├─────────────────────────────┼─────────────────────────────┤
              ▼                             ▼                             ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                                 appointment_requests                                  │
├───────────────────────────────────────────────────────────────────────────────────────┤
│ id (PK)                                                                               │
│ patient_id (FK -> patient_profiles, CASCADE)                                          │
│ doctor_id (FK -> doctor_profiles, CASCADE)                                            │
│ hospital_id (FK -> hospitals, SET NULL)                                               │
│ requested_date, preferred_slot, visit_type, reason_for_visit                          │
│ status ('pending'|'requested'|'accepted'|'confirmed'|'declined'|'cancelled'|...)      │
│ is_demo_request, created_at, updated_at                                               │
│ UNIQUE INDEX: (doctor_id, requested_date, preferred_slot) WHERE status in accepted    │
└───────────────────────────────────────────┬───────────────────────────────────────────┘
                                            │ 1:N
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                              appointment_status_history                               │
├───────────────────────────────────────────────────────────────────────────────────────┤
│ id (PK), appointment_id (FK -> appointment_requests, CASCADE)                         │
│ status, notes, changed_by_user_id (FK -> users, SET NULL), created_at                 │
└───────────────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────────────┐
│                               verification_applications                               │
├───────────────────────────────────────────────────────────────────────────────────────┤
│ id (PK), user_id (FK -> users, CASCADE), target_type ('doctor'|'hospital'), target_id │
│ submitted_license_number, issuing_council, qualifications, supporting_evidence_json   │
│ affiliation_requested, clarification_request, clarification_response, decision_reason │
│ status ('pending'|'approved'|'rejected'|'needs_clarification'|'suspended')            │
│ reviewed_by_user_id (FK -> users, SET NULL), reviewed_at, created_at, updated_at       │
└───────────────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────────────┐
│                                     audit_events                                      │
├───────────────────────────────────────────────────────────────────────────────────────┤
│ id (PK), actor_user_id (FK -> users, SET NULL), action, target_type, target_id        │
│ details_json, ip_address, created_at                                                  │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Section F: Environment and Local Development

### 1. Working Directories & Process Execution
Commands must be run from their designated directories to ensure module paths and package manifests resolve accurately:

- **Root Directory (`C:\Users\Hp\Desktop\CARES`):** Runs workspace scripts (`npm test`, `npm run lint`, `npm run build`, `npm run start:backend`, `npm run start:frontend`).
- **Backend Directory (`C:\Users\Hp\Desktop\CARES\backend`):** Runs standalone API scripts, migrations, database utilities, and isolated backend test suites.
- **Frontend Directory (`C:\Users\Hp\Desktop\CARES\frontend`):** Runs Vite development server, Vitest component test runner, and production bundler.

### 2. Startup Commands
For interactive local development:

```bash
# Terminal 1: Backend REST API (Runs on port 5000)
cd c:\Users\Hp\Desktop\CARES
npm run start:backend
# Starts Express server at http://localhost:5000

# Terminal 2: Frontend Client (Runs on port 5173 or 5174)
cd c:\Users\Hp\Desktop\CARES
npm run start:frontend
# Starts Vite dev server at http://localhost:5173
```

### 3. Expected URLs & Network Ports
- **Frontend Web UI:** `http://localhost:5173` (or `http://localhost:5174` if 5173 is bound)
- **Backend REST API:** `http://localhost:5000`
- **Backend Health Check:** `http://localhost:5000/api/health`
- **Root API Greeting:** `http://localhost:5000/`

### 4. Safe Environment Variable Specifications

> [!IMPORTANT]
> Never copy, hardcode, or commit actual secrets, private tokens, or live credentials to source control. Use the following variable names and definitions:

| Variable Name | Component | Required in Prod | Safe Description / Default Value |
| :--- | :--- | :---: | :--- |
| `PORT` | Backend | No | Local TCP listening port for Express. Defaults to `5000`. |
| `NODE_ENV` | Backend | **Yes** | Runtime mode (`development`, `production`, `test`). Defaults to `development`. |
| `DATABASE_PATH` | Backend | Contextual | Path to SQLite database file. Defaults to `./data/cares.db` in dev/prod, `./data/cares.test.db` in test. |
| `CLIENT_ORIGIN` | Backend | No | Permitted CORS frontend origin. Defaults to `http://localhost:5173`. |
| `TRUST_PROXY` | Backend | Contextual | Reverse proxy trust configuration (`1`, `true`, or IP) when running behind TLS termination. |
| `JWT_SECRET` | Backend | **Yes** | Cryptographic key used to sign and verify JWT tokens. In `production`, startup crashes if $<32$ characters or if default string is used. |
| `JWT_EXPIRES_IN`| Backend | No | Token expiration duration (e.g., `7d`, `24h`). Defaults to `7d`. |
| `VITE_API_URL` | Frontend | No | Base endpoint for the CARES REST API. Defaults to `http://localhost:5000/api`. |

---

## Section G: Database Safety Requirements (Mandatory & Prominent)

> [!CAUTION]
> ### CRITICAL DATABASE SAFETY RULES FOR ALL SESSIONS
> 
> The local project contains a protected database at `backend/data/cares.db` and a dedicated demo database at `backend/data/cares.demo.db`. 
> 
> **Violation of these rules risks irreversible data loss and corruption of verified records:**
> 1. **NEVER run seed, reset, or wipe scripts against `cares.db`:** [`backend/src/db/seed.js`](file:///c:/Users/Hp/Desktop/CARES/backend/src/db/seed.js) executes `DELETE FROM` across every table. Running this on `cares.db` will wipe all records.
> 2. **NEVER assume the current shell environment points to the demo database:** By default, `backend/.env` specifies `DATABASE_PATH=./data/cares.db`. Any command run without an explicit environment override will target the protected database!
> 3. **NEVER delete, overwrite, truncate, or run unverified migrations on `cares.db`** without prior user authorization and a verified snapshot backup.
> 4. **ALWAYS use `backend/data/cares.demo.db` for interactive demonstrations and manual feature testing.**
> 5. **ALWAYS use `backend/data/cares.test.db` for automated tests.** The test suite in `backend/test/api.test.js` enforces this via a runtime assertion that aborts execution if `config.databasePath` ends with `cares.db`.
> 6. **DO NOT include SQLite database files (`*.db`, `*.db-shm`, `*.db-wal`) in git commits or documentation.**
> 7. **Inspect any script in `backend/src/scripts/` before executing it.** Certain historical scripts (such as `correctMilestone4Data.js`) have hardcoded paths to `cares.db`.

### Observed Database Path Resolution Logic
The application resolves its database path in [`backend/src/config/env.js`](file:///c:/Users/Hp/Desktop/CARES/backend/src/config/env.js#L8-L10) and [`backend/src/db/connection.js`](file:///c:/Users/Hp/Desktop/CARES/backend/src/db/connection.js#L10-L18):
1. `backend/src/config/env.js` invokes `dotenv.config({ path: path.resolve(__dirname, '../../.env') })` **without** `override: true`.
2. As a result, if `process.env.DATABASE_PATH` is already defined in the launching shell (e.g., via `$env:DATABASE_PATH = "./data/cares.demo.db"`), that shell variable takes precedence.
3. If `process.env.DATABASE_PATH` is **not** set in the shell, `dotenv` loads the value from `backend/.env` (`./data/cares.db`).
4. If neither is set, `env.js` falls back to `./data/cares.test.db` when `NODE_ENV === 'test'`, and `./data/cares.db` otherwise.
5. In `connection.js`, relative paths are resolved relative to the backend root directory (`c:\Users\Hp\Desktop\CARES\backend`).

---

## Section H: Existing Quality Checks

### 1. Verified Quality Scripts

| Command | Working Directory | Scope | Safety Classification |
| :--- | :--- | :--- | :--- |
| `npm test` | Root | Runs backend integration tests, then frontend component tests | **SAFE** (Uses isolated test DB) |
| `npm run test:backend` | Root or `backend/` | Runs 56 Node.js native integration tests | **SAFE** (Protected by path assertion) |
| `npm run test:frontend` | Root or `frontend/` | Runs 39 Vitest / RTL component tests | **SAFE** (Read-only JSDOM runner) |
| `npm run lint` | Root or `frontend/` | Runs ESLint 10 flat configuration checks | **SAFE** (Read-only static analysis) |
| `npm run build` | Root or `frontend/` | Compiles Vite production bundle into `frontend/dist/` | **SAFE** (Read-only bundle output) |

### 2. Historical Baseline Report
> [!NOTE]
> The following figures represent historical baseline results recorded prior to this documentation task and have **not** been newly re-executed as part of this read-only audit:
> - **Backend Test Suite:** 56 passing tests (0 failures, 0 skipped). Tested via `node --test test/**/*.test.js`.
> - **Frontend Test Suite:** 39 passing tests (0 failures). Tested across 5 test files via `vitest run`.
> - **Static Code Analysis:** ESLint completed with 0 errors and 0 warnings.
> - **Production Build:** Vite production build completed successfully, outputting optimized assets to `frontend/dist/`.

---

## Section I: CARES Product Requirements

The target multi-role experience is synthesized below from repository proposals and design specifications:

### 1. Patient Journey Requirements
- Seamless, unauthenticated search across clinicians and facilities.
- Filter doctors by specialty, distance/location, consultation fee, spoken languages, wheelchair accessibility, and availability horizon.
- Authenticated appointment request submission with choice of consultation type (In-person vs Video) and patient visit reason.
- Clear, real-time dashboard displaying pending, accepted, confirmed, completed, and cancelled consultations.
- Self-service appointment cancellation with confirmation feedback.
- Accessible profile editing (keyboard accessible, screen-reader friendly modal).

### 2. Healthcare Provider (Doctor) Requirements
- Dedicated clinical portal for managing practice logistics and scheduling.
- Daily appointment triage view to accept or decline incoming visit requests.
- Ability to attach clinical notes and record consultation completion.
- Practice settings: toggle accepting-new-patients status, configure consultation fees, update spoken languages.
- Interactive schedule manager to add, adjust, or delete available appointment slots.
- Credentialing workflow: submit registration license number, issuing medical council, qualifications, and evidence URLs; track review progress; respond directly to administrative clarification requests.

### 3. Institutional Facility (Hospital) Requirements
- Facility profile management: update address, contact phone, regular operating hours, OPD hours, and emergency care hours.
- Emergency department status: configure whether emergency trauma units are operational (`emergency_available`).
- Roster coordination: affiliate licensed physicians with the hospital; assign facility roles (e.g. Attending Consultant, Department Head); detach physicians upon departure.

### 4. Platform Administration & Governance Requirements
- Aggregate platform monitoring: registered user metrics, verification backlog, total appointment volume.
- Centralized Credential Verification Queue: evaluate doctor and hospital licensing applications; approve, reject, or request specific clarification.
- Strict anti-corruption guardrail: **prohibition of administrator self-approval.**
- Immutable, searchable audit logs tracking authentication events, credential decisions, facility profile edits, and appointment status changes.

---

## Section J: Planned ML/DL Feature: CareMatch AI

> [!WARNING]
> **Implementation Status: PROPOSED / PLANNED ONLY.**  
> *Zero ML/DL code, training datasets, model weights, or evaluation scripts currently exist in the repository.*

### 1. Objective and Problem Statement
Patients often articulate healthcare needs using natural-language symptoms (e.g., "sharp lower back pain when bending", "feeling dizzy and short of breath after eating") rather than formal clinical taxonomy. CareMatch AI is intended to classify user navigation intent and map lay symptom descriptions to the most relevant clinical specialties and provider attributes.

### 2. Proposed Architecture & Methodology
1. **Dataset Construction:**
   - Curate a balanced healthcare intent classification dataset with representative symptom descriptions mapped to target specialties (e.g., Cardiology, Orthopedics, Dermatology, Internal Medicine, Pediatrics, Neurology).
   - Divide data into stratified **Training (70%)**, **Validation (15%)**, and held-out **Test (15%)** splits.
2. **Baseline Model (Interpretable ML):**
   - Text preprocessing: lowercasing, medical-stopword handling, n-gram tokenization ($1\text{--}3$ grams).
   - Vectorization: Term Frequency–Inverse Document Frequency (TF-IDF).
   - Classifier: Multinomial Logistic Regression or Linear Support Vector Machine (LinearSVC) with calibrated probability outputs.
3. **Optional Neural / Deep Learning Experiment:**
   - Fine-tuned transformer (e.g., Bio_ClinicalBERT or DistilBERT) or a 1D-CNN/BiLSTM text classifier if computational budget and latency permits.
4. **Evaluation & Transparency Metrics:**
   - Classification: Macro-averaged F1-score, per-class Precision and Recall, confusion matrix analysis, and explicit worst-case misclassification audit.
   - Ranking (Provider Matching): Precision@k and NDCG@k against labeled patient query–provider pairs.
5. **Operational Deliverables:**
   - Reproducible offline training script.
   - Versioned model artifact (e.g., ONNX or serialized pipeline) stored under a designated `models/` directory.
   - Lightweight Node.js or Python microservice inference wrapper providing explainable match justifications (e.g., top contributing n-grams/features).

---

## Section K: Planned LLM + RAG Feature: CARES AI Care Navigator

> [!WARNING]
> **Implementation Status: PROPOSED / PLANNED ONLY.**  
> *Zero LLM APIs, vector stores, chunking scripts, or retrieval pipelines currently exist in the repository.*

### 1. Objective and Problem Statement
To provide an interactive, conversational patient guidance assistant that answers questions regarding facility capabilities, doctor specialties, consultation preparations, and health system navigation without hallucinating clinical advice or fabricating provider information.

### 2. Intended 8-Stage RAG Pipeline Design
```
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│ 1. Approved Knowledge Documents │ ───► │ 2. Document Cleaning & Chunking │
│ (Hospital guides, clinic FAQs)  │      │ (Metadata tagging, chunk ~500t) │
└─────────────────────────────────┘      └────────────────┬────────────────┘
                                                          │
                                                          ▼
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│ 4. Similarity Vector Retrieval  │ ◄─── │ 3. Vector Embedding & Indexing  │
│ (Cosine similarity top-k chunks)│      │ (Sentence-transformers/text-emb)│
└────────────────┬────────────────┘      └─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│ 5. Grounded Generation Prompt   │ ───► │ 6. Source Attribution & Citation│
│ (System instructions + chunks)  │      │ (Explicit document/page refs)   │
└────────────────┬────────────────┘      └─────────────────────────────────┘
                 │
                 ├────────────────────────────────────────┬────────────────────────────────────────┐
                 ▼                                        ▼                                        ▼
┌─────────────────────────────────┐      ┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│ 7. Fallback on Low Confidence   │      │ 8. Structured CARES DB Tool Call│      │ 9. Safety & Emergency Filter    │
│ ("Evidence insufficient to say")│      │ (Query live doctor/slot tables) │      │ (Detect emergency -> Call 112)  │
└─────────────────────────────────┘      └─────────────────────────────────┘      └─────────────────────────────────┘
```

1. **Approved Knowledge Documents:** Authoritative institutional health guides, public clinic documentation, and patient orientation materials.
2. **Cleaning & Chunking:** Header-aware text normalization, chunking into 400–600 token segments with 50-token overlap, tagged with source URLs and document titles.
3. **Embeddings & Vector Index:** Dense vector indexing using a local vector store (e.g., ChromaDB, sqlite-vss, or FAISS).
4. **Retrieval:** Cosine similarity retrieval of top-$k$ ($k=3\text{--}5$) relevant passages with similarity score thresholding.
5. **Grounded Generation:** Prompt constructed with strict system instructions: *Answer solely using provided excerpts; do not extrapolate.*
6. **Real Source Citations:** Output must reference specific retrieved document titles and sections.
7. **Insufficient-Evidence Fallback:** If similarity scores fall below threshold $\theta$, model must state: *"I cannot find verified information regarding this in CARES records. Please consult the hospital directly."*
8. **Structured Backend Tool Calling:** Real-time lookup tools allowing the LLM to query actual SQLite database tables for verified doctor availability, facility addresses, and departments.
9. **Emergency Safety Redirection:** Immediate regex and classifier interception for acute trauma/cardiac/stroke queries, responding with bold emergency guidance to dial 112.

---

## Section L: Safety, Security, and Privacy

### 1. Implemented Security Controls
- **Password Security:** One-way password hashing using `bcryptjs` with 10 salt rounds; plaintext passwords are never logged or stored.
- **Authentication:** Stateless HMAC SHA-256 JWTs with configurable expiration (`7d` default); signature keys enforced with strict production length checks ($\ge 32$ chars).
- **Directory Account Isolation:** Directory-only imported doctors have passwords set to `DIRECTORY_IMPORT_NO_LOGIN_UNAUTHORIZED` and are barred from interactive authentication.
- **HTTP Security Headers:**
  - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none';`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (enabled on secure connections)
- **Rate Limiting:** Sliding token-bucket rate limiter applied to `/api/auth/login` and `/api/auth/register` (10 requests per 15 minutes in production; capacity-capped at 10,000 tracked IPs to prevent memory exhaustion).
- **SQL Injection Prevention:** 100% of SQL operations utilize parameterized prepared statements (`node:sqlite`). Zero string concatenation in SQL queries.
- **Role Enforcement & Boundaries:** Server-side RBAC ensures patients cannot access doctor or admin endpoints, and administrators cannot approve their own verification submissions.
- **Audit Logging:** Security events (logins, registrations, status updates, verification actions) are written to an append-only `audit_events` table with IP addresses.

### 2. Known Gaps & Production Hardening Needs
- **In-Memory Rate Limiting:** The rate limiter is currently process-bound. Multi-instance cluster deployments require a distributed store (e.g. Redis).
- **Single-Node SQLite Concurrency:** SQLite in WAL mode handles multiple concurrent readers and a single writer. High write contention under heavy production load requires migration to a client-server RDBMS (e.g. PostgreSQL).
- **Two-Factor Authentication (2FA):** Currently absent for doctor and administrator accounts.
- **Automated PII Masking:** Logs should incorporate automated redaction filters for patient emergency contact numbers and emails.
- **Healthcare Regulatory Compliance:** Compliance with HIPAA, GDPR, or India's Digital Personal Data Protection (DPDP) Act has not been audited and must not be claimed without formal legal and security review.

---

## Section M: Deployment Roadmap (updated 2026-10-29)

The active deployment target is Vercel static React/Vite plus a Vercel Node 24 Express function and durable managed PostgreSQL through a pooled TLS connection. The lightweight trained model and versioned local vector index are bundled with the backend. Real generation uses an owner-configured Anthropic Messages API key/model.

No deployment, account creation, billable resource or live-data migration has been performed. Detailed current architecture, limits, environment variables, migrations, rollback and recovery gates are in `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT_GUIDE.md` and `MANUAL_ACTIONS_REQUIRED.md`. SQLite remains an explicitly selected local development option and is refused by the Vercel function.

## Section N: Prioritized Backlog and Seven-Day Plan

This roadmap provides a realistic, milestone-based execution plan. Reliability, database safety, and integration integrity take precedence over superficial feature counts.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CARES 7-Day Sprint Roadmap Target                                      │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 [Day 1] Baseline Audit & Safe Dev Setup ──► [Day 2] End-to-End Workflow Verification
                                                              │
                                                              ▼
 [Day 4] CareMatch ML Intent Classifier  ◄── [Day 3] Provenance, Care at Home, & Emergency Page
        │
        ▼
 [Day 5] CARES AI Care Navigator (RAG)   ──► [Day 6] AI Integration & Vercel/PostgreSQL Preparation
                                                              │
                                                              ▼
                                             [Day 7] Final Regression, Audit, & Demo
```

### Day 1: Source Audit, Baseline Checks, Requirements Mapping, and Safe Development Setup
- **Prerequisites:** Access to repository, Node.js 18+, clean working directory.
- **Expected Deliverables:** Verified directory structure, complete `PROJECT_CONTEXT.md`, confirmed isolation of `cares.db` vs `cares.demo.db`, local dev environment confirmed operational.
- **Acceptance Criteria:** `PROJECT_CONTEXT.md` created; backend and frontend start cleanly on dedicated ports without mutating `cares.db`.
- **Dependencies:** None.
- **Risks:** Accidentally executing seed scripts against `cares.db`. *Mitigation: Check environment variable before any script execution.*

### Day 2: Connect and Verify Patient, Doctor, Hospital, Appointment, and Service-Request Workflows
- **Prerequisites:** Day 1 completion; backend running against `cares.demo.db`.
- **Expected Deliverables:** End-to-end verification of booking, status triage, cancellation, facility profile editing, and clinician roster association.
- **Acceptance Criteria:** Patient books slot -> Doctor sees in triage -> Doctor accepts -> Concurrency guard blocks duplicate slot -> Patient cancels -> History logged.
- **Dependencies:** Express API routes, SQLite schema constraints.
- **Risks:** Unhandled state transitions in appointment lifecycle. *Mitigation: Rely on existing state machine validation in `doctorRoutes.js` and `patientRoutes.js`.*

### Day 3: Data Provenance, Provider Verification, Care at Home, and Emergency Page Behavior
- **Prerequisites:** Day 2 completion.
- **Expected Deliverables:**
  - Audit provenance badges on all doctor and hospital views.
  - Implement a dedicated `/emergency` route featuring local emergency numbers, hospital trauma center list, and dial-112 action links.
  - Upgrade "Care at Home" from static landing copy to an interactive service request form with SQLite persistence.
- **Acceptance Criteria:** Distinct badges displayed based on `provenance_status`; `/emergency` route accessible; home care requests persisted and visible in patient dashboard.
- **Dependencies:** Schema migration for `home_care_requests` table.
- **Risks:** Breaking changes to existing database schema. *Mitigation: Write additive migrations in `initDb.js` without dropping tables.*

### Day 4: Train and Evaluate CareMatch ML (Intent Classifier)
- **Prerequisites:** Labeled clinical navigation symptom dataset.
- **Expected Deliverables:**
  - Dataset split (Train/Val/Test).
  - TF-IDF + Logistic Regression baseline pipeline script.
  - Evaluation report displaying Macro-F1, per-class metrics, confusion matrix.
  - Exported, versioned model artifact.
- **Acceptance Criteria:** Reproducible training script; model achieves $\ge 0.80$ Macro-F1 on test set; inference latency $<50\text{ms}$.
- **Dependencies:** Python 3.10+, scikit-learn, joblib/onnx.
- **Risks:** Imbalanced training classes or medical symptom ambiguity. *Mitigation: Class-weighted loss and explicit out-of-vocabulary fallback handling.*

### Day 5: Implement CARES AI Care Navigator (LLM + RAG Assistant)
- **Prerequisites:** Curated public healthcare navigation documents; access to LLM API or local embedding pipeline.
- **Expected Deliverables:**
  - Document chunking and embedding indexing pipeline.
  - Vector similarity search module with relevance score filtering.
  - Prompt pipeline generating responses strictly grounded in retrieved passages with source citations.
  - Structured backend database lookup tools.
  - Emergency intent detection hook.
- **Acceptance Criteria:** Model cites real source documents; falls back gracefully when evidence is missing; refuses to answer medical diagnostic questions; triggers 112 guidance on emergency queries.
- **Dependencies:** Vector storage mechanism, embedding model.
- **Risks:** Hallucinated clinical advice. *Mitigation: Zero-temperature sampling, strict system boundary prompts, human-in-the-loop disclaimers.*

### Day 6: Integrate AI into Existing Pages, Run Regression Tests, and Prepare Vercel Deployment
- **Prerequisites:** Days 4 and 5 completion.
- **Expected Deliverables:**
  - Embed CareMatch ML search bar into `DoctorDiscovery.jsx`.
  - Embed Care Navigator conversational drawer into public layout.
  - Containerization files (`Dockerfile`, `docker-compose.yml`).
  - Full regression test execution across backend and frontend.
- **Acceptance Criteria:** All 56 backend tests and 39 frontend tests pass without regression; Docker container builds cleanly.
- **Dependencies:** Docker runtime.
- **Risks:** Build failures or bundle bloat from AI dependencies. *Mitigation: Keep ML/LLM services decoupled behind REST microservice endpoints.*

### Day 7: Final Validation, Documentation, and Demonstration
- **Prerequisites:** Day 6 completion.
- **Expected Deliverables:** Complete end-to-end demonstration walkthrough recorded, updated deployment guide, final quality report.
- **Acceptance Criteria:** Multi-role demo executed cleanly across Patient, Doctor, Hospital, and Admin roles using `cares.demo.db`.
- **Dependencies:** All previous milestones.
- **Risks:** Unforeseen live demo data corruption. *Mitigation: Re-seed `cares.demo.db` immediately prior to demo.*

---

## Section O: Instructions for Future AI Coding Sessions

Any AI coding assistant operating in this repository **must strictly observe the following protocol**:

1. **Read `PROJECT_CONTEXT.md` First:** Do not assume repository layout, dependencies, or database configuration. Review this document before proposing changes.
2. **Inspect Existing Files Before Writing Code:** Check existing implementations, styles, and route patterns. Do not rewrite or replace existing architecture without explicit authorization.
3. **Preserve Database Safety Rules:**
   - **Never run seed or destructive scripts against `backend/data/cares.db`.**
   - Check the resolved `DATABASE_PATH` before starting the backend or running migrations.
   - For interactive testing, run against `backend/data/cares.demo.db`.
   - For automated tests, run against `backend/data/cares.test.db`.
4. **Distinguish Data Provenance:**
   - Never invent mock provider records, false medical licenses, or fabricated reviews.
   - Maintain the distinction between `synthetic_demo`, `publicly_sourced`, `registration_checked`, and `cares_verified`.
5. **Security & Secrets Hygiene:**
   - Keep all API keys, JWT secrets, and credentials on the backend.
   - Never commit `.env` files or hardcode secrets in code or documentation.
   - Enforce authorization checks server-side in Express route handlers; never rely solely on frontend UI hiding.
6. **Make Small, Reviewable Changes:** Avoid large, uncoordinated refactors. Deliver changes in bite-sized, logical commits with corresponding test coverage.
7. **Verify After Changing:**
   - Run `npm run test:backend` after backend changes.
   - Run `npm run test:frontend` and `npm run lint` after frontend changes.
   - Confirm that the production bundle succeeds with `npm run build`.
   - Report exactly which files were modified, which tests ran, and their results.
8. **Git Safety:** Never alter Git history, force-push, switch branches, or push to remote repositories without explicit user instruction.
9. **Emergency Safety Messaging:** Never alter, suppress, or hide the emergency guidance notices (calling 112 in India) on public directory pages.

---
*End of CARES Platform Project Context Reference.*

