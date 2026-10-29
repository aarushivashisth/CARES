# Test evidence

Execution date: 2026-10-29, macOS arm64, Node 24.22.1. Historical reports were independently rerun. Protected live database never opened. No pre-existing test/demo database used. Each SQLite suite uses `mkdtemp`; PostgreSQL tests use a newly created on-disk PGlite database and remove only that temporary directory.

| Check | Executed command | Actual result |
|---|---|---|
| Baseline backend | `npm --prefix backend test` (local server permitted outside sandbox) | 61/61 passed |
| Baseline frontend | `npm --prefix frontend test` | 51/51 passed |
| Baseline lint / build | `npm run lint` / `npm run build` | Passed |
| Home-care increment backend / frontend | same suite commands | 62/62; 56/56 passed |
| Earlier full backend snapshot | `npm --prefix backend test` | 79/79 passed; includes PostgreSQL, AI, deployment guards and restricted onboarding |
| Earlier frontend component snapshot | `npm --prefix frontend test` | 62/62 passed before restricted-onboarding UI additions; final rerun pending |
| ML training | `/private/tmp/cares-ml-venv/bin/python ml/train.py` | Completed; 80 synthetic examples, 15 held-out examples |
| Node/sklearn parity | `node --test backend/test/ai.test.js` | 7/7 passed, including 15 held-out probability vectors |
| Offline retrieval and safety | `node backend/src/scripts/evaluateAI.js` | Recall@3 12/12; top-1 12/12; safety 10/10; CareMatch guards 12/12 |
| Initial browser run | `npm --prefix frontend run test:e2e` | Failed: isolated fixture CORS origin mismatched port 4173; registration locator also incorrect. Corrected fixture and locator; rerun pending |

Backend PostgreSQL tests are a real embedded PostgreSQL engine, not SQLite emulation. They do not validate Neon network connections, pooled TLS, Vercel routing, multi-instance concurrency or managed backup restoration. Live LLM generation was not run. Citation tests use explicitly mocked transport and do not measure live faithfulness.

Failed incremental runs were used to correct integration defects and new test setup errors. Existing test expectations were preserved, except emergency assertions intentionally updated for corrected safety copy and source-link markup. No old test was deleted.

## Final acceptance evidence

All results below ran successfully on 2026-10-29 unless explicitly described as an intentional refusal.

| Command / check | Actual final result | Coverage / scope |
|---|---|---|
| `npm --prefix backend test` | **83 passed, 0 failed, 0 skipped** | Existing SQLite suite plus home care, AI ownership, malformed inputs, PGlite migrations/workflows/rollback/persistence, shared counters across middleware instances, owner admin bootstrap and production guards |
| `npm --prefix frontend test` | **65 passed across 9 files** | Existing components plus home care, AI/onboarding and API routing/error handling |
| `npm run lint` | **Passed** | ESLint frontend and browser/config sources |
| `npm run build` | **Passed** | Vite production bundle: JS 443.32 kB / gzip 122.30 kB; CSS 56.67 kB / gzip 10.56 kB |
| `npm --prefix frontend run test:e2e` | **16 passed** | Eight workflows × desktop/mobile Chromium, production frontend build with new synthetic SQLite fixture |
| `/private/tmp/cares-ml-venv/bin/python ml/train.py` | **Completed** | Actual 50/15/15 grouped train/validation/test split; baseline and neural comparison |
| `node --test backend/test/ai.test.js` | **8 passed** | Node/sklearn parity, safe inference, deterministic retrieval, citation contracts, bounded follow-up context; mocked generation explicitly labeled |
| `node backend/src/scripts/buildKnowledge.js` | **6 chunks indexed** | Deterministic traceable sparse vector index |
| `node backend/src/scripts/evaluateAI.js` | **12/12 top-1 and recall@3; safety 10/10; CareMatch guards 12/12** | Offline authored evaluation; no external model request |
| `node backend/src/scripts/benchmarkInference.js` | **Completed** | 1,000 warm calls / five cold local Node launches; full scope in JSON |
| `node backend/src/scripts/planDataMigration.js` | **Schema-only plan emitted** | Zero source opens, zero target connections, zero records migrated |
| `node backend/src/scripts/evaluateLiveNavigator.js` without authorization flag | **Intentional exit 1, authorization gate confirmed** | No provider calls or billable evaluation |
| `python3 scripts/releaseAudit.py` | **Passed** | No detected high-risk patterns; no tracked DB/private env; existing archive entry names only, no database content read |
| `git diff --check` | **Passed** | Whitespace/error check |

Browser workflows: emergency API failure/immediate dial/refresh; patient home enquiry to admin review; real model plus private lookup denial; registration/pending doctor application; patient request → doctor accept → patient cancel; doctor application → admin approval → successful practice login; hospital explicit/unknown hours persistence; public page viewport/refresh. No external providers or real patient records were used. Earlier browser failures were fixture CORS, selector naming and dismissal of an existing native cancellation confirmation; corrected tests and explicit accessible names passed all 16.

Not executed: Vercel CLI/preview/cloud build, live managed PostgreSQL connection/pooling/TLS and recovery, distributed network/load tests, live LLM answers/faithfulness/cost, actual emergency calls, clinical evaluation, independent screen-reader or non-Chromium browser review. These remain owner gates, not passing tests. Initial sandbox-blocked API runner processes were stopped after successful permitted runs.

Production-entry smoke check: a Node process with synthetic nonconnecting production configuration imported `api/index.js` and the installed `pg` package successfully, verified the Express export and Pool constructor, and exited without a listener or database connection. This checks dependency/module loading locally, not the Vercel cloud build.

## Gemini follow-up verification (2026-10-29)

- `node --test backend/test/ai.test.js backend/test/llmProvider.test.js`: 14/14 passed (eight existing AI checks plus six mocked Gemini contract cases).
- `npm --prefix backend test`: 90/90 passed, including the new local HTTP RAG-to-mocked-Gemini case and all existing isolated SQLite/PostgreSQL workflows.
- `npm --prefix frontend test`: 65/65 passed.
- `npm run lint` and `npm run build`: passed; frontend bundle unchanged by the backend provider adapter.
- `node backend/src/scripts/evaluateAI.js`: retrieval top-1/recall@3 12/12, safety 10/10, CareMatch guard cases 12/12.
- `node backend/src/scripts/evaluateLiveNavigator.js` without authorization: expected refusal before any provider request, verified.
- Source/bundle scan and whitespace review rerun after edits; no secrets or databases added.

Mocked Gemini cases verify header-only authentication, retrieved context, JSON schema/token limit, thought filtering, token accounting, blocked/truncated/malformed responses, invalid citation IDs, quota/provider errors without fallback, timeout, absent credentials and emergency bypass. The HTTP test verifies actual endpoint wiring and public error/citation shape. No live Gemini request, quality/cost measurement, external database operation or deployment was executed. The 16 prior desktop/mobile browser passes remain historical acceptance evidence; this follow-up did not change frontend UI or rerun those browser cases.

## Git publication checks

Immediately before the owner-authorized commit/push, `npm --prefix backend test` passed 90/90, `npm --prefix frontend test` passed 65/65, and `npm run lint` / `npm run build` passed again. `git fetch origin` succeeded and there was no divergence before the release commit. Secret-pattern, deployment-bundle and database-file checks passed. These publication checks did not call a real LLM, open protected records or perform any deployment.
