import { Router } from '../middleware/asyncRouter.js';
import { db } from '../db/database.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { validateBody } from '../middleware/validateMiddleware.js';

const router = Router();

// Protect all admin routes
router.use(authenticateToken, requireRole('admin'));

/**
 * GET /api/admin/dashboard
 * Administrative console overview
 */
router.get('/dashboard', async (req, res) => {
  const userCounts = await db.all(
    `SELECT role, count(*) AS count FROM users GROUP BY role`
  );

  const pendingVerifications = await db.all(
    `SELECT 
       v.id, v.target_type, v.target_id, v.submitted_license_number, v.status, v.created_at,
       u.email AS applicant_email,
       CASE 
         WHEN v.target_type = 'doctor' THEN (SELECT full_name FROM doctor_profiles WHERE id = v.target_id)
         WHEN v.target_type = 'hospital' THEN (SELECT name FROM hospitals WHERE id = v.target_id)
       END AS entity_name
     FROM verification_applications v
     JOIN users u ON v.user_id = u.id
     ORDER BY v.created_at DESC`
  );

  const recentAuditEvents = await db.all(
    `SELECT a.id, a.action, a.target_type, a.target_id, a.details_json, a.ip_address, a.created_at,
            u.email AS actor_email
     FROM audit_events a
     LEFT JOIN users u ON a.actor_user_id = u.id
     ORDER BY a.created_at DESC
     LIMIT 20`
  );

  const totalAppointments = await db.get(`SELECT count(*) as count FROM appointment_requests`);

  res.status(200).json({
    success: true,
    data: {
      metrics: {
        usersByRole: Object.fromEntries(userCounts.map(u => [u.role, u.count])),
        totalAppointments: totalAppointments ? totalAppointments.count : 0,
        pendingVerificationsCount: pendingVerifications.filter(v => v.status === 'pending').length
      },
      pendingVerifications,
      recentAuditEvents: recentAuditEvents.map(e => ({
        ...e,
        details: JSON.parse(e.details_json || '{}')
      })),
      milestone: 'Milestone 1 Full-Stack Foundation'
    }
  });
});

/**
 * GET /api/admin/verifications
 * List all provider and facility verification applications with full audit metadata
 */
router.get('/verifications', async (req, res) => {
  const verifications = await db.all(
    `SELECT 
       v.id, v.user_id, v.target_type, v.target_id, v.submitted_license_number,
       v.issuing_council, v.qualifications, v.supporting_evidence_json, v.affiliation_requested,
       v.clarification_request, v.clarification_response, v.decision_reason, v.review_notes,
       v.status, v.reviewed_by_user_id, v.reviewed_at, v.created_at, v.updated_at,
       u.email AS applicant_email,
       reviewer.email AS reviewer_email,
       CASE 
         WHEN v.target_type = 'doctor' THEN (SELECT full_name FROM doctor_profiles WHERE id = v.target_id)
         WHEN v.target_type = 'hospital' THEN (SELECT name FROM hospitals WHERE id = v.target_id)
       END AS entity_name
     FROM verification_applications v
     JOIN users u ON v.user_id = u.id
     LEFT JOIN users reviewer ON v.reviewed_by_user_id = reviewer.id
     ORDER BY v.created_at DESC`
  );

  const formatted = verifications.map((v) => ({
    id: v.id,
    userId: v.user_id,
    user_id: v.user_id,
    targetType: v.target_type,
    target_type: v.target_type,
    targetId: v.target_id,
    target_id: v.target_id,
    applicantEmail: v.applicant_email,
    applicant_email: v.applicant_email,
    entityName: v.entity_name,
    entity_name: v.entity_name,
    submittedLicenseNumber: v.submitted_license_number,
    submitted_license_number: v.submitted_license_number,
    issuingCouncil: v.issuing_council,
    issuing_council: v.issuing_council,
    qualifications: v.qualifications,
    supportingEvidence: JSON.parse(v.supporting_evidence_json || '[]'),
    supporting_evidence_json: v.supporting_evidence_json,
    affiliationRequested: v.affiliation_requested,
    affiliation_requested: v.affiliation_requested,
    clarificationRequest: v.clarification_request,
    clarification_request: v.clarification_request,
    clarificationResponse: v.clarification_response,
    clarification_response: v.clarification_response,
    decisionReason: v.decision_reason,
    decision_reason: v.decision_reason,
    reviewNotes: v.review_notes,
    review_notes: v.review_notes,
    status: v.status,
    reviewerEmail: v.reviewer_email,
    reviewer_email: v.reviewer_email,
    reviewedAt: v.reviewed_at,
    reviewed_at: v.reviewed_at,
    createdAt: v.created_at,
    created_at: v.created_at,
    updatedAt: v.updated_at,
    updated_at: v.updated_at
  }));

  res.status(200).json({
    success: true,
    count: formatted.length,
    data: {
      verifications: formatted,
    },
  });
});

/**
 * GET /api/admin/verifications/:id
 * Retrieve details of a specific verification application
 */
router.get('/verifications/:id', async (req, res) => {
  const applicationId = parseInt(req.params.id, 10);
  if (isNaN(applicationId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid application ID.',
      code: 'INVALID_APPLICATION_ID'
    });
  }

  const v = await db.get(
    `SELECT 
       v.id, v.user_id, v.target_type, v.target_id, v.submitted_license_number,
       v.issuing_council, v.qualifications, v.supporting_evidence_json, v.affiliation_requested,
       v.clarification_request, v.clarification_response, v.decision_reason, v.review_notes,
       v.status, v.reviewed_by_user_id, v.reviewed_at, v.created_at, v.updated_at,
       u.email AS applicant_email,
       reviewer.email AS reviewer_email,
       CASE 
         WHEN v.target_type = 'doctor' THEN (SELECT full_name FROM doctor_profiles WHERE id = v.target_id)
         WHEN v.target_type = 'hospital' THEN (SELECT name FROM hospitals WHERE id = v.target_id)
       END AS entity_name
     FROM verification_applications v
     JOIN users u ON v.user_id = u.id
     LEFT JOIN users reviewer ON v.reviewed_by_user_id = reviewer.id
     WHERE v.id = ?`,
    [applicationId]
  );

  if (!v) {
    return res.status(404).json({
      success: false,
      error: 'Verification application not found.',
      code: 'APPLICATION_NOT_FOUND'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      id: v.id,
      userId: v.user_id,
      targetType: v.target_type,
      targetId: v.target_id,
      applicantEmail: v.applicant_email,
      entityName: v.entity_name,
      submittedLicenseNumber: v.submitted_license_number,
      issuingCouncil: v.issuing_council,
      qualifications: v.qualifications,
      supportingEvidence: JSON.parse(v.supporting_evidence_json || '[]'),
      affiliationRequested: v.affiliation_requested,
      clarificationRequest: v.clarification_request,
      clarificationResponse: v.clarification_response,
      decisionReason: v.decision_reason,
      reviewNotes: v.review_notes,
      status: v.status,
      reviewerEmail: v.reviewer_email,
      reviewedAt: v.reviewed_at,
      createdAt: v.created_at,
      updatedAt: v.updated_at
    }
  });
});

/**
 * POST /api/admin/verifications/:id/review
 * Approve, reject, request clarification, or suspend verification
 */
router.post(
  '/verifications/:id/review',
  validateBody({
    decision: { required: true, enum: ['approved', 'rejected', 'needs_clarification', 'suspended'] }
  }),
  async (req, res) => {
    const decision = req.body.decision;
    const notes = req.body.notes;
    const reason = req.body.reason || req.body.decisionReason;
    const clarification_request = req.body.clarification_request || req.body.clarificationRequest;
    const applicationId = parseInt(req.params.id, 10);

    const app = await db.get(
      `SELECT * FROM verification_applications WHERE id = ?`,
      [applicationId]
    );

    if (!app) {
      return res.status(404).json({
        success: false,
        error: 'Verification application not found.',
        code: 'APPLICATION_NOT_FOUND'
      });
    }

    // Security rule: An administrator must never approve their own application
    if (app.user_id === req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Self-approval is forbidden. An administrator cannot review or decide upon their own credentials.',
        code: 'SELF_APPROVAL_NOT_ALLOWED'
      });
    }

    // Validation for clarification request
    if (decision === 'needs_clarification' && (!clarification_request || !clarification_request.trim())) {
      return res.status(400).json({
        success: false,
        error: 'A specific clarification request inquiry must be provided when requesting clarification.',
        code: 'CLARIFICATION_REQUEST_REQUIRED'
      });
    }

    // Map decision to entity verification status
    let entityStatus = 'pending';
    let isVerifiedFlag = 0;

    if (decision === 'approved') {
      entityStatus = 'verified';
      isVerifiedFlag = 1;
    } else if (decision === 'rejected') {
      entityStatus = 'rejected';
      isVerifiedFlag = 0;
    } else if (decision === 'needs_clarification') {
      entityStatus = 'needs_clarification';
      isVerifiedFlag = 0;
    } else if (decision === 'suspended') {
      entityStatus = 'suspended';
      isVerifiedFlag = 0;
    }

    const decisionReason = reason ? reason.trim() : (notes ? notes.trim() : `Administrative decision: ${decision}`);

    await db.transaction(async (tx) => {
      // 1. Update application record
      await tx.run(
        `UPDATE verification_applications
         SET status = ?, 
             review_notes = ?, 
             decision_reason = ?,
             clarification_request = ?,
             reviewed_by_user_id = ?, 
             reviewed_at = datetime('now'), 
             updated_at = datetime('now')
         WHERE id = ?`,
        [
          decision,
          notes ? notes.trim() : null,
          decisionReason,
          decision === 'needs_clarification' ? clarification_request.trim() : app.clarification_request,
          req.user.id,
          applicationId
        ]
      );

      // 2. Update the target entity (doctor or hospital)
      if (app.target_type === 'doctor') {
        await tx.run(
          `UPDATE doctor_profiles
           SET is_verified = ?, 
               verification_status = ?, 
               verified_at = ?,
               verified_by_user_id = ?,
               verification_notes = ?,
               registration_check_status = ?,
               provenance_status = CASE WHEN is_synthetic = 0 AND ? = 'approved' THEN 'cares_verified' ELSE provenance_status END,
               updated_at = datetime('now')
           WHERE id = ?`,
          [
            isVerifiedFlag,
            entityStatus,
            decision === 'approved' ? new Date().toISOString() : null,
            decision === 'approved' ? req.user.id : null,
            decisionReason,
            decision === 'approved' ? 'checked' : (decision === 'rejected' ? 'discrepancy_found' : 'unchecked'),
            decision,
            app.target_id
          ]
        );

        if (decision === 'approved') {
          await tx.run(`UPDATE users SET status = 'active' WHERE id = ?`, [app.user_id]);
        } else if (decision === 'suspended') {
          await tx.run(`UPDATE users SET status = 'suspended' WHERE id = ?`, [app.user_id]);
        }
      } else if (app.target_type === 'hospital') {
        await tx.run(
          `UPDATE hospitals
           SET is_verified = ?, 
               verification_status = ?, 
               updated_at = datetime('now')
           WHERE id = ?`,
          [isVerifiedFlag, decision === 'approved' ? 'verified' : (decision === 'rejected' ? 'rejected' : 'pending'), app.target_id]
        );

        if (decision === 'approved') {
          await tx.run(`UPDATE users SET status = 'active' WHERE id = ?`, [app.user_id]);
        }
      }

      // 3. Record in audit_events
      await tx.run(
        `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, details_json, ip_address)
         VALUES (?, 'VERIFICATION_REVIEW', ?, ?, ?, ?)`,
        [
          req.user.id,
          app.target_type.toUpperCase(),
          app.target_id,
          JSON.stringify({
            applicationId,
            decision,
            reason: decisionReason,
            clarificationRequest: clarification_request || null,
            targetUserId: app.user_id
          }),
          req.ip || '127.0.0.1'
        ]
      );
    });

    res.status(200).json({
      success: true,
      message: `Verification application #${applicationId} was successfully updated with decision: ${decision}.`,
      data: {
        applicationId,
        decision,
        status: decision,
        reason: decisionReason
      }
    });
  }
);

export default router;
