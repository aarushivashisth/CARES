import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const backendRoot = path.resolve(__dirname, '../../');

/** Resolve private TLS certificate paths independently of a service's cwd. */
export function resolveDatabaseUrl(value) {
  if (!value) return '';
  let url;
  try { url = new URL(value); } catch { return value; }
  const certificate = url.searchParams.get('sslrootcert');
  if (!certificate || path.isAbsolute(certificate)) return value;
  // Accept the former repository-root path as well as the service-root path.
  const relative = certificate.startsWith('backend/') ? certificate.slice('backend/'.length) : certificate;
  url.searchParams.set('sslrootcert', path.resolve(backendRoot, relative));
  return url.href;
}

/**
 * Resolves a database path string to a canonical absolute path.
 * Relative paths are always anchored to the backend root directory (e.g. ./data/cares.db),
 * ensuring consistent resolution regardless of the shell's current working directory.
 */
export function resolveDatabasePath(dbPath) {
  if (!dbPath || typeof dbPath !== 'string') return '';
  const trimmed = dbPath.trim().replace(/\\/g, '/');
  if (!trimmed) return '';
  return path.isAbsolute(trimmed)
    ? path.resolve(trimmed)
    : path.resolve(backendRoot, trimmed);
}

/**
 * Robustly checks if a database path resolves to the protected live database (cares.db).
 * Accurately normalizes relative paths, absolute paths, Windows separators, and casing.
 * Includes defense-in-depth checks against both backend root and process.cwd().
 */
export function isLiveDatabase(dbPath) {
  if (!dbPath || typeof dbPath !== 'string') return false;
  const trimmed = dbPath.trim();
  if (!trimmed) return false;

  const liveDbPath = path.resolve(backendRoot, 'data/cares.db');
  const normalizedLive = path.normalize(liveDbPath).toLowerCase();

  // Primary check: resolved relative to backend root
  const resolvedTarget = resolveDatabasePath(trimmed);
  if (path.normalize(resolvedTarget).toLowerCase() === normalizedLive) {
    return true;
  }

  // Defense-in-depth: check if path resolved relative to current working directory matches live database
  const cwdTarget = path.isAbsolute(trimmed) ? path.resolve(trimmed) : path.resolve(process.cwd(), trimmed);
  if (path.normalize(cwdTarget).toLowerCase() === normalizedLive) {
    return true;
  }

  return false;
}

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
    if (/replace_with|change_me|your_secret|example_secret/i.test(trimmed)) throw new Error('FATAL: Placeholder JWT_SECRET cannot be used in production.');
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
    databaseUrl: resolveDatabaseUrl(env.DATABASE_URL),
    allowProtectedDatabase: env.ALLOW_PROTECTED_DATABASE === 'true',
    nodeEnv,
    clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',
    databasePath: env.DATABASE_PATH || (nodeEnv === 'test' ? './data/cares.test.db' : './data/cares.db'),
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
    trustProxy: env.TRUST_PROXY === 'true'
      ? true
      : (/^[1-9]$/.test(env.TRUST_PROXY || '') ? Number(env.TRUST_PROXY)
      : (nodeEnv === 'test' ? 1 : (env.TRUST_PROXY || false))),
  };
}

export function validateDeployment(cfg) {
  validateConfig(cfg);
  let database;
  try { database = new URL(cfg.databaseUrl); } catch { throw new Error('A valid PostgreSQL DATABASE_URL is required.'); }
  if (!['postgres:', 'postgresql:'].includes(database.protocol)) throw new Error('A PostgreSQL DATABASE_URL is required.');
  if (cfg.nodeEnv === 'production') {
    const origin = new URL(cfg.clientOrigin);
    if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) throw new Error('CLIENT_ORIGIN must be an exact HTTPS origin.');
    if (database.searchParams.get('sslmode') !== 'verify-full') throw new Error('Production PostgreSQL must use sslmode=verify-full.');
    if (cfg.trustProxy === true) throw new Error('Use a bounded TRUST_PROXY hop count, not true.');
  }
  return true;
}

export const config = buildConfig(process.env);

// Enforce production validation immediately on module load
if (config.nodeEnv === 'production') {
  validateConfig(config);
}
