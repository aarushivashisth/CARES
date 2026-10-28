import { Router } from 'express';
import { db } from '../db/connection.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { validateBody } from '../middleware/validateMiddleware.js';

const router = Router();

/**
 * GET /api/doctors
 * Public database-backed provider directory with provenance and verification tracking
 */
router.get('/', (req, res) => {
  const doctors = db.all(
    `SELECT 
       d.id, d.full_name, d.specialty, d.license_number, d.issuing_council, d.qualifications,
       d.experience_years, d.bio, d.rating, d.reviews_count, d.consultation_fee,
       d.languages_json, d.visit_types_json, d.available_slots_json, d.insurance_accepted_json,
       d.is_accepting_new_patients, d.is_wheelchair_accessible, d.is_verified, d.verification_status,
       d.registration_check_status, d.is_synthetic, d.source_url, d.source_organization,
       d.last_checked_date, d.provenance_status, d.affiliation_source,
       h.name AS hospital_name, h.city AS hospital_city, dha.distance_text
     FROM doctor_profiles d
     LEFT JOIN doctor_hospital_affiliations dha ON d.id = dha.doctor_id AND dha.is_primary = 1
     LEFT JOIN hospitals h ON dha.hospital_id = h.id
     ORDER BY d.id ASC`
  );

  const formatted = doctors.map((doc) => {
    // Only genuine verification when status is strictly 'verified'
    const isOfficiallyVerified = Boolean(doc.is_verified === 1 && doc.verification_status === 'verified');

    return {
      id: doc.id,
      name: doc.full_name,
      specialty: doc.specialty,
      licenseNumber: doc.license_number,
      issuingCouncil: doc.issuing_council || null,
      qualifications: doc.qualifications || null,
      experience: doc.experience_years,
      bio: doc.bio,
      rating: doc.rating,
      reviews: doc.reviews_count,
      consultationFee: doc.consultation_fee,
      hospital: doc.hospital_name || 'Riverside Medical Center',
      distance: doc.distance_text || '1.8 miles away',
      languages: JSON.parse(doc.languages_json || '[]'),
      visitTypes: JSON.parse(doc.visit_types_json || '[]'),
      slots: JSON.parse(doc.available_slots_json || '[]'),
      insurance: JSON.parse(doc.insurance_accepted_json || '[]'),
      accepting: Boolean(doc.is_accepting_new_patients),
      accessible: Boolean(doc.is_wheelchair_accessible),
      isVerified: isOfficiallyVerified,
      verificationStatus: doc.verification_status,
      registrationCheckStatus: doc.registration_check_status || 'unchecked',
      isSynthetic: Boolean(doc.is_synthetic),
      sourceUrl: doc.source_url || null,
      sourceOrganization: doc.source_organization || 'CARES Academic Prototype Dataset',
      lastCheckedDate: doc.last_checked_date || null,
      provenanceStatus: doc.provenance_status || 'synthetic_demo',
      affiliationSource: doc.affiliation_source || null,
    };
  });

  res.status(200).json({
    success: true,
    count: formatted.length,
    data: formatted,
  });
});

/**
 * GET /api/doctors/:id
 * Public database-backed single provider details with provenance tracking
 */
router.get('/:id', (req, res) => {
  const doctorId = parseInt(req.params.id, 10);
  if (isNaN(doctorId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid doctor ID provided.',
      code: 'INVALID_DOCTOR_ID',
    });
  }

  const doc = db.get(
    `SELECT 
       d.id, d.full_name, d.specialty, d.license_number, d.issuing_council, d.qualifications,
       d.experience_years, d.bio, d.rating, d.reviews_count, d.consultation_fee,
       d.languages_json, d.visit_types_json, d.available_slots_json, d.insurance_accepted_json,
       d.is_accepting_new_patients, d.is_wheelchair_accessible, d.is_verified, d.verification_status,
       d.registration_check_status, d.is_synthetic, d.source_url, d.source_organization,
       d.last_checked_date, d.provenance_status, d.affiliation_source,
       h.name AS hospital_name, h.city AS hospital_city, dha.distance_text
     FROM doctor_profiles d
     LEFT JOIN doctor_hospital_affiliations dha ON d.id = dha.doctor_id AND dha.is_primary = 1
     LEFT JOIN hospitals h ON dha.hospital_id = h.id
     WHERE d.id = ?`,
    [doctorId]
  );

  if (!doc) {
    return res.status(404).json({
      success: false,
      error: 'Doctor not found in directory.',
      code: 'DOCTOR_NOT_FOUND',
    });
  }

  const isOfficiallyVerified = Boolean(doc.is_verified === 1 && doc.verification_status === 'verified');

  res.status(200).json({
    success: true,
    data: {
      id: doc.id,
      name: doc.full_name,
      specialty: doc.specialty,
      licenseNumber: doc.license_number,
      issuingCouncil: doc.issuing_council || null,
      qualifications: doc.qualifications || null,
      experience: doc.experience_years,
      bio: doc.bio,
      rating: doc.rating,
      reviews: doc.reviews_count,
      consultationFee: doc.consultation_fee,
      hospital: doc.hospital_name || 'Riverside Medical Center',
      distance: doc.distance_text || '1.8 miles away',
      languages: JSON.parse(doc.languages_json || '[]'),
      visitTypes: JSON.parse(doc.visit_types_json || '[]'),
      slots: JSON.parse(doc.available_slots_json || '[]'),
      insurance: JSON.parse(doc.insurance_accepted_json || '[]'),
      accepting: Boolean(doc.is_accepting_new_patients),
      accessible: Boolean(doc.is_wheelchair_accessible),
      isVerified: isOfficiallyVerified,
      verificationStatus: doc.verification_status,
      registrationCheckStatus: doc.registration_check_status || 'unchecked',
      isSynthetic: Boolean(doc.is_synthetic),
      sourceUrl: doc.source_url || null,
      sourceOrganization: doc.source_organization || 'CARES Academic Prototype Dataset',
      lastCheckedDate: doc.last_checked_date || null,
      provenanceStatus: doc.provenance_status || 'synthetic_demo',
      affiliationSource: doc.affiliation_source || null,
    },
  });
});

/**
 * GET /api/doctor/appointments
 * Protected doctor endpoint returning appointment requests assigned to this doctor
 */
/**
 * Helper to parse appointment date (YYYY-MM-DD) and slot time (e.g. "11:30 AM", "02:00 PM")
 * into a local Date object.
 */
function parseAppointmentSlotDateTime(dateStr, slotStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmedDate = dateStr.trim();
  const trimmedSlot = typeof slotStr === 'string' ? slotStr.trim() : '';

  const dateParts = trimmedDate.split('-');
  if (dateParts.length !== 3) return null;
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10);
  const day = parseInt(dateParts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  const match = trimmedSlot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) {
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3] ? match[3].toUpperCase() : null;

  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

/**
 * Helper to get local date string YYYY-MM-DD
 */
function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * GET /api/doctor/appointments
 * Protected doctor endpoint returning appointment requests assigned to this doctor
 */
router.get('/portal/appointments', authenticateToken, requireRole('doctor'), (req, res) => {
  const doctor = db.get(
    `SELECT id FROM doctor_profiles WHERE user_id = ?`,
    [req.user.id]
  );

  if (!doctor) {
    return res.status(404).json({
      success: false,
      error: 'Doctor profile not found for authenticated user.',
      code: 'PROFILE_NOT_FOUND',
    });
  }

  const appointments = db.all(
    `SELECT
       a.id, a.requested_date, a.preferred_slot, a.visit_type, a.reason_for_visit, a.status, a.created_at, a.updated_at,
       p.full_name AS patient_name, p.phone AS patient_phone, p.gender AS patient_gender,
       (
         SELECT notes FROM appointment_status_history
         WHERE appointment_id = a.id
         ORDER BY id DESC LIMIT 1
       ) AS latest_notes
     FROM appointment_requests a
     JOIN patient_profiles p ON a.patient_id = p.id
     WHERE a.doctor_id = ?
     ORDER BY a.created_at DESC`,
    [doctor.id]
  );

  res.status(200).json({
    success: true,
    count: appointments.length,
    data: appointments,
  });
});

/**
 * Handler for doctor updating appointment status (accept, decline, complete, cancel)
 * Enforces doctor ownership, state machine transitions, accepted slot collision prevention, and audit history.
 */
function handleStatusUpdate(req, res) {
  const appointmentId = parseInt(req.params.id, 10);
  const { status, notes } = req.body;

  if (isNaN(appointmentId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid appointment ID.',
      code: 'INVALID_APPOINTMENT_ID',
    });
  }

  // Doctor profile for authenticated user
  const doctor = db.get(
    `SELECT id, full_name FROM doctor_profiles WHERE user_id = ?`,
    [req.user.id]
  );

  if (!doctor) {
    return res.status(404).json({
      success: false,
      error: 'Doctor profile not found for authenticated user.',
      code: 'PROFILE_NOT_FOUND',
    });
  }

  // Find appointment
  const appointment = db.get(
    `SELECT * FROM appointment_requests WHERE id = ?`,
    [appointmentId]
  );

  if (!appointment) {
    return res.status(404).json({
      success: false,
      error: 'Appointment request not found.',
      code: 'APPOINTMENT_NOT_FOUND',
    });
  }

  // CRITICAL OWNERSHIP CHECK: Doctor can only update their own appointments
  if (appointment.doctor_id !== doctor.id) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: You are not authorized to update appointments for another provider.',
      code: 'FORBIDDEN_APPOINTMENT_ACCESS',
    });
  }

  // Normalize target status
  const normalizedTarget = status === 'confirmed' ? 'accepted' : status;
  const currentStatus = appointment.status;

  // Immutability of terminal states
  if (['completed', 'declined', 'cancelled'].includes(currentStatus)) {
    return res.status(400).json({
      success: false,
      error: `Cannot transition appointment #${appointmentId} from terminal status '${currentStatus}'.`,
      code: 'TERMINAL_STATUS_IMMUTABLE',
    });
  }

  const todayStr = getTodayDateString();

  if (currentStatus === 'pending' || currentStatus === 'requested') {
    if (!['accepted', 'declined'].includes(normalizedTarget)) {
      return res.status(400).json({
        success: false,
        error: `Invalid transition: pending appointment can only be accepted or declined, not '${normalizedTarget}'.`,
        code: 'INVALID_STATUS_TRANSITION',
      });
    }

    if (normalizedTarget === 'accepted') {
      // Check if slot is already confirmed/accepted by another appointment for this doctor
      const existingAccepted = db.get(
        `SELECT id FROM appointment_requests
         WHERE doctor_id = ? AND requested_date = ? AND preferred_slot = ?
         AND status IN ('accepted', 'confirmed') AND id != ?`,
        [doctor.id, appointment.requested_date, appointment.preferred_slot, appointmentId]
      );

      if (existingAccepted) {
        return res.status(409).json({
          success: false,
          error: `Cannot accept appointment #${appointmentId}. The slot '${appointment.preferred_slot}' on ${appointment.requested_date} is already confirmed for another appointment (#${existingAccepted.id}).`,
          code: 'SLOT_ALREADY_CONFIRMED',
        });
      }
    }
  } else if (currentStatus === 'accepted' || currentStatus === 'confirmed') {
    if (!['completed', 'cancelled'].includes(normalizedTarget)) {
      return res.status(400).json({
        success: false,
        error: `Invalid transition: accepted appointment can only be marked completed or cancelled, not '${normalizedTarget}'.`,
        code: 'INVALID_STATUS_TRANSITION',
      });
    }

    if (normalizedTarget === 'completed') {
      // Cannot mark completed before appointment date
      if (appointment.requested_date && appointment.requested_date > todayStr) {
        return res.status(400).json({
          success: false,
          error: `Cannot mark appointment as completed before its scheduled date (${appointment.requested_date}). Today is ${todayStr}.`,
          code: 'CANNOT_COMPLETE_FUTURE_APPOINTMENT',
        });
      }

      // If scheduled for today, cannot mark completed before the appointment slot time
      if (appointment.requested_date === todayStr && appointment.preferred_slot) {
        const slotDateTime = parseAppointmentSlotDateTime(appointment.requested_date, appointment.preferred_slot);
        if (slotDateTime && slotDateTime > new Date()) {
          return res.status(400).json({
            success: false,
            error: `Cannot mark appointment as completed before its scheduled time (${appointment.preferred_slot}) on ${todayStr}.`,
            code: 'CANNOT_COMPLETE_FUTURE_APPOINTMENT',
          });
        }
      }
    }

    if (normalizedTarget === 'cancelled') {
      // Cancellation requires a meaningful reason
      if (!notes || typeof notes !== 'string' || notes.trim().length < 5) {
        return res.status(400).json({
          success: false,
          error: 'A meaningful cancellation reason is required when cancelling an accepted appointment (minimum 5 characters).',
          code: 'CANCELLATION_REASON_REQUIRED',
        });
      }
    }
  } else {
    return res.status(400).json({
      success: false,
      error: `Invalid appointment status '${currentStatus}'.`,
      code: 'INVALID_STATUS',
    });
  }

  // Notes length check
  if (notes && typeof notes === 'string' && notes.length > 500) {
    return res.status(400).json({
      success: false,
      error: 'Status update notes cannot exceed 500 characters.',
      code: 'NOTES_TOO_LONG',
    });
  }

  const finalNotes = notes ? notes.trim() : `Appointment ${normalizedTarget} by Dr. ${doctor.full_name}`;

  try {
    db.transaction((tx) => {
      if (normalizedTarget === 'accepted') {
        const inTxConflict = tx.get(
          `SELECT id FROM appointment_requests
           WHERE doctor_id = ? AND requested_date = ? AND preferred_slot = ?
           AND status IN ('accepted', 'confirmed') AND id != ?`,
          [doctor.id, appointment.requested_date, appointment.preferred_slot, appointmentId]
        );
        if (inTxConflict) {
          const err = new Error(`Slot '${appointment.preferred_slot}' on ${appointment.requested_date} is already confirmed.`);
          err.code = 'SLOT_ALREADY_CONFIRMED';
          throw err;
        }
      }

      tx.run(
        `UPDATE appointment_requests
         SET status = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [normalizedTarget, appointmentId]
      );

      tx.run(
        `INSERT INTO appointment_status_history (appointment_id, status, notes, changed_by_user_id)
         VALUES (?, ?, ?, ?)`,
        [appointmentId, normalizedTarget, finalNotes, req.user.id]
      );

      tx.run(
        `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, details_json, ip_address)
         VALUES (?, 'APPOINTMENT_STATUS_CHANGE', 'APPOINTMENT', ?, ?, ?)`,
        [
          req.user.id,
          appointmentId,
          JSON.stringify({ previousStatus: currentStatus, newStatus: normalizedTarget, notes: finalNotes }),
          req.ip || '127.0.0.1',
        ]
      );
    });
  } catch (err) {
    if (
      err.code === 'SLOT_ALREADY_CONFIRMED' ||
      (err.message && err.message.includes('UNIQUE constraint')) ||
      (err.code && String(err.code).includes('CONSTRAINT'))
    ) {
      return res.status(409).json({
        success: false,
        error: `Cannot accept appointment #${appointmentId}. The slot '${appointment.preferred_slot}' on ${appointment.requested_date} is already confirmed for another patient.`,
        code: 'SLOT_ALREADY_CONFIRMED',
      });
    }
    throw err;
  }

  const updated = db.get(`SELECT * FROM appointment_requests WHERE id = ?`, [appointmentId]);

  res.status(200).json({
    success: true,
    message: `Appointment request #${appointmentId} was successfully ${normalizedTarget}.`,
    data: updated,
  });
}

/**
 * PATCH /api/doctor/appointments/:id/status
 * POST /api/doctor/appointments/:id/status (fallback)
 */
router.patch(
  '/portal/appointments/:id/status',
  authenticateToken,
  requireRole('doctor'),
  validateBody({
    status: { required: true, enum: ['accepted', 'confirmed', 'declined', 'cancelled', 'completed'] },
  }),
  handleStatusUpdate
);

router.post(
  '/portal/appointments/:id/status',
  authenticateToken,
  requireRole('doctor'),
  validateBody({
    status: { required: true, enum: ['accepted', 'confirmed', 'declined', 'cancelled', 'completed'] },
  }),
  handleStatusUpdate
);

/**
 * GET /api/doctor/portal/appointments/:id/history
 * Retrieve chronological status history and notes for a specific appointment
 */
router.get(
  '/portal/appointments/:id/history',
  authenticateToken,
  requireRole('doctor'),
  (req, res) => {
    const appointmentId = parseInt(req.params.id, 10);
    if (isNaN(appointmentId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid appointment ID.',
        code: 'INVALID_APPOINTMENT_ID',
      });
    }

    const doctor = db.get(
      `SELECT id FROM doctor_profiles WHERE user_id = ?`,
      [req.user.id]
    );

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor profile not found.',
        code: 'PROFILE_NOT_FOUND',
      });
    }

    const appointment = db.get(
      `SELECT id, doctor_id FROM appointment_requests WHERE id = ?`,
      [appointmentId]
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment request not found.',
        code: 'APPOINTMENT_NOT_FOUND',
      });
    }

    if (appointment.doctor_id !== doctor.id) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You cannot view history for another provider\'s appointment.',
        code: 'FORBIDDEN_APPOINTMENT_ACCESS',
      });
    }

    const history = db.all(
      `SELECT h.id, h.appointment_id, h.status, h.notes, h.created_at, u.role AS changed_by_role
       FROM appointment_status_history h
       LEFT JOIN users u ON h.changed_by_user_id = u.id
       WHERE h.appointment_id = ?
       ORDER BY h.id ASC`,
      [appointmentId]
    );

    res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  }
);

/**
 * GET /api/doctor/dashboard
 * Protected doctor portal summary
 */
router.get('/portal/dashboard', authenticateToken, requireRole('doctor'), (req, res) => {
  const doctor = db.get(
    `SELECT * FROM doctor_profiles WHERE user_id = ?`,
    [req.user.id]
  );

  if (!doctor) {
    return res.status(404).json({
      success: false,
      error: 'Doctor profile not found for authenticated user.',
      code: 'PROFILE_NOT_FOUND',
    });
  }

  // Get appointment requests for this doctor
  const appointments = db.all(
    `SELECT
       a.id, a.requested_date, a.preferred_slot, a.visit_type, a.reason_for_visit, a.status, a.created_at, a.updated_at,
       p.full_name AS patient_name, p.phone AS patient_phone, p.gender AS patient_gender,
       (
         SELECT notes FROM appointment_status_history
         WHERE appointment_id = a.id
         ORDER BY id DESC LIMIT 1
       ) AS latest_notes
     FROM appointment_requests a
     JOIN patient_profiles p ON a.patient_id = p.id
     WHERE a.doctor_id = ?
     ORDER BY a.created_at DESC`,
    [doctor.id]
  );

  const pendingCount = appointments.filter(
    (a) => a.status === 'pending' || a.status === 'requested'
  ).length;
  const acceptedCount = appointments.filter(
    (a) => a.status === 'accepted' || a.status === 'confirmed'
  ).length;
  const completedCount = appointments.filter(
    (a) => a.status === 'completed'
  ).length;
  const declinedCount = appointments.filter(
    (a) => a.status === 'declined' || a.status === 'cancelled'
  ).length;

  // Get latest verification application
  const latestApp = db.get(
    `SELECT * FROM verification_applications 
     WHERE target_type = 'doctor' AND target_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [doctor.id]
  );

  res.status(200).json({
    success: true,
    data: {
      profile: {
        id: doctor.id,
        name: doctor.full_name,
        specialty: doctor.specialty,
        licenseNumber: doctor.license_number,
        issuingCouncil: doctor.issuing_council,
        qualifications: doctor.qualifications,
        rating: doctor.rating,
        verificationStatus: doctor.verification_status,
        isVerified: Boolean(doctor.is_verified === 1 && doctor.verification_status === 'verified'),
        registrationCheckStatus: doctor.registration_check_status || 'unchecked',
        verifiedAt: doctor.verified_at,
        slots: JSON.parse(doctor.available_slots_json || '[]'),
      },
      latestApplication: latestApp ? {
        id: latestApp.id,
        status: latestApp.status,
        submittedLicenseNumber: latestApp.submitted_license_number,
        issuingCouncil: latestApp.issuing_council,
        qualifications: latestApp.qualifications,
        supportingEvidence: JSON.parse(latestApp.supporting_evidence_json || '[]'),
        affiliationRequested: latestApp.affiliation_requested,
        clarificationRequest: latestApp.clarification_request,
        clarificationResponse: latestApp.clarification_response,
        decisionReason: latestApp.decision_reason,
        reviewNotes: latestApp.review_notes,
        reviewedAt: latestApp.reviewed_at,
        createdAt: latestApp.created_at
      } : null,
      appointments,
      metrics: {
        totalRequests: appointments.length,
        pendingReview: pendingCount,
        confirmed: acceptedCount,
        completed: completedCount,
        declined: declinedCount,
      },
      milestone: 'Milestone 3 Credential Verification & Hospital Management',
    },
  });
});

/**
 * GET /api/doctor/portal/verification
 * Retrieve current doctor credential verification application & status
 */
router.get('/portal/verification', authenticateToken, requireRole('doctor'), (req, res) => {
  const doctor = db.get(
    `SELECT * FROM doctor_profiles WHERE user_id = ?`,
    [req.user.id]
  );

  if (!doctor) {
    return res.status(404).json({
      success: false,
      error: 'Doctor profile not found for authenticated user.',
      code: 'PROFILE_NOT_FOUND',
    });
  }

  const latestApp = db.get(
    `SELECT * FROM verification_applications 
     WHERE target_type = 'doctor' AND target_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [doctor.id]
  );

  const doctorObj = {
    id: doctor.id,
    doctorId: doctor.id,
    fullName: doctor.full_name,
    licenseNumber: doctor.license_number,
    issuingCouncil: doctor.issuing_council,
    qualifications: doctor.qualifications,
    verificationStatus: doctor.verification_status,
    isVerified: Boolean(doctor.is_verified === 1 && doctor.verification_status === 'verified'),
    registrationCheckStatus: doctor.registration_check_status || 'unchecked',
    verifiedAt: doctor.verified_at,
  };

  const appObj = latestApp ? {
    id: latestApp.id,
    status: latestApp.status,
    submittedLicenseNumber: latestApp.submitted_license_number,
    issuingCouncil: latestApp.issuing_council,
    qualifications: latestApp.qualifications,
    supportingEvidence: JSON.parse(latestApp.supporting_evidence_json || '[]'),
    affiliationRequested: latestApp.affiliation_requested,
    clarificationRequest: latestApp.clarification_request,
    clarificationResponse: latestApp.clarification_response,
    decisionReason: latestApp.decision_reason,
    reviewNotes: latestApp.review_notes,
    reviewedAt: latestApp.reviewed_at,
    createdAt: latestApp.created_at,
    updatedAt: latestApp.updated_at
  } : null;

  res.status(200).json({
    success: true,
    data: {
      ...doctorObj,
      doctor: doctorObj,
      application: appObj,
      latestApplication: appObj,
    }
  });
});

/**
 * POST /api/doctor/portal/verification/submit
 * Doctor submits or resubmits credential verification application
 */
router.post(
  '/portal/verification/submit',
  authenticateToken,
  requireRole('doctor'),
  (req, res) => {
    const license_number = req.body.license_number || req.body.licenseNumber;
    const issuing_council = req.body.issuing_council || req.body.issuingCouncil;
    const qualifications = req.body.qualifications;
    const supporting_evidence = req.body.supporting_evidence || req.body.supportingEvidence;
    const affiliation_requested = req.body.affiliation_requested || req.body.affiliationRequested;

    if (!license_number || typeof license_number !== 'string' || license_number.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Registration / license number is required (min 3 chars).',
        code: 'VALIDATION_ERROR'
      });
    }

    if (!issuing_council || typeof issuing_council !== 'string' || issuing_council.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Issuing medical council is required (min 3 chars).',
        code: 'VALIDATION_ERROR'
      });
    }

    if (!qualifications || typeof qualifications !== 'string' || qualifications.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Degrees & qualifications are required (min 2 chars).',
        code: 'VALIDATION_ERROR'
      });
    }

    const doctor = db.get(
      `SELECT * FROM doctor_profiles WHERE user_id = ?`,
      [req.user.id]
    );

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor profile not found for authenticated user.',
        code: 'PROFILE_NOT_FOUND',
      });
    }

    // A doctor must not approve their own verification or change their verification status directly
    if (req.body.decision || req.body.status === 'verified' || req.body.is_verified) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized operation. Only platform administrators can review and approve credentials.',
        code: 'UNAUTHORIZED_VERIFICATION_CHANGE',
      });
    }

    // State validation: if already pending review, prevent duplicate submissions
    if (doctor.verification_status === 'pending') {
      return res.status(400).json({
        success: false,
        error: 'A credential verification application is already pending administrative review.',
        code: 'APPLICATION_ALREADY_PENDING',
      });
    }

    const evidenceArray = Array.isArray(supporting_evidence) ? supporting_evidence : [];

    const appId = db.transaction((tx) => {
      tx.run(
        `UPDATE doctor_profiles 
         SET license_number = ?, issuing_council = ?, qualifications = ?,
             verification_status = 'pending', is_verified = 0, updated_at = datetime('now')
         WHERE id = ?`,
        [license_number.trim(), issuing_council.trim(), qualifications.trim(), doctor.id]
      );

      const appResult = tx.run(
        `INSERT INTO verification_applications (
          user_id, target_type, target_id, submitted_license_number, issuing_council,
          qualifications, supporting_evidence_json, affiliation_requested, status
        ) VALUES (?, 'doctor', ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          req.user.id,
          doctor.id,
          license_number.trim(),
          issuing_council.trim(),
          qualifications.trim(),
          JSON.stringify(evidenceArray),
          affiliation_requested ? affiliation_requested.trim() : null
        ]
      );

      tx.run(
        `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, details_json, ip_address)
         VALUES (?, 'DOCTOR_VERIFICATION_SUBMITTED', 'DOCTOR', ?, ?, ?)`,
        [
          req.user.id,
          doctor.id,
          JSON.stringify({
            applicationId: appResult.lastInsertRowid,
            licenseNumber: license_number.trim(),
            issuingCouncil: issuing_council.trim(),
            evidenceCount: evidenceArray.length
          }),
          req.ip || '127.0.0.1'
        ]
      );

      return appResult.lastInsertRowid;
    });

    res.status(201).json({
      success: true,
      message: 'Credential verification application submitted successfully. It is now awaiting administrative review.',
      data: {
        applicationId: appId,
        verificationStatus: 'pending',
        licenseNumber: license_number.trim(),
        issuingCouncil: issuing_council.trim()
      }
    });
  }
);

/**
 * POST /api/doctor/portal/verification/clarify
 * Doctor responds to administrative clarification request
 */
router.post(
  '/portal/verification/clarify',
  authenticateToken,
  requireRole('doctor'),
  (req, res) => {
    const clarification_response = req.body.clarification_response || req.body.clarificationResponse;

    if (!clarification_response || typeof clarification_response !== 'string' || clarification_response.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Clarification response is required (min 5 characters).',
        code: 'VALIDATION_ERROR'
      });
    }

    const doctor = db.get(
      `SELECT * FROM doctor_profiles WHERE user_id = ?`,
      [req.user.id]
    );

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor profile not found.',
        code: 'PROFILE_NOT_FOUND',
      });
    }

    if (doctor.verification_status !== 'needs_clarification') {
      return res.status(400).json({
        success: false,
        error: `Cannot submit clarification when verification status is '${doctor.verification_status}'. Clarifications are only accepted when status is 'needs_clarification'.`,
        code: 'INVALID_STATUS_FOR_CLARIFICATION',
      });
    }

    const latestApp = db.get(
      `SELECT id FROM verification_applications 
       WHERE target_type = 'doctor' AND target_id = ?
       ORDER BY created_at DESC LIMIT 1`,
      [doctor.id]
    );

    if (!latestApp) {
      return res.status(404).json({
        success: false,
        error: 'Verification application record not found.',
        code: 'APPLICATION_NOT_FOUND',
      });
    }

    db.transaction((tx) => {
      tx.run(
        `UPDATE verification_applications
         SET status = 'pending', clarification_response = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [clarification_response.trim(), latestApp.id]
      );

      tx.run(
        `UPDATE doctor_profiles
         SET verification_status = 'pending', updated_at = datetime('now')
         WHERE id = ?`,
        [doctor.id]
      );

      tx.run(
        `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, details_json, ip_address)
         VALUES (?, 'DOCTOR_VERIFICATION_CLARIFIED', 'DOCTOR', ?, ?, ?)`,
        [
          req.user.id,
          doctor.id,
          JSON.stringify({ applicationId: latestApp.id, responseLength: clarification_response.trim().length }),
          req.ip || '127.0.0.1'
        ]
      );
    });

    res.status(200).json({
      success: true,
      message: 'Clarification submitted. Your application has been returned to pending review.',
      data: {
        applicationId: latestApp.id,
        status: 'pending',
        verificationStatus: 'pending'
      }
    });
  }
);

export default router;
