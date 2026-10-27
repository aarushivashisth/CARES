/**
 * Helper to validate request payload schemas.
 */
export function validateBody(requiredFields = {}) {
  return (req, res, next) => {
    const body = req.body || {};
    const errors = [];

    for (const [field, rule] of Object.entries(requiredFields)) {
      const val = body[field];

      if (rule.required && (val === undefined || val === null || val === '')) {
        errors.push(`Field '${field}' is required.`);
        continue;
      }

      if (val !== undefined && val !== null && val !== '') {
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
