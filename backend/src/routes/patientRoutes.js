import { Router } from '../middleware/asyncRouter.js';
import { db } from '../db/database.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { validateBody } from '../middleware/validateMiddleware.js';

const router = Router();

// Protect all patient routes: must be authenticated with role 'patient'
router.use(authenticateToken, requireRole('patient'));

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
 * Helper to get maximum allowable booking horizon date (default 90 days)
 */
function getBookingHorizonDateString(days = 90) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Shared query snippet to fetch patient appointments with full context
 */
async function getPatientAppointments(patientId) {
  return await db.all(
    `SELECT
       a.id, a.patient_id, a.requested_date, a.preferred_slot, a.visit_type, a.reason_for_visit, a.status, a.is_demo_request, a.created_at, a.updated_at,
       d.id AS doctor_id, d.full_name AS doctor_name, d.specialty AS doctor_specialty,
       h.id AS hospital_id, h.name AS hospital_name,
       (
         SELECT notes FROM appointment_status_history
         WHERE appointment_id = a.id
         ORDER BY id DESC LIMIT 1
       ) AS latest_notes
     FROM appointment_requests a
     JOIN doctor_profiles d ON a.doctor_id = d.id
     LEFT JOIN hospitals h ON a.hospital_id = h.id
     WHERE a.patient_id = ?
     ORDER BY a.created_at DESC`,
    [patientId]
  );
}

/**
 * GET /api/patient/dashboard
 * Patient portal data summary with strict patient isolation
 */
router.get('/dashboard', async (req, res) => {
  const patientProfile = await db.get(
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
  const appointments = await getPatientAppointments(patientProfile.id);

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
      milestone: 'Milestone 5 Appointment Lifecycle & Collision Safeguards',
    },
  });
});

/**
 * GET /api/patient/profile
 * Returns authenticated patient's profile
 */
router.get('/profile', async (req, res) => {
  const patientProfile = await db.get(
    `SELECT id, user_id, full_name, phone, date_of_birth, gender, emergency_contact, city, is_synthetic, created_at, updated_at
     FROM patient_profiles WHERE user_id = ?`,
    [req.user.id]
  );

  if (!patientProfile) {
    return res.status(404).json({
      success: false,
      error: 'Patient profile not found for authenticated user.',
      code: 'PROFILE_NOT_FOUND',
    });
  }

  res.status(200).json({
    success: true,
    data: patientProfile,
  });
});

/**
 * PUT /api/patient/profile
 * Updates authenticated patient's profile.
 * Rejects protected/unknown fields, validates formats, updates atomically,
 * and records PATIENT_PROFILE_UPDATED audit log.
 */
router.put('/profile', async (req, res) => {
  const patientProfile = await db.get(
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

  // Guard against mass-assignment and unexpected fields
  const allowedFields = new Set([
    'full_name',
    'phone',
    'gender',
    'date_of_birth',
    'emergency_contact',
    'city',
  ]);

  const providedKeys = Object.keys(req.body);
  for (const key of providedKeys) {
    if (!allowedFields.has(key)) {
      return res.status(400).json({
        success: false,
        error: `Field '${key}' is not allowed for patient profile updates.`,
        code: 'DISALLOWED_FIELD',
      });
    }
  }

  // 1. Validate full_name
  let newFullName = patientProfile.full_name;
  if (req.body.full_name !== undefined) {
    if (typeof req.body.full_name !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Full name must be a string.',
        code: 'INVALID_FULL_NAME',
      });
    }
    const trimmedName = req.body.full_name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Full name must be between 2 and 100 characters.',
        code: 'INVALID_FULL_NAME',
      });
    }
    newFullName = trimmedName;
  }

  // 2. Validate phone
  let newPhone = patientProfile.phone;
  if (req.body.phone !== undefined) {
    if (req.body.phone === null || req.body.phone === '') {
      newPhone = null; // Cleared
    } else {
      if (typeof req.body.phone !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Phone must be a string or null.',
          code: 'INVALID_PHONE',
        });
      }
      const trimmedPhone = req.body.phone.trim();
      const phoneRegex = /^[+0-9()\-\s]{7,25}$/;
      const digitsOnly = trimmedPhone.replace(/\D/g, '');
      if (!phoneRegex.test(trimmedPhone) || digitsOnly.length < 7 || digitsOnly.length > 15) {
        return res.status(400).json({
          success: false,
          error: 'Phone number must be between 7 and 25 characters and contain only digits, spaces, dashes, parentheses, or a leading +.',
          code: 'INVALID_PHONE',
        });
      }
      newPhone = trimmedPhone;
    }
  }

  // 3. Validate gender
  let newGender = patientProfile.gender;
  if (req.body.gender !== undefined) {
    if (req.body.gender === null || req.body.gender === '') {
      newGender = 'Prefer not to say';
    } else {
      const allowedGenders = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];
      if (!allowedGenders.includes(req.body.gender)) {
        return res.status(400).json({
          success: false,
          error: `Gender must be one of: ${allowedGenders.join(', ')}.`,
          code: 'INVALID_GENDER',
        });
      }
      newGender = req.body.gender;
    }
  }

  // 4. Validate date_of_birth
  let newDob = patientProfile.date_of_birth;
  if (req.body.date_of_birth !== undefined) {
    if (req.body.date_of_birth === null || req.body.date_of_birth === '') {
      newDob = null;
    } else {
      if (typeof req.body.date_of_birth !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Date of birth must be a string in YYYY-MM-DD format.',
          code: 'INVALID_DOB_FORMAT',
        });
      }
      const trimmedDob = req.body.date_of_birth.trim();
      const dobMatch = trimmedDob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!dobMatch) {
        return res.status(400).json({
          success: false,
          error: 'Date of birth must follow YYYY-MM-DD format.',
          code: 'INVALID_DOB_FORMAT',
        });
      }

      const year = parseInt(dobMatch[1], 10);
      const month = parseInt(dobMatch[2], 10);
      const day = parseInt(dobMatch[3], 10);
      const dobDate = new Date(year, month - 1, day);

      if (
        isNaN(dobDate.getTime()) ||
        dobDate.getFullYear() !== year ||
        dobDate.getMonth() !== month - 1 ||
        dobDate.getDate() !== day
      ) {
        return res.status(400).json({
          success: false,
          error: 'Date of birth represents an invalid calendar date.',
          code: 'INVALID_DOB_CALENDAR',
        });
      }

      const today = getTodayDateString();
      if (trimmedDob > today) {
        return res.status(400).json({
          success: false,
          error: 'Date of birth cannot be in the future.',
          code: 'FUTURE_DOB_NOT_ALLOWED',
        });
      }

      if (year < 1900) {
        return res.status(400).json({
          success: false,
          error: 'Date of birth year cannot be earlier than 1900.',
          code: 'INVALID_DOB_RANGE',
        });
      }

      newDob = trimmedDob;
    }
  }

  // 5. Validate emergency_contact
  let newEmergencyContact = patientProfile.emergency_contact;
  if (req.body.emergency_contact !== undefined) {
    if (req.body.emergency_contact === null || req.body.emergency_contact === '') {
      newEmergencyContact = null;
    } else {
      if (typeof req.body.emergency_contact !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Emergency contact must be a string or null.',
          code: 'INVALID_EMERGENCY_CONTACT',
        });
      }
      const trimmedContact = req.body.emergency_contact.trim();
      if (trimmedContact.length > 200) {
        return res.status(400).json({
          success: false,
          error: 'Emergency contact must not exceed 200 characters.',
          code: 'INVALID_EMERGENCY_CONTACT_LENGTH',
        });
      }
      newEmergencyContact = trimmedContact;
    }
  }

  // 6. Validate city
  let newCity = patientProfile.city;
  if (req.body.city !== undefined) {
    if (req.body.city === null || req.body.city === '') {
      newCity = 'Chandigarh';
    } else {
      if (typeof req.body.city !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'City must be a string.',
          code: 'INVALID_CITY',
        });
      }
      const trimmedCity = req.body.city.trim();
      if (trimmedCity.length < 2 || trimmedCity.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'City must be between 2 and 100 characters.',
          code: 'INVALID_CITY_LENGTH',
        });
      }
      newCity = trimmedCity;
    }
  }

  // Atomic update and audit logging
  await db.transaction(async (tx) => {
    await tx.run(
      `UPDATE patient_profiles
       SET full_name = ?,
           phone = ?,
           gender = ?,
           date_of_birth = ?,
           emergency_contact = ?,
           city = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
      [newFullName, newPhone, newGender, newDob, newEmergencyContact, newCity, patientProfile.id]
    );

    await tx.run(
      `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, details_json, ip_address)
       VALUES (?, 'PATIENT_PROFILE_UPDATED', 'PATIENT_PROFILE', ?, ?, ?)`,
      [
        req.user.id,
        patientProfile.id,
        JSON.stringify({
          fullName: newFullName,
          phone: newPhone,
          gender: newGender,
          dob: newDob,
          emergencyContact: newEmergencyContact,
          city: newCity,
        }),
        req.ip || '127.0.0.1',
      ]
    );
  });

  const updatedProfile = await db.get(
    `SELECT id, user_id, full_name, phone, date_of_birth, gender, emergency_contact, city, is_synthetic, created_at, updated_at
     FROM patient_profiles WHERE id = ?`,
    [patientProfile.id]
  );

  return res.status(200).json({
    success: true,
    message: 'Patient profile updated successfully.',
    data: updatedProfile,
  });
});

/**
 * GET /api/patient/appointments
 * Dedicated endpoint returning list of appointments for authenticated patient
 */
router.get('/appointments', async (req, res) => {
  const patientProfile = await db.get(
    `SELECT id FROM patient_profiles WHERE user_id = ?`,
    [req.user.id]
  );

  if (!patientProfile) {
    return res.status(404).json({
      success: false,
      error: 'Patient profile not found for authenticated user.',
      code: 'PROFILE_NOT_FOUND',
    });
  }

  const appointments = await getPatientAppointments(patientProfile.id);

  res.status(200).json({
    success: true,
    count: appointments.length,
    data: appointments,
  });
});

/**
 * POST /api/patient/appointments
 * Request an appointment with a doctor.
 * Validates doctor eligibility, configured slots, 90-day booking horizon, collision prevention,
 * and derives patient identity strictly from authenticated JWT context.
 */
router.post(
  '/appointments',
  validateBody({
    doctor_id: { required: true },
    preferred_slot: { required: true, minLength: 2 },
  }),
  async (req, res) => {
    const { doctor_id, hospital_id, preferred_slot, requested_date, visit_type, reason_for_visit } = req.body;

    // 1. Strictly derive patient from auth context (never trust client payload)
    const patientProfile = await db.get(
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

    const doctor = await db.get(
      `SELECT id, full_name, is_accepting_new_patients, available_slots_json FROM doctor_profiles WHERE id = ?`,
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

    // 3. Validate Slot against Doctor's Configured Schedule
    let configuredSlots = [];
    try {
      configuredSlots = JSON.parse(doctor.available_slots_json || '[]');
    } catch {
      configuredSlots = [];
    }

    const normalizedSlot = typeof preferred_slot === 'string' ? preferred_slot.trim() : '';
    if (!Array.isArray(configuredSlots) || configuredSlots.length === 0) {
      return res.status(400).json({
        success: false,
        error: `${doctor.full_name} has no available appointment slots configured.`,
        code: 'NO_CONFIGURED_SLOTS',
      });
    }

    if (!configuredSlots.includes(normalizedSlot)) {
      return res.status(400).json({
        success: false,
        error: `Selected slot '${normalizedSlot}' is not configured for ${doctor.full_name}. Available slots: ${configuredSlots.join(', ')}.`,
        code: 'INVALID_SLOT_SELECTED',
      });
    }

    // 4. Validate Date: Past Date & 90-Day Horizon
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

    // Reject past dates
    if (targetDate < todayStr) {
      return res.status(400).json({
        success: false,
        error: `Requested appointment date (${targetDate}) cannot be in the past. Today is ${todayStr}.`,
        code: 'PAST_APPOINTMENT_DATE',
      });
    }

    // Reject past slots on today's date
    if (targetDate === todayStr && normalizedSlot) {
      const slotDateTime = parseAppointmentSlotDateTime(targetDate, normalizedSlot);
      if (slotDateTime && slotDateTime <= new Date()) {
        return res.status(400).json({
          success: false,
          error: `Cannot book appointment slot '${normalizedSlot}' on ${todayStr} because this time has already passed.`,
          code: 'PAST_APPOINTMENT_SLOT',
        });
      }
    }

    // Enforce 90-day booking horizon
    const maxHorizonDate = getBookingHorizonDateString(90);
    if (targetDate > maxHorizonDate) {
      return res.status(400).json({
        success: false,
        error: `Requested appointment date (${targetDate}) exceeds maximum advance booking horizon of 90 days (until ${maxHorizonDate}).`,
        code: 'DATE_EXCEEDS_HORIZON',
      });
    }

    // 5. Populate hospital_id from validated affiliation or primary doctor affiliation
    let resolvedHospitalId = null;
    if (hospital_id) {
      const parsedHospitalId = parseInt(hospital_id, 10);
      if (!isNaN(parsedHospitalId)) {
        const affiliation = await db.get(
          `SELECT hospital_id FROM doctor_hospital_affiliations WHERE doctor_id = ? AND hospital_id = ?`,
          [doctor.id, parsedHospitalId]
        );
        if (affiliation) {
          resolvedHospitalId = affiliation.hospital_id;
        }
      }
    }

    if (!resolvedHospitalId) {
      const primaryAffiliation = await db.get(
        `SELECT hospital_id FROM doctor_hospital_affiliations WHERE doctor_id = ? ORDER BY is_primary DESC, id ASC LIMIT 1`,
        [doctor.id]
      );
      if (primaryAffiliation) {
        resolvedHospitalId = primaryAffiliation.hospital_id;
      }
    }

    // 6. Collision Prevention: Reject if another patient already has this slot accepted/confirmed
    const existingAccepted = await db.get(
      `SELECT id FROM appointment_requests
       WHERE doctor_id = ? AND requested_date = ? AND preferred_slot = ?
       AND status IN ('accepted', 'confirmed')`,
      [doctor.id, targetDate, normalizedSlot]
    );

    if (existingAccepted) {
      return res.status(409).json({
        success: false,
        error: `The slot '${normalizedSlot}' on ${targetDate} has already been reserved and confirmed for another patient. Please choose a different time slot or date.`,
        code: 'SLOT_ALREADY_BOOKED',
      });
    }

    // 7. Prevent duplicate rapid submissions (within 30 seconds for same slot, date, and doctor by same patient)
    const recentDuplicate = await db.get(
      `SELECT id FROM appointment_requests 
       WHERE patient_id = ? AND doctor_id = ? AND requested_date = ? AND preferred_slot = ? AND status = 'pending'
       AND datetime(created_at, '+30 seconds') > datetime('now')`,
      [patientProfile.id, doctor.id, targetDate, normalizedSlot]
    );

    if (recentDuplicate) {
      return res.status(409).json({
        success: false,
        error: 'A request for this slot has just been submitted and is currently being processed. Please avoid rapid duplicate clicks.',
        code: 'DUPLICATE_SUBMISSION_DETECTED',
      });
    }

    // 8. Atomic Transaction: Insert request and status history with initial status 'pending'
    let newAppointmentId;
    try {
      newAppointmentId = await db.transaction(async (tx) => {
        // Double check conflict inside transaction to avoid race conditions
        const inTxConflict = await tx.get(
          `SELECT id FROM appointment_requests
           WHERE doctor_id = ? AND requested_date = ? AND preferred_slot = ?
           AND status IN ('accepted', 'confirmed')`,
          [doctor.id, targetDate, normalizedSlot]
        );
        if (inTxConflict) {
          const conflictErr = new Error(`Slot '${normalizedSlot}' on ${targetDate} is already confirmed.`);
          conflictErr.code = 'SLOT_ALREADY_BOOKED';
          throw conflictErr;
        }

        const result = await tx.run(
          `INSERT INTO appointment_requests (
            patient_id, doctor_id, hospital_id, requested_date, preferred_slot, visit_type, reason_for_visit, status, is_demo_request
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1)`,
          [
            patientProfile.id,
            doctor.id,
            resolvedHospitalId,
            targetDate,
            normalizedSlot,
            visit_type || 'In-person',
            reason_for_visit ? reason_for_visit.trim() : 'General Consultation',
          ]
        );

        const apptId = result.lastInsertRowid;

        await tx.run(
          `INSERT INTO appointment_status_history (appointment_id, status, notes, changed_by_user_id)
           VALUES (?, 'pending', 'Appointment requested by patient', ?)`,
          [apptId, req.user.id]
        );

        await tx.run(
          `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, details_json, ip_address)
           VALUES (?, 'APPOINTMENT_REQUEST_CREATED', 'APPOINTMENT', ?, ?, ?)`,
          [
            req.user.id,
            apptId,
            JSON.stringify({ doctorId: doctor.id, slot: normalizedSlot, requestedDate: targetDate }),
            req.ip || '127.0.0.1',
          ]
        );

        return apptId;
      });
    } catch (err) {
      if (
        err.code === 'SLOT_ALREADY_BOOKED' ||
        (err.message && err.message.includes('UNIQUE constraint')) ||
        (err.code && String(err.code).includes('CONSTRAINT'))
      ) {
        return res.status(409).json({
          success: false,
          error: `The slot '${normalizedSlot}' on ${targetDate} has already been reserved and confirmed for another patient. Please choose a different time slot or date.`,
          code: 'SLOT_ALREADY_BOOKED',
        });
      }
      throw err;
    }

    res.status(201).json({
      success: true,
      message: `Appointment request submitted for ${doctor.full_name} at ${normalizedSlot}. Status is Pending Doctor Review.`,
      data: {
        id: newAppointmentId,
        appointmentId: newAppointmentId,
        doctor_id: doctor.id,
        doctorId: doctor.id,
        doctorName: doctor.full_name,
        hospital_id: resolvedHospitalId,
        preferred_slot: normalizedSlot,
        preferredSlot: normalizedSlot,
        requested_date: targetDate,
        requestedDate: targetDate,
        status: 'pending',
      },
    });
  }
);

/**
 * Handler for patient cancelling an appointment
 * Validates patient ownership and cancellable state
 */
async function handlePatientCancel(req, res) {
  const appointmentId = parseInt(req.params.id, 10);
  if (isNaN(appointmentId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid appointment ID provided.',
      code: 'INVALID_APPOINTMENT_ID',
    });
  }

  const patientProfile = await db.get(
    `SELECT id FROM patient_profiles WHERE user_id = ?`,
    [req.user.id]
  );

  if (!patientProfile) {
    return res.status(404).json({
      success: false,
      error: 'Patient profile not found for authenticated user.',
      code: 'PROFILE_NOT_FOUND',
    });
  }

  const appointment = await db.get(
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

  // Strict Ownership: Patient can only cancel their own appointment
  if (appointment.patient_id !== patientProfile.id) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: You are not authorized to cancel another patient\'s appointment.',
      code: 'FORBIDDEN_APPOINTMENT_ACCESS',
    });
  }

  // Status Check: Only pending, requested, accepted, or confirmed can be cancelled
  const cancellableStatuses = ['pending', 'requested', 'accepted', 'confirmed'];
  if (!cancellableStatuses.includes(appointment.status)) {
    return res.status(400).json({
      success: false,
      error: `Cannot cancel appointment with status '${appointment.status}'. Only pending or confirmed appointments can be cancelled.`,
      code: 'INVALID_STATUS_TRANSITION',
    });
  }

  // Date Check: Cannot cancel past appointments
  const todayStr = getTodayDateString();
  if (appointment.requested_date && appointment.requested_date < todayStr) {
    return res.status(400).json({
      success: false,
      error: `Cannot cancel an appointment whose scheduled date (${appointment.requested_date}) has already passed.`,
      code: 'APPOINTMENT_DATE_PASSED',
    });
  }

  // Time Check: Cannot cancel if appointment is today and scheduled slot time has already passed
  if (appointment.requested_date === todayStr && appointment.preferred_slot) {
    const slotDateTime = parseAppointmentSlotDateTime(appointment.requested_date, appointment.preferred_slot);
    if (slotDateTime && slotDateTime <= new Date()) {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel an appointment whose scheduled time (${appointment.preferred_slot}) on ${todayStr} has already passed or is currently taking place.`,
        code: 'APPOINTMENT_TIME_PASSED',
      });
    }
  }

  for (const field of ['notes','reason']) {
    if (req.body?.[field] !== undefined && (typeof req.body[field] !== 'string' || req.body[field].length > 500)) return res.status(400).json({success:false,error:'Cancellation notes must be text of at most 500 characters.',code:'INVALID_NOTES'});
  }
  const cancelReason = req.body?.notes?.trim() || req.body?.reason?.trim() ||
    (appointment.requested_date === todayStr
      ? 'Same-day cancellation by patient'
      : 'Appointment cancelled by patient');

  await db.transaction(async (tx) => {
    const transition = await tx.run(
      `UPDATE appointment_requests SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND status = ?`,
      [appointmentId, appointment.status]
    );
    if (!transition.changes) throw Object.assign(new Error('Appointment changed; refresh before trying again.'), {status:409,code:'STALE_APPOINTMENT'});

    await tx.run(
      `INSERT INTO appointment_status_history (appointment_id, status, notes, changed_by_user_id)
       VALUES (?, 'cancelled', ?, ?)`,
      [appointmentId, cancelReason, req.user.id]
    );

    await tx.run(
      `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, details_json, ip_address)
       VALUES (?, 'PATIENT_APPOINTMENT_CANCELLED', 'APPOINTMENT', ?, ?, ?)`,
      [
        req.user.id,
        appointmentId,
        JSON.stringify({ previousStatus: appointment.status, requestedDate: appointment.requested_date, reason: cancelReason }),
        req.ip || '127.0.0.1',
      ]
    );
  });

  const updated = await db.get(`SELECT * FROM appointment_requests WHERE id = ?`, [appointmentId]);

  res.status(200).json({
    success: true,
    message: `Appointment #${appointmentId} was successfully cancelled.`,
    data: updated,
  });
}

/**
 * PATCH /api/patient/appointments/:id/cancel
 * POST /api/patient/appointments/:id/cancel (fallback)
 */
router.patch('/appointments/:id/cancel', handlePatientCancel);
router.post('/appointments/:id/cancel', handlePatientCancel);

export default router;
