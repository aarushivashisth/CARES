# CARES deployment guide

Configuration update, 2026-10-30: the current deployment proposal uses Vercel Services, with `backend/index.js` as the Express entrypoint, an independently built Vite frontend, and public service rewrites. Follow [the Services quickstart](VERCEL_QUICKSTART.md) for current build, routing and certificate-path settings. The older single-function layout described below is historical. Service topology is pending owner confirmation; no separate Python runtime exists in `ml/`.

Status: prepared locally, **not deployed**. Production is not ready for approval until the owner completes managed PostgreSQL, preview, live-AI evaluation and recovery checks. No deployment URLs exist. Do not seed a production database or import existing records under this runbook.

## Supported topology and runtime

React/Vite static files and one Express Node 24 function on Vercel; durable managed PostgreSQL via Neon pooled TLS. The function exports the application without starting an unmanaged listener. The trained 8.5 KB JSON model and six-chunk knowledge index are bundled, with no Python or training process at request time. No separate ML or embedding service is required for this prototype. An optional owner-configured Gemini Developer API (free-tier eligible model/account) or Anthropic Messages API supplies real generation; without it the UI explicitly reports unavailability.

Use the repository root as the Vercel project directory. `vercel.json` installs locked backend/frontend dependencies, builds Vite, serves `frontend/dist`, routes `/api/*` to the Node function and supplies SPA fallback. `api/index.js` rejects a missing PostgreSQL URL. CORS and API/cache/security headers are configured in Express; static headers are configured in Vercel. The Node 24 requirement follows built-in SQLite used in local development; the production request path uses pg.

References checked 2026-10-29: [Vercel Node runtime](https://vercel.com/docs/functions/runtimes/node-js), [function limits](https://vercel.com/docs/functions/limitations), [Neon pooling](https://neon.com/docs/connect/connection-pooling), [node-postgres pools](https://node-postgres.com/apis/pool), [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create). Plan-specific limits and pricing can change; review these pages at release.

## Local reproducibility

```sh
npm ci --prefix backend
npm ci --prefix frontend
npm --prefix backend test
npm --prefix frontend test
npm run lint
npm run build
npm --prefix frontend run test:e2e
```

`backend/test/api.test.js` creates its own temporary SQLite file, ignoring existing test database paths. PostgreSQL tests use a newly created PGlite database. Browser tests serve the production build against another fresh synthetic fixture and clean it on shutdown. Browser tests require `npm --prefix frontend exec playwright install chromium`. Use Node 24. ML dependencies are locked in `ml/requirements.txt`; install into a fresh virtual environment and run `python ml/train.py` offline after dependency installation. Regenerate the knowledge index and offline evaluation with the backend scripts.

To view an isolated synthetic production-build demo: `npm run build`, then `node backend/src/scripts/startIsolatedDemo.js`, open `http://127.0.0.1:4173`. Stop with Ctrl-C. This fixture has explicitly synthetic seed accounts; do not expose it publicly. For regular development, copy `backend/.env.example` privately, choose a newly named `DATABASE_PATH`, seed it once only if desired, then run `npm run dev:backend` and `npm run start:frontend`. Protected `cares.db` access is denied unless the owner separately authorizes it and deliberately sets `ALLOW_PROTECTED_DATABASE=true`; this task has not granted or exercised that permission. Seeding refuses any existing nonempty database, even with the live-access flag.

## PostgreSQL setup and migrations — owner gate

1. Create independent development, preview and production databases/branches. Use synthetic records only in development/preview. Never point preview at production.
2. Store a pooled PostgreSQL URL privately in `DATABASE_URL`. Production requires a certificate-verified TLS URL (`sslmode=verify-full`). Set a small database connection budget; the application pool caps each process at three connections with connection/idle timeouts. Pooled endpoint limits and parallel function counts still require managed-service testing.
3. For a new, empty, owner-approved database, run `npm --prefix backend run db:migrate:postgres -- --confirm-migrations` in a private environment containing only that target URL. This transaction records checksums in `schema_migrations`. Previously applied SQL must not be edited; add a new version instead. An existing unversioned database is refused.
4. Create the initial administrator using the private CLI `node backend/src/scripts/createAdmin.js --confirm-admin-create`. Set `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` privately in that one shell session (12+ characters, at most 72 UTF-8 bytes); clear them immediately afterward. Do not set bootstrap credentials in Vercel or share them in chat. This creates one administrator and audit record, no demo providers.
5. Run integration smoke tests against the owner-approved preview target with synthetic users. Local PGlite validation is useful SQL evidence but does not replace real PostgreSQL network/TLS/pooling checks.

`docs/DATA_MIGRATION_DRY_RUN.json` is a schema-only dry-run plan: no source database opened, no rows counted, no target contacted. Existing-data export/import requires written authorization, a consistent verified backup and a separate reviewed executable migration. No accounts are silently reset. Do not substitute seed scripts for migration.

## Vercel environments

| Variable | Scope | Secret? | Required behavior |
|---|---|---|---|
| NODE_ENV=production | Function | Public | Strict JWT validation |
| DATABASE_URL | Function, separate preview/production | **Secret** | Pooled PostgreSQL URL with sslmode=verify-full |
| JWT_SECRET | Function, separate per environment | **Secret** | Random 32+ characters; no placeholder/dev value |
| JWT_EXPIRES_IN=1h | Function | Public | Suggested short bearer-token lifetime |
| CLIENT_ORIGIN | Function | Public | Exact HTTPS frontend origin, no path |
| TRUST_PROXY=1 | Function | Public | Bounded hop count; verify real client IP in preview |
| LLM_PROVIDER | Function | Public | `gemini` for the demo or `anthropic` for the existing path |
| GEMINI_API_KEY | Function only | **Secret** | Private Gemini key; free-tier eligibility is account-controlled |
| GEMINI_MODEL | Function | Public | `gemini-3.5-flash-lite` demo suggestion, verify account access |
| ANTHROPIC_API_KEY | Function only, alternative | **Secret** | Existing provider key when LLM_PROVIDER=anthropic |
| ANTHROPIC_MODEL | Function, alternative | Public | Existing provider model ID |
| VITE_API_URL=/api | Frontend build only | Public | Same-origin API; default already /api |

Do not set `DATABASE_PATH` or `ALLOW_PROTECTED_DATABASE` in Vercel. No embedding keys, model-hosting tokens or external ML URLs are needed. Frontend secrets are prohibited. `LLM_PROVIDER` selects the backend transport. Gemini uses `GEMINI_API_KEY` and `GEMINI_MODEL` with the documented generateContent REST API; Anthropic uses its existing key/model and Messages API. Without an explicit provider, a configured Gemini key selects Gemini, otherwise the legacy Anthropic path is retained. There are no automatic retries or cross-provider fallbacks. Validate the selected model before enabling the feature for real users.

## Preview smoke checklist — owner approval required

- Connect the intended GitHub repository/account to Vercel and confirm branch/root settings manually. No push was made by this task.
- Approve a private preview deploy with isolated PostgreSQL. Configure exact preview origin and separate JWT secret. Deployment protection may require manual sign-in for browser tests.
- Verify `/api/health` returns HTTP 200 and database connected; unavailable databases must produce 503 without connection details.
- Visit and refresh `/doctors/2`, `/hospitals`, `/emergency`, `/navigator`, `/home-care` and authenticated portals. Confirm API requests never receive SPA HTML.
- Register a synthetic patient, apply as a synthetic doctor, review/clarify/approve from an authorized admin, then test request/accept/decline/cancel/complete and conflict rules.
- Create home-care enquiries; verify reload persistence, patient isolation and admin review/history. Never call an enquiry a confirmed booking.
- Test CORS allowed/denied origins, headers, malformed payloads, JWT expiry, non-owner access and rate limits across separate function instances. A bounded proxy/IP policy is a release requirement.
- Measure warm and cold `/api/ai/carematch` and `/api/ai/navigate` latency. Exercise model/provider timeout and insufficient-source behavior. Verify citation excerpts and no unauthorized records sent to the model.
- Record actual preview URL, deployment ID, database migration versions, test output and owner review. None are currently claimed.

The application caps JSON at 1 MB, function duration at 30 seconds and LLM calls at 15 seconds / 1,024 Gemini generated tokens or 700 Anthropic output tokens. Review platform request/response body limits, bundled-function size, memory, duration, concurrency and plan allowances against the actual preview artifact. No cold-start or managed-cloud availability measurements have yet been made. Use one shared PostgreSQL rate counter per endpoint scope and hashed IP window; local in-memory tests do not substitute for distributed verification.

## Backup, rollback and operations

Enable the database provider's appropriate backup/PITR retention before production. Take a provider-consistent snapshot before each schema change, and restore it to a separate isolated database to verify recovery. Keep encrypted backups access-controlled; never store patient exports in Git or build artifacts. The provider's free tier may not include required retention, recovery or compliance controls; obtain budget approval.

Application rollback uses the previous known-good Vercel deployment. Additive schema tables should remain in place; do not automatically drop tables on rollback. Database rollback requires a tested restore to a new database and explicit owner approval before switching the production URL. Existing-data migration needs a maintenance/cutover plan and reconciliation; keep the original source intact and do not operate on protected live SQLite without authorization.

Monitor sanitized error counts, health, database connections, query latency, auth/AI 429s, provider failures and cost. Logs must exclude questions, patient records, contact/address fields, passwords, keys, tokens and connection strings. Rotate keys and suspend compromised users. Current bearer logout clears the browser token; it does not revoke a copied token, so use a short lifetime and consider token revocation/HttpOnly sessions before clinical production.

No paid infrastructure, domain, public deployment, existing-data import or production database changes have been performed. Production deployment is a final explicit owner gate after preview and recovery evidence.

## Platform limits reviewed

On 2026-10-29, the [Vercel limits documentation](https://vercel.com/docs/functions/limitations) listed a 4.5 MB request/response payload ceiling and a standard 250 MB uncompressed Node function bundle ceiling. The application chooses a smaller 1 MB request body and 30-second execution budget, with a 15-second LLM timeout. Actual function artifact size, cold starts, concurrency and plan settings still need preview measurement. No large-function beta or additional platform environment variables are required by this implementation.

The [supported Node versions page](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), checked 2026-10-29, explicitly supports the configured `24.x` engine range. This documentation check and local module-load smoke test do not replace a cloud preview build.

## Gemini private setup

Copy `backend/.env.example` to `backend/.env` privately if it does not yet exist; retain a safe isolated database choice. Set:

```dotenv
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_private_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

The key placeholder is illustrative and must be replaced privately. Restart the backend and ask a non-sensitive service question at `/navigator`. No Gemini key was found in the current workspace, so live success is not claimed. Configure these same three variables only in the Vercel **function** environment when preview deployment is approved; never add them as `VITE_*` variables.

Google references checked 2026-10-29: [generateContent REST](https://ai.google.dev/api/generate-content), [available models](https://ai.google.dev/gemini-api/docs/models), [pricing and data use](https://ai.google.dev/gemini-api/docs/pricing). The recommended model is free-tier eligible according to that page, but your project tier, region and quotas determine availability/charges. Keep billing disabled for a free-only demo; synthetic, non-sensitive prompts only. A 429 is returned as a quota/rate-limit error with no fallback. API keys are in request headers, never query strings.

The explicitly owner-run evaluator accepts `--authorize-live-evaluation`; the older `--authorize-billable-evaluation` remains an alias for existing workflows. Paid accounts still require separate budget approval. The evaluator never runs during tests/builds and does not assume that a key is on a free project.
