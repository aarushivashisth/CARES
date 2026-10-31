# CARES React frontend

React/Vite client for the CARES API. Use Node 24. From repository root: `npm ci --prefix frontend`, `npm run start:frontend`, `npm run lint`, `npm run build`, `npm --prefix frontend test`.

API base defaults to `/api`. In Vercel Services, top-level routing sends `/api` requests to the Express backend while other paths reach this static Vite service. The browser uses the shared public origin; a runtime-only service binding cannot be used in a static browser bundle. Keep `VITE_API_URL=/api` (or unset it), and never put model keys, JWT secrets, database credentials, or internal service URLs in Vite variables.

Run both services from the repository root with `vercel dev` (or `vercel dev --local` without cloud linking). The standalone `npm run dev` command retains its local proxy to port 5001; that proxy is only for running Vite separately and is not used for production service discovery.

Routes include `/doctors`, `/hospitals`, `/emergency`, `/home-care`, `/navigator`, `/apply-doctor`, restricted `/doctor/application` and role dashboards. Synthetic data is labeled. A request is not automatically confirmed.

Browser checks: build first, then `npm --prefix frontend run test:e2e`. Playwright uses a fresh synthetic database and a production-build local server. See [deployment guide](../docs/DEPLOYMENT_GUIDE.md), [test evidence](../docs/TEST_EVIDENCE.md) and [manual actions](../MANUAL_ACTIONS_REQUIRED.md).
