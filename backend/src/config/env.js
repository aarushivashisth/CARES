import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  databasePath: process.env.DATABASE_PATH || (process.env.NODE_ENV === 'test' ? './data/cares.test.db' : './data/cares.db'),
  jwtSecret: process.env.JWT_SECRET || 'cares_capstone_jwt_development_secret_key_change_in_production_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
};

// Validate critical configurations
if (config.nodeEnv === 'production' && config.jwtSecret.includes('development_secret')) {
  console.warn('⚠️ WARNING: Using fallback JWT secret in production mode. Set JWT_SECRET in environment.');
}
