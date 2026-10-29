/**
 * Helper to validate request payload schemas.
 */
export function validateBody(requiredFields = {}) {
  return (req, res, next) => {
    const body = req.body || {};
    if (typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({success:false,error:'Body must be an object.',code:'VALIDATION_ERROR'});
    const errors = [];

    for (const [field, rule] of Object.entries(requiredFields)) {
      const val = body[field];

      if (rule.required && (val === undefined || val === null || val === '')) {
        errors.push(`Field '${field}' is required.`);
        continue;
      }

      if (val !== undefined && val !== null && val !== '') {
        if ((rule.minLength || rule.type === 'email') && typeof val !== 'string') { errors.push(`Field '${field}' must be text.`); continue; }
        if (typeof val === 'string' && val.length > (rule.maxLength || 4096)) errors.push(`Field '${field}' is too long.`);
        if (field === 'password' && (typeof val !== 'string' || Buffer.byteLength(val, 'utf8') > 72)) errors.push('Password must be text and at most 72 UTF-8 bytes.');
        if (rule.type === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(String(val))) {
            errors.push(`Field '${field}' must be a valid email address.`);
          }
        }

        if (rule.minLength && String(val).length < rule.minLength) {
          errors.push(`Field '${field}' must be at least ${rule.minLength} characters.`);
        }

        if (rule.enum && !rule.enum.includes(val)) {
          errors.push(`Field '${field}' must be one of: ${rule.enum.join(', ')}.`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed for submitted request body.',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    }

    next();
  };
}
