import { Router } from 'express';
import { db } from '../db/connection.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { validateBody } from '../middleware/validateMiddleware.js';

const router = Router();

// Protect all patient routes: must be authenticated with role 'patient'
router.use(authenticateToken, requireRole('patient'));

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
 * GET /api/patient/dashboard
 * Patient portal data summary with strict patient isolation
 */
router.get('/dashboard', (req, res) => {
  const patientProfile = db.get(
    `SELECT * FROM patient_profiles WHERE user_id = ?`,
    [req.user.id]
  );

  if (!patientProfile) {
    return res.status(404).json({
      success: false,
      error: 'Patient profile not found for authenticated user.',
      code: 'PROFILE_NOT_FOUND',
    });
  }

  // Strict Isolation: Get ONLY appointments for this authenticated patient
  const appointments = db.all(
    `SELECT 
       a.id, a.patient_id, a.requested_date, a.preferred_slot, a.visit_type, a.reason_for_visit, a.status, a.is_demo_request, a.created_at,
       d.id AS doctor_id, d.full_name AS doctor_name, d.specialty AS doctor_specialty,
       h.name AS hospital_name
     FROM appointment_requests a
     JOIN doctor_profiles d ON a.doctor_id = d.id
     LEFT JOIN hospitals h ON a.hospital_id = h.id
     WHERE a.patient_id = ?
     ORDER BY a.created_at DESC`,
    [patientProfile.id]
  );

  const pendingCount = appointments.filter(
    (a) => a.status === 'pending' || a.status === 'requested'
  ).length;
  const acceptedCount = appointments.filter(
    (a) => a.status === 'accepted' || a.status === 'confirmed'
  ).length;
  const declinedCount = appointments.filter(
    (a) => a.status === 'declined' || a.status === 'cancelled'
  ).length;

  res.status(200).json({
    success: true,
    data: {
      profile: patientProfile,
      appointments,
      metrics: {
        totalAppointments: appointments.length,
        pendingRequests: pendingCount,
        acceptedAppointments: acceptedCount,
        declinedAppointments: declinedCount,
      },
      milestone: 'Milestone 2 Database-Backed Appointments',
    },
  });
});

/**
 * POST /api/patient/appointments
 * Request an appointment with a doctor.
 * Validates doctor eligibility, past/invalid dates, prevents rapid duplicates,
 * and derives patient identity strictly from authenticated JWT context.
 */
router.post(
  '/appointments',
  validateBody({
    doctor_id: { required: true },
    preferred_slot: { required: true, minLength: 2 },
  }),
  (req, res) => {
    const { doctor_id, hospital_id, preferred_slot, requested_date, visit_type, reason_for_visit } = req.body;

    // 1. Strictly derive patient from auth context (never trust client payload)
    const patientProfile = db.get(
      `SELECT id, full_name FROM patient_profiles WHERE user_id = ?`,
      [req.user.id]
    );

    if (!patientProfile) {
      return res.status(404).json({
        success: false,
        error: 'Patient profile not found. Complete your profile before requesting visits.',
        code: 'PATIENT_PROFILE_NOT_FOUND',
      });
    }

    // 2. Validate Doctor exists and is accepting patients
    const parsedDoctorId = parseInt(doctor_id, 10);
    if (isNaN(parsedDoctorId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid doctor ID provided.',
        code: 'INVALID_DOCTOR_ID',
      });
    }

    const doctor = db.get(
      `SELECT id, full_name, is_accepting_new_patients FROM doctor_profiles WHERE id = ?`,
      [parsedDoctorId]
    );

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found in directory.',
        code: 'DOCTOR_NOT_FOUND',
      });
    }

    if (!doctor.is_accepting_new_patients) {
      return res.status(400).json({
        success: false,
        error: `${doctor.full_name} is currently not accepting new patient appointment requests.`,
        code: 'DOCTOR_NOT_ACCEPTING_REQUESTS',
      });
    }

    // 3. Validate Date & Reject Past Times
    const todayStr = getTodayDateString();
    const targetDate = requested_date ? requested_date.trim() : todayStr;

    // Validate format (YYYY-MM-DD or standard date)
    const parsedDate = new Date(targetDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid appointment date format. Use YYYY-MM-DD.',
        code: 'INVALID_DATE_FORMAT',
      });
    }

    // Reject past dates (compare YYYY-MM-DD string)
    if (targetDate < todayStr) {
      return res.status(400).json({
        success: false,
        error: `Requested appointment date (${targetDate}) cannot be in the past. Today is ${todayStr}.`,
        code: 'PAST_APPOINTMENT_DATE',
      });
    }

    // 4. Prevent duplicate rapid submissions (within 30 seconds for same slot and doctor)
    const recentDuplicate = db.get(
      `SELECT id FROM appointment_requests 
       WHERE patient_id = ? AND doctor_id = ? AND preferred_slot = ? AND status = 'pending'
       AND datetime(created_at, '+30 seconds') > datetime('now')`,
      [patientProfile.id, doctor.id, preferred_slot.trim()]
    );

    if (recentDuplicate) {
      return res.status(409).json({
        success: false,
        error: 'A request for this slot has just been submitted and is currently being processed. Please avoid rapid duplicate clicks.',
        code: 'DUPLICATE_SUBMISSION_DETECTED',
      });
    }

    // 5. Atomic Transaction: Insert request and status history with initial status 'pending'
    const newAppointmentId = db.transaction((tx) => {
      const result = tx.run(
        `INSERT INTO appointment_requests (
          patient_id, doctor_id, hospital_id, requested_date, preferred_slot, visit_type, reason_for_visit, status, is_demo_request
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1)`,
        [
          patientProfile.id,
          doctor.id,
          hospital_id ? parseInt(hospital_id, 10) : null,
          targetDate,
          preferred_slot.trim(),
          visit_type || 'In-person',
          reason_for_visit ? reason_for_visit.trim() : 'General Consultation',
        ]
      );

      const apptId = result.lastInsertRowid;

      tx.run(
        `INSERT INTO appointment_status_history (appointment_id, status, notes, changed_by_user_id)
         VALUES (?, 'pending', 'Appointment requested by patient', ?)`,
        [apptId, req.user.id]
      );

      tx.run(
        `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, details_json, ip_address)
         VALUES (?, 'APPOINTMENT_REQUEST_CREATED', 'APPOINTMENT', ?, ?, ?)`,
        [
          req.user.id,
          apptId,
          JSON.stringify({ doctorId: doctor.id, slot: preferred_slot, requestedDate: targetDate }),
          req.ip || '127.0.0.1',
        ]
      );

      return apptId;
    });

    res.status(201).json({
      success: true,
      message: `Appointment request submitted for ${doctor.full_name} at ${preferred_slot}. Status is Pending Doctor Review.`,
      data: {
        id: newAppointmentId,
        appointmentId: newAppointmentId,
        doctor_id: doctor.id,
        doctorId: doctor.id,
        doctorName: doctor.full_name,
        preferred_slot: preferred_slot.trim(),
        preferredSlot: preferred_slot.trim(),
        requested_date: targetDate,
        requestedDate: targetDate,
        status: 'pending',
      },
    });
  }
);

export default router;
