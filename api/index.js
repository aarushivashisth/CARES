import app from '../backend/src/app.js';
import { config, validateDeployment } from '../backend/src/config/env.js';
validateDeployment(config);
if (!config.databaseUrl) throw new Error('Vercel requires DATABASE_URL for durable PostgreSQL storage. SQLite is not supported in Functions.');
// No listen(), schema migration, seeding or training in the function lifecycle.
export default app;
