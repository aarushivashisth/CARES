# CARES capstone report

Evidence date: 2026-10-29. This report describes implemented source and executed local experiments. It does not claim a public deployment, live LLM quality, clinical validation or a managed production database already operating.

## Executive summary

CARES coordinates access to healthcare directories, appointment requests, provider credential review and non-emergency home-service enquiries. The existing React/Express application was extended with persistent Care at Home requests, safer emergency information, doctor application and restricted clarification access, a reproducible specialty-intent ML prototype, document retrieval with real backend Gemini/Anthropic LLM integration, bounded live-data lookup tools, PostgreSQL support and Vercel deployment configuration. Existing workflows and tests were retained. All existing records and the protected live SQLite database were left untouched.

The implementation is locally demonstrable. Production acceptance is conditional on owner-created PostgreSQL, preview deployment, backup/restore checks, provider credentials and budget approval, and live RAG evaluation. Clinical symptom classification is intentionally outside the evidence supported by the small synthetic dataset.

## Problem, objectives and existing system

Patients face fragmented provider information and uncertain appointment status. Providers need controlled request handling and credential review. Institutions need to maintain accurate directory details. Emergency users need immediate public-service contacts without waiting for a website. AI adds risk when a directory or prototype infers clinical meaning, invents availability or cites nonexistent material.

Objectives are to connect these workflows with explicit ownership and status, preserve provenance, avoid fabricated operational claims, introduce reproducible navigation experiments and prepare durable deployment without changing live data. The baseline used React/Vite, Express, synchronous SQLite, JWT and bcrypt. Patient, doctor, hospital and admin modules already existed. Care at Home was a landing fragment; ML and RAG were proposals; frontend API fallback used localhost; cloud documentation proposed a different architecture. The initial independent baseline passed 61 backend and 51 frontend tests plus lint/build.

## Requirements and implementation mapping

| Area | Implemented behavior | Evidence | Limitation / gate |
|---|---|---|---|
| Patient access | Registration, login/logout, own profile and appointments | auth/patient routes; frontend dashboards; API/component/browser suites | Browser logout does not revoke a copied bearer token |
| Provider discovery | Actual directory, filters, profiles and provenance | doctor/publicHospital routes; discovery/profile pages | No invented fallback providers, location distances, gender or live availability |
| Appointment lifecycle | Requests, acceptance, decline, cancel, complete, history, notes, conflict guards | patient/doctor routes; existing 61-test regression baseline plus additions | Published slots are options, not external scheduling guarantees |
| Doctor onboarding | Application, pending restricted session, clarification and admin decision | application pages; auth/RBAC; PostgreSQL integration | Genuine credentials require human review |
| Hospital management | Scoped profile/departments/affiliations, validated URLs/JSON/hours | hospital routes and dashboard; regression tests | Institutional account provisioning remains owner-controlled |
| Verification | Own-app prohibition, decisions, provenance and audit | admin routes; existing and PostgreSQL workflow checks | No automated registry verification or notification delivery claimed |
| Care at Home | Patient-owned persistent enquiries and admin review/history/cancellation | migration 002; homeCareRoutes; HomeCare.jsx; API/component/browser checks | No booked visit, price, availability or assigned caregiver |
| Emergency | Source-linked contacts with regional scope, immediate tel links, unknown hours, directory states | EmergencyResources.jsx; emergency tests; browser failure/refresh tests | No dispatch or live capacity; phone operations not tested |
| CareMatch | Real offline TF-IDF/logistic model; small neural comparison; safe inference and actual directory lookup | ml/*; carematch.js; parity/evaluation files | Synthetic explicit intents only; symptom mapping and clinical reliability unvalidated |
| Navigator | Vector retrieval, real Anthropic request path, citation validation, bounded structured queries | ai/*; aiRoutes; CareNavigator.jsx; offline and mocked tests | Key/model/budget absent; live groundedness and usefulness not measured |
| Production data | Async shared route adapter, PostgreSQL migrations/constraints/transactions/rate counters | database.js; migrate.js; PGlite integration | No managed PostgreSQL TLS/pooling/load/restore evidence yet |
| Deployment | Vercel app export, API/SPA routing, runtime/env/security gates | api/index.js; vercel.json; deployment tests | Owner-approved preview and production release pending |

## Methodology and design

Work proceeded through source audit, safety baseline, incremental implementation, regression testing and release documentation. Newly named temporary databases isolate all automated checks. No seed, correction or migration script targeted protected or pre-existing databases. Additive SQL defines new home-service and shared-rate-limit tables. Production schema deployment is explicit and version/checksum tracked. Existing data transfer is a separate unauthorized operation; the delivered dry-run artifact is schema-only.

System components, ER relationships, workflow sequence and deployment data flow are documented with Mermaid diagrams in `docs/ARCHITECTURE.md`. The same routes operate with SQLite development and PostgreSQL production adapters. Async transaction serialization protects local SQLite; PostgreSQL uses transaction clients, uniqueness constraints and a conservative lock for appointment transitions. Conditional updates detect stale state.

Role authorization derives identity and account state from the database. Doctor review sessions are restricted by purpose and route, supporting clarification without granting practice access. Home-service contact/location data is visible only to its patient and authorized administrators. Structured AI tools bind validated parameters; no LLM-produced SQL is executed. Private appointment data never enters the model context.

## Care at Home and emergency design

Home-care service choices are nursing, physiotherapy and elder support enquiries. The date is bounded to a real date within 90 days; contact and location fields have length/type constraints. Status history and audit entries are written transactionally. List responses omit private address/phone, which require a detail request with ownership checks. Review can move to under_review, contacted, closed or declined; patient cancellation is limited to nonterminal enquiries. UI wording consistently distinguishes an enquiry from a booking.

The emergency page exposes 112 independently of directory loading and qualifies state-dependent 108/102 services. 1075 is identified as COVID-19 information, and 104 as a participating-state service with an Assam source. Official links and access dates are visible. No current call-handler availability, bed capacity, ambulance dispatch or wait-time evidence is asserted. Unknown hospital hours stay unknown across API fallback, public cards and facility management defaults. Synthetic demonstration facilities remain labeled.

## Machine learning and RAG evaluation

Detailed methods and actual metrics are in `docs/AI_EVALUATION.md`; machine-readable outputs are in `ml/evaluation.json` and `evaluation/offline-results.json`. The dataset has 80 authored synthetic explicit specialty intents, with template-group separation into 50 training, 15 validation and 15 held-out examples. C tuning uses validation only. The baseline macro-F1 is 0.667619 and the two-hidden-layer MLP macro-F1 is 0.670000 on the same held-out set. These small results do not validate clinical or symptom routing. Logistic regression is deployed as a compact transparent JSON artifact; Node/sklearn probability parity is verified.

The six-chunk corpus contains short attributed factual summaries and project-authored workflow documents. Sparse TF-IDF vectors provide genuine ranked document retrieval without an external embedding account. Twelve local questions achieved 12/12 top-1 and recall@3; ten safety/abstention cases passed. These small authored sets are narrow smoke evidence. Mocked transport tests validate context delivery and citation IDs, not answer quality. Live generation, faithfulness, citation support, usefulness, operational failure rate, cloud latency and cost are explicitly unmeasured until the owner configures and approves the real LLM.

## Security, privacy and evaluation limits

Production secret placeholders fail startup. Passwords use bcrypt, bearer JWTs are algorithm-restricted and active users are rechecked. HTTPS origin validation, API no-store headers, content/security headers, bounded input parsing and atomic shared PostgreSQL rate counters are implemented. Public response errors omit raw database messages. Deployment ignores local databases, environment files, archives, tests and training data.

Residual risks include localStorage tokens, copied-token logout behavior, English keyword emergency detection, incomplete automated prompt-injection/PII detection, no independent clinical review, no managed-service concurrency tests and manual institutional account provisioning. A small corpus cannot answer general medical questions. There is no evidence that any AI answer is physician-reviewed. No compliance certification is claimed. Rate-counter IP derivation, TLS pools, backup retention and restoration require staging verification.

## Testing, deployment and reproducibility

Executed commands, counts and failed-iteration explanations are recorded in `docs/TEST_EVIDENCE.md`. Tests cover baseline workflows, additive features, ownership/RBAC, conflict/status rules, model parity, retrieval/citation contracts, production configuration, database persistence and real Chromium desktop/mobile navigation. Browser tests use a production frontend build and a fresh synthetic API fixture. They are not Vercel preview evidence. Screenshots are not invented; test traces are local generated artifacts excluded from deployment and Git.

`docs/DEPLOYMENT_GUIDE.md` contains setup, explicit PostgreSQL migration, administrator bootstrap, private configuration, preview smoke checks, backup/recovery, rollback and operational limits. `MANUAL_ACTIONS_REQUIRED.md` is the owner checklist. `docs/DATA_MIGRATION_DRY_RUN.json` records zero source opens and zero transfers. Implementation was initially left uncommitted; the owner subsequently authorized a release commit and push. Consult Git history and remote state for the actual publication result.

## Future work and viva walkthrough

Future work: licensed clinician-reviewed navigation labels, larger group/source-disjoint external evaluation, multilingual safety assessment, stronger session revocation/HttpOnly storage, semantic retrieval after measured need, richer authorized tools, institution provisioning, independent accessibility testing, multi-instance load/limiter verification, and production privacy/compliance review.

For a viva, first show the safety boundaries and labeled synthetic fixture. Demonstrate patient registration, provider discovery and request/accept/cancel with status visibility. Show pending doctor application/clarification and admin review, hospital management, and a home-care enquiry with history. Disable the directory request on the emergency page to demonstrate immediate telephone links and failure handling. Run CareMatch inference and show actual metrics/confusion errors. Rebuild the knowledge index and demonstrate source retrieval. Explain that real LLM generation is a configured integration with a clearly identified live-evaluation gate; do not substitute a mock as a live demonstration. Finish with test evidence, deployment configuration and outstanding owner actions.

## References and acknowledgments

- [ERSS, Government of India](https://112.gov.in/), emergency contact facts; accessed 2026-10-29.
- [National Health Mission, ERS/Patient Transport Service](https://nhm.gov.in/nhm_live/index1.php?lang=1&level=2&lid=189&sublinkid=1217), regional ambulance arrangements; accessed 2026-10-29.
- [MoHFW COVID-19 dashboard](https://covid19dashboard.mohfw.gov.in/), 1075 listing; accessed 2026-10-29.
- [Assam Health and Family Welfare, 104 service](https://hfw.assam.gov.in/how-to/get-emergency-services-through-104), state-specific service description; accessed 2026-10-29.
- [MedQuAD original repository](https://github.com/abachaa/MedQuAD), dataset licensing/annotation review only; not used for training; accessed 2026-10-29.
- [Vercel runtime documentation](https://vercel.com/docs/functions/runtimes/node-js), [function limits](https://vercel.com/docs/functions/limitations), [Neon pooling](https://neon.com/docs/connect/connection-pooling), [node-postgres](https://node-postgres.com/apis/pool), and [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages/create), deployment/integration references; accessed 2026-10-29.

All metrics are project measurements or explicitly marked unmeasured. No outside research results, clinical claims, completed deployments or screenshots have been invented.

Gemini follow-up: the real provider adapter now supports a Gemini free-tier eligible demo configuration alongside Anthropic. Provider response parsing and citation contracts pass mocked tests; no key is configured locally and no live-model quality score is claimed. See deployment/evaluation documents for supported variables and account/privacy limits.
