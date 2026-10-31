import app from './src/app.js';
import { config, validateDeployment } from './src/config/env.js';

validateDeployment(config);
// Vercel Services loads the Express app directly. No listener, schema changes,
// seeding, or offline model training runs when this entrypoint is imported.
export default app;
