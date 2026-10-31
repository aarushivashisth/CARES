# Deploy CARES with Vercel Services

The root `vercel.json` configures two independently built services, sharing one project and public origin. This proposal preserves the existing architecture; the service names, public routes, bindings and whether to introduce a Python inference service are pending owner confirmation. No cloud deployment has been run.

| Service | Root / entrypoint | Public paths | Calls to another repository service |
| --- | --- | --- | --- |
| `backend` | `backend/`, Express `index.js` | `/api` and `/api/*`, with the prefix preserved | None: inference and retrieval run in-process; PostgreSQL and Gemini/Anthropic are external dependencies |
| `frontend` | `frontend/`, static Vite build | All remaining paths, including client-side route refreshes | None from server-side functions; browser requests use the shared public `/api` URL |

There is no HTTP app in `ml/`: it trains models offline and exports the model consumed by Node. It is not declared as a deployable service. Creating a private Python service would be an architecture change requiring its own HTTP entrypoint, backend caller, and a binding declared on the backend; that choice has been asked separately.

No service bindings are currently declared because there are no server-to-server calls between repository services. Bindings are function-runtime values, unavailable to Vite's build or a browser, so no artificial frontend binding or `VITE_*` internal URL is configured. Do not manually set binding variables if a future service adds them.

## 1. Import GitHub

Open https://vercel.com/new, connect the GitHub account with access to `aarushivashisth/CARES`, and import that repository. Select:

| Setting | Value |
| --- | --- |
| Production branch | `master` |
| Root Directory | Repository root (`./`), not `frontend` or `backend` |
| Framework Preset | Service-local: Express for backend, Vite for frontend |
| Node.js | 24.x |
| Project-wide install/build/output overrides | Leave unset; each service owns these settings |

The backend service installs with `npm ci`, exports `backend/index.js`, and bundles `src/ai/**` plus `certs/*.crt` relative to its own root. It starts no listener and runs no schema initialization or seeding when imported. The frontend service installs with `npm ci`, builds with `npm run build`, emits `dist`, and owns the SPA fallback. That fallback matches the app's extensionless browser paths while excluding files with extensions and Vite's `/@...` development endpoints, so scripts, styles and images retain their real content types in both local Services mode and production. Top-level configuration owns public routing and shared headers only. The legacy root `api/index.js` has been removed so it cannot conflict with service routing. Use a protected demo deployment while it contains sample administrator/provider accounts.

## Local service development

From the repository root, run:

```sh
vercel dev
# Or, without linking or authenticating to a cloud project:
vercel dev --local
```

Vercel runs both services and routes requests on one local origin. For any future declared bindings, the CLI injects their runtime URLs automatically; do not hardcode or manually set them. The existing separate `npm run dev:backend` / `npm run start:frontend` commands remain available as a standalone workflow; Vite's port-5001 proxy is only for that workflow.

Use a separately approved database for local database operations. The existing `npm --prefix frontend run test:e2e` command instead starts a disposable SQLite fixture; it never writes test accounts to Supabase. `vercel dev` validates the actual service layout and routing, while the browser suite validates application workflows with isolated data.

## 2. Configure environment variables before deploying

Use the environment scope you intend to deploy. Keep preview and real production data separate. The existing sample database can serve a demonstration deployment; its data is fictional.

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Private Supabase transaction-pooler URL from the **same project** as the sample database, with the TLS parameters below |
| `JWT_SECRET` | New random secret of at least 32 characters; do not reuse a placeholder |
| `JWT_EXPIRES_IN` | `1h` |
| `CLIENT_ORIGIN` | Exact HTTPS domain assigned to this Vercel project, such as `https://your-project.vercel.app`, without a path or trailing slash |
| `TRUST_PROXY` | `1` |
| `VITE_API_URL` | `/api` |
| `LLM_PROVIDER` | `gemini` if enabling the assistant |
| `GEMINI_API_KEY` | Your private Gemini key, if enabling the assistant |
| `GEMINI_MODEL` | Your configured, account-supported Gemini model ID |

Generate a signing secret privately with `openssl rand -hex 32`. Paste the result only into Vercel's environment settings. Do not add database credentials, signing secrets or provider keys as `VITE_*` variables.

### Supabase connection and certificate

In Supabase, open the existing project, click **Connect**, and choose **Transaction pooler**. Copy its connection string, substitute your privately held database password, and percent-encode reserved password characters. Copy the dashboard's host, port and username exactly; pooled credentials differ from direct connection credentials. Do not change the local `.env` just to configure Vercel.

In the Vercel copy of that URL, preserve other parameters, replace any existing `sslmode`/`sslrootcert`, and set:

```text
sslmode=verify-full&sslrootcert=certs/supabase-ca.crt
```

Use `?` before the first query parameter and `&` between parameters. Configuration resolves certificate paths against the backend directory, independently of the runtime working directory. The previous `backend/certs/supabase-ca.crt` setting remains compatible, but no local `/Users/...` path will work on Vercel. Keep certificate and hostname verification enabled. Do not use the Supabase frontend project URL, anon key or service-role key as `DATABASE_URL`.

Do not set `PORT`, `DATABASE_PATH`, `ALLOW_PROTECTED_DATABASE`, admin bootstrap passwords or sample passwords in Vercel. Local `.env` and `backend/.sample-accounts.json` are excluded from Git/deployment uploads. Sample logins are database records; their passwords can be read privately from that local file.

## 3. Deploy and verify

Click **Deploy**. If the final domain differs from the anticipated domain, set `CLIENT_ORIGIN` to the exact assigned HTTPS origin, then redeploy. Environment-variable changes apply to new deployments.

Check the assigned domain:

- `/api/health`: HTTP 200, `status: ok`, `database: connected`.
- `/api/doctors`: the three fictional doctors, each marked synthetic.
- `/api/hospitals`: the fictional Riverside Medical Center.
- `/doctors`, `/hospitals`, and a direct refresh on `/doctors/1`: page and API routing work.
- `/login`: use the privately saved sample patient/admin/doctor/hospital logins and inspect their dashboards. Sofia uses application-status sign-in while pending review.
- `/navigator`: test a non-sensitive sample question if Gemini is enabled. A configured key alone does not establish provider/model access or answer quality.

The existing database is already migrated and populated. Do not add migrations or sample imports to the Vercel build/start commands. If you intentionally select a different database, initialize that separately with the reviewed migrations before expecting `/api/health` to pass.

## Troubleshooting

- `SELF_SIGNED_CERT_IN_CHAIN`: verify both TLS query parameters and that the deployment uses this commit with the bundled CA.
- `ENOENT` opening a certificate: remove the local Mac path and use `certs/supabase-ca.crt`; confirm the project Root Directory is the repository root and the backend service root is `backend`.
- `503` health: inspect sanitized function logs for database network, authentication or schema errors; use the dashboard's pooled connection string.
- JWT or origin validation failure: use a new 32+ character random signing secret and exact HTTPS `CLIENT_ORIGIN`.
- API returns HTML: retain the repository's `vercel.json` API rewrites and root directory.
- Gemini `429` or unavailable: check the selected account's quota, key and model access; the app does not switch to another paid provider automatically.

Official references checked 2026-10-30: [Vercel Services](https://vercel.com/docs/services), [service configuration](https://vercel.com/docs/services/config-reference), [routing and preserved paths](https://vercel.com/docs/services/routing), [runtime-only bindings](https://vercel.com/docs/services/bindings), [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [environment variables](https://vercel.com/docs/environment-variables/managing-environment-variables), and [Supabase connections and TLS](https://supabase.com/docs/guides/database/connecting-to-postgres).
