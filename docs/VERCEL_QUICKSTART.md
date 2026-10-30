# Deploy the current CARES demo to Vercel

This deploys the React frontend and Express API together from the repository root. The Supabase database already has migrations 001–003 and owner-requested fictional sample data. Deployment itself has not been run by this guide.

## 1. Import GitHub

Open https://vercel.com/new, connect the GitHub account with access to `aarushivashisth/CARES`, and import that repository. Select:

| Setting | Value |
| --- | --- |
| Production branch | `master` |
| Root Directory | Repository root (`./`), not `frontend` or `backend` |
| Framework Preset | Other |
| Node.js | 24.x |
| Install Command | `npm ci --prefix backend && npm ci --prefix frontend` |
| Build Command | `npm run build` |
| Output Directory | `frontend/dist` |

`vercel.json` already supplies the install/build/output settings, API routing, SPA fallback, and public CA certificate bundling. No separate backend host or Start Command is needed. Use a protected demo deployment while it contains sample administrator/provider accounts.

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
sslmode=verify-full&sslrootcert=backend/certs/supabase-ca.crt
```

Use `?` before the first query parameter and `&` between parameters. The certificate is bundled with the function; no local `/Users/...` path will work on Vercel. Keep certificate and hostname verification enabled. Do not use the Supabase frontend project URL, anon key or service-role key as `DATABASE_URL`.

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
- `ENOENT` opening a certificate: remove the local Mac path and use `backend/certs/supabase-ca.crt`; confirm Root Directory is the repository root.
- `503` health: inspect sanitized function logs for database network, authentication or schema errors; use the dashboard's pooled connection string.
- JWT or origin validation failure: use a new 32+ character random signing secret and exact HTTPS `CLIENT_ORIGIN`.
- API returns HTML: retain the repository's `vercel.json` API rewrites and root directory.
- Gemini `429` or unavailable: check the selected account's quota, key and model access; the app does not switch to another paid provider automatically.

Official references checked 2026-10-30: [Vercel Git import](https://vercel.com/docs/git), [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [function file bundling](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions), [environment variables](https://vercel.com/docs/environment-variables/managing-environment-variables), and [Supabase connections and TLS](https://supabase.com/docs/guides/database/connecting-to-postgres).
