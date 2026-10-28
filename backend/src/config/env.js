import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const DEVELOPMENT_JWT_SECRET = 'cares_capstone_jwt_development_secret_key_change_in_production_2026';

/**
 * Validates JWT configuration against production security standards.
 * Never logs or prints the secret value.
 */
export function validateJwtSecret(secret, nodeEnv) {
  if (nodeEnv === 'production') {
    if (!secret || typeof secret !== 'string' || secret.trim() === '') {
      throw new Error('FATAL: JWT_SECRET environment variable is missing or blank. A secure secret is required in production.');
    }
    const trimmed = secret.trim();
    if (trimmed === DEVELOPMENT_JWT_SECRET || trimmed.includes('development_secret')) {
      throw new Error('FATAL: Insecure development JWT_SECRET cannot be used in production mode.');
    }
    if (trimmed.length < 32) {
      throw new Error('FATAL: JWT_SECRET must be at least 32 characters long in production.');
    }
  }
}

/**
 * Validates full configuration object
 */
export function validateConfig(cfg) {
  validateJwtSecret(cfg.jwtSecret, cfg.nodeEnv);
  return true;
}

/**
 * Builds configuration object from an environment dictionary.
 * Allows safe, isolated testing without mutating process.env.
 */
export function buildConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const rawSecret = env.JWT_SECRET;

  // In production, do not substitute the fallback secret
  const jwtSecret = nodeEnv === 'production'
    ? (rawSecret ? rawSecret.trim() : '')
    : (rawSecret && rawSecret.trim() ? rawSecret.trim() : DEVELOPMENT_JWT_SECRET);

  return {
    port: parseInt(env.PORT, 10) || 5000,
    nodeEnv,
    clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',
    databasePath: env.DATABASE_PATH || (nodeEnv === 'test' ? './data/cares.test.db' : './data/cares.db'),
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
    trustProxy: env.TRUST_PROXY === 'true' || env.TRUST_PROXY === '1'
      ? true
      : (nodeEnv === 'test' ? 1 : (env.TRUST_PROXY || false)),
  };
}

export const config = buildConfig(process.env);

// Enforce production validation immediately on module load
if (config.nodeEnv === 'production') {
  validateConfig(config);
}
