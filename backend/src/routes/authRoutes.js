import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection.js';
import { config } from '../config/env.js';
import { validateBody } from '../middleware/validateMiddleware.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { authRateLimiter } from '../middleware/rateLimitMiddleware.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * Fetch profile data associated with user based on assigned role
 */
function getUserProfile(userId, role) {
  if (role === 'patient') {
    return db.get(`SELECT * FROM patient_profiles WHERE user_id = ?`, [userId]) || null;
  }
  if (role === 'doctor') {
    const doc = db.get(`SELECT * FROM doctor_profiles WHERE user_id = ?`, [userId]);
    if (doc) {
      return {
        ...doc,
        languages: JSON.parse(doc.languages_json || '[]'),
        visit_types: JSON.parse(doc.visit_types_json || '[]'),
        available_slots: JSON.parse(doc.available_slots_json || '[]'),
        insurance_accepted: JSON.parse(doc.insurance_accepted_json || '[]')
      };
    }
    return null;
  }
  if (role === 'hospital') {
    const hosp = db.get(`SELECT * FROM hospitals WHERE user_id = ?`, [userId]);
    if (hosp) {
      return {
        ...hosp,
        departments: JSON.parse(hosp.departments_json || '[]')
      };
    }
    return null;
  }
  if (role === 'admin') {
    return { full_name: 'CARES Platform Administrator', title: 'Security & Verification Officer' };
  }
  return null;
}

/**
 * POST /api/auth/login
 * Common login for all roles. Role is determined strictly server-side by the database.
 */
router.post(
  '/login',
  authRateLimiter,
  validateBody({
    email: { required: true, type: 'email' },
    password: { required: true, minLength: 6 }
  }),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const normalizedEmail = email.trim().toLowerCase();

      const user = db.get(`SELECT * FROM users WHERE email = ?`, [normalizedEmail]);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials. Please verify your email and password.',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Directory-only imported accounts are strictly non-interactive and barred from authenticating
      if (user.password_hash === 'DIRECTORY_IMPORT_NO_LOGIN_UNAUTHORIZED' || user.email.endsWith('@directory.cares.org')) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials. Please verify your email and password.',
          code: 'INVALID_CREDENTIALS'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials. Please verify your email and password.',
          code: 'INVALID_CREDENTIALS'
        });
      }

      if (user.status === 'pending_approval') {
        return res.status(403).json({
          success: false,
          error: 'Your verification application is currently under administrative review. You will receive notification upon approval.',
          code: 'ACCOUNT_PENDING_APPROVAL'
        });
      }

      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: `Your account is ${user.status}. Please contact platform administration.`,
          code: 'ACCOUNT_INACTIVE'
        });
      }

      // Generate signed JWT
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );

      const profile = getUserProfile(user.id, user.role);

      // Audit login
      try {
        db.run(
          `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, details_json, ip_address)
           VALUES (?, 'USER_LOGIN', 'USER', ?, ?, ?)`,
          [user.id, user.id, JSON.stringify({ role: user.role, email: user.email }), req.ip || '127.0.0.1']
        );
      } catch (auditErr) {
        logger.warn('Failed to record login audit event', auditErr);
      }

      logger.info(`User logged in successfully`, { userId: user.id, role: user.role });

      res.status(200).json({
        success: true,
        message: 'Authentication successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
          profile
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/register
 * Public patient self-registration with automatic patient role assignment
 */
router.post(
  '/register',
  authRateLimiter,
  validateBody({
    email: { required: true, type: 'email' },
    password: { required: true, minLength: 6 },
    full_name: { required: true, minLength: 2 }
  }),
  async (req, res, next) => {
    try {
      const { email, password, full_name, phone, gender, date_of_birth, city } = req.body;
      const normalizedEmail = email.trim().toLowerCase();

      // Check if email already registered
      const existing = db.get(`SELECT id FROM users WHERE email = ?`, [normalizedEmail]);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email address already exists. Please log in.',
          code: 'EMAIL_ALREADY_REGISTERED'
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const result = db.transaction((tx) => {
        const userRes = tx.run(
          `INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, 'patient', 'active')`,
          [normalizedEmail, passwordHash]
        );

        const profileRes = tx.run(
          `INSERT INTO patient_profiles (user_id, full_name, phone, gender, date_of_birth, city, is_synthetic)
           VALUES (?, ?, ?, ?, ?, ?, 0)`,
          [
            userRes.lastInsertRowid,
            full_name.trim(),
            phone ? phone.trim() : null,
            gender || 'Prefer not to say',
            date_of_birth || null,
            city ? city.trim() : 'Chandigarh'
          ]
        );

        // Audit registration
        tx.run(
          `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, details_json, ip_address)
           VALUES (?, 'PATIENT_REGISTER', 'PATIENT_PROFILE', ?, ?, ?)`,
          [
            userRes.lastInsertRowid,
            profileRes.lastInsertRowid,
            JSON.stringify({ email: normalizedEmail, full_name: full_name.trim() }),
            req.ip || '127.0.0.1'
          ]
        );

        return {
          userId: userRes.lastInsertRowid,
          profileId: profileRes.lastInsertRowid
        };
      });

      const token = jwt.sign(
        { userId: result.userId, email: normalizedEmail, role: 'patient' },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );

      const profile = getUserProfile(result.userId, 'patient');

      logger.info('New patient registered successfully', { userId: result.userId, email: normalizedEmail });

      res.status(201).json({
        success: true,
        message: 'Patient account created successfully.',
        token,
        user: {
          id: result.userId,
          email: normalizedEmail,
          role: 'patient',
          status: 'active',
          profile
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/auth/me
 * Protected endpoint returning the currently authenticated user's session
 */
router.get('/me', authenticateToken, (req, res) => {
  const profile = getUserProfile(req.user.id, req.user.role);

  res.status(200).json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      status: req.user.status,
      profile
    }
  });
});

/**
 * POST /api/auth/apply-doctor
 * Professional provider application workflow (requires administrative approval)
 */
router.post(
  '/apply-doctor',
  validateBody({
    email: { required: true, type: 'email' },
    password: { required: true, minLength: 6 },
    full_name: { required: true, minLength: 2 },
    specialty: { required: true, minLength: 3 },
    license_number: { required: true, minLength: 4 }
  }),
  async (req, res, next) => {
    try {
      const { email, password, full_name, specialty, license_number, experience_years, bio } = req.body;
      const normalizedEmail = email.trim().toLowerCase();

      const existing = db.get(`SELECT id FROM users WHERE email = ?`, [normalizedEmail]);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email already exists.',
          code: 'EMAIL_ALREADY_REGISTERED'
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      db.transaction((tx) => {
        const userRes = tx.run(
          `INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, 'doctor', 'pending_approval')`,
          [normalizedEmail, passwordHash]
        );

        const docRes = tx.run(
          `INSERT INTO doctor_profiles (
            user_id, full_name, specialty, license_number, experience_years, bio, is_verified, verification_status, is_synthetic
          ) VALUES (?, ?, ?, ?, ?, ?, 0, 'pending', 0)`,
          [
            userRes.lastInsertRowid,
            full_name.trim(),
            specialty.trim(),
            license_number.trim(),
            parseInt(experience_years, 10) || 0,
            bio ? bio.trim() : null
          ]
        );

        tx.run(
          `INSERT INTO verification_applications (
            user_id, target_type, target_id, submitted_license_number, status
          ) VALUES (?, 'doctor', ?, ?, 'pending')`,
          [userRes.lastInsertRowid, docRes.lastInsertRowid, license_number.trim()]
        );
      });

      res.status(202).json({
        success: true,
        message: 'Doctor application submitted successfully. Your credentials are now pending administrative verification.',
        code: 'APPLICATION_SUBMITTED_FOR_REVIEW'
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
