# CARES React frontend

React/Vite client for the CARES API. Use Node 24. From repository root: `npm ci --prefix frontend`, `npm run start:frontend`, `npm run lint`, `npm run build`, `npm --prefix frontend test`.

API base defaults to `/api`; Vite proxies it to the local backend on port 5000, and Vercel routes it to Express. `VITE_API_URL` is public. Never place model keys, JWT secrets or database credentials in Vite variables.

Routes include `/doctors`, `/hospitals`, `/emergency`, `/home-care`, `/navigator`, `/apply-doctor`, restricted `/doctor/application` and role dashboards. Synthetic data is labeled. A request is not automatically confirmed.

Browser checks: build first, then `npm --prefix frontend run test:e2e`. Playwright uses a fresh synthetic database and a production-build local server. See [deployment guide](../docs/DEPLOYMENT_GUIDE.md), [test evidence](../docs/TEST_EVIDENCE.md) and [manual actions](../MANUAL_ACTIONS_REQUIRED.md).
