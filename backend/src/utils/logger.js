/**
 * Safe logging utility that prevents accidental exposure of credentials,
 * password hashes, tokens, or sensitive patient data.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'passwordHash',
  'token',
  'jwt',
  'authorization',
  'secret'
]);

function sanitizeData(data) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeData);

  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeData(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export const logger = {
  info(message, meta = null) {
    if (meta) {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, sanitizeData(meta));
    } else {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
    }
  },

  warn(message, meta = null) {
    if (meta) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, sanitizeData(meta));
    } else {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
    }
  },

  error(message, error = null) {
    if (error && error.stack) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message} - ${error.message}\n${error.stack}`);
    } else if (error) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, sanitizeData(error));
    } else {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
    }
  }
};
