# Supabase database certificate

`supabase-ca.crt` is the public Supabase Root 2021 CA certificate, downloaded over verified HTTPS from:

https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

SHA-256 fingerprint: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.

The certificate expires on 2031-04-26. It contains no private key or database credentials.

For local Supabase connections, preserve the credentials and other parameters in your private `backend/.env` database URL, set `sslmode=verify-full`, and add `sslrootcert` with the absolute path to this file. Restart the backend after changing `.env`. For hosted deployments, use the certificate's path in that deployment; a local macOS path will not exist there.

The backend service's Vercel function configuration explicitly bundles this public certificate. Keep the Vercel project Root Directory at the repository root and set `sslrootcert=certs/supabase-ca.crt` in the Vercel database URL. Configuration resolves relative certificate paths against the backend directory, independently of the process working directory. The former `backend/certs/supabase-ca.crt` value remains supported for existing environment settings. Do not copy the `/Users/...` path from the local environment.

Keep TLS certificate and hostname verification enabled. See [Supabase's connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres#ssl).

A successful TLS connection does not initialize the application schema. On a separately approved new database, review `backend/src/db/migrations/001_postgres.sql`, `002_home_care.sql`, and `003_rate_limits.sql`, then run from the repository root:

```sh
npm --prefix backend run db:migrate:postgres -- --confirm-migrations
```

These migrations create the application schema and migration tracking without importing provider, user, or patient records. An empty database will return an empty doctor directory until providers are onboarded or a separately approved data import is completed.
