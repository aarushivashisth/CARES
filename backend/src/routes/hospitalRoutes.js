import { Router } from '../middleware/asyncRouter.js';
import { db } from '../db/database.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { validateBody } from '../middleware/validateMiddleware.js';

const router = Router();

// Protect all hospital routes: must be authenticated with role 'hospital'
router.use(authenticateToken, requireRole('hospital'));

/**
 * GET /api/hospital/dashboard
 * Protected hospital / clinic facility portal
 */
router.get('/dashboard', async (req, res) => {
  const hospital = await db.get(
    `SELECT * FROM hospitals WHERE user_id = ?`,
    [req.user.id]
  );

  if (!hospital) {
    return res.status(404).json({
      success: false,
      error: 'Hospital facility record not found for authenticated manager account.',
      code: 'HOSPITAL_NOT_FOUND',
    });
  }

  // Get currently affiliated doctors with detailed verification and provenance fields
  const affiliatedDoctors = await db.all(
    `SELECT 
       d.id, d.full_name, d.specialty, d.rating, d.is_verified, d.verification_status,
       d.license_number, d.issuing_council, d.qualifications, d.experience_years,
       dha.role_at_facility, dha.affiliation_source, dha.last_checked_date, dha.is_primary
     FROM doctor_hospital_affiliations dha
     JOIN doctor_profiles d ON dha.doctor_id = d.id
     WHERE dha.hospital_id = ?
     ORDER BY dha.is_primary DESC, d.full_name ASC`,
    [hospital.id]
  );

  // Get system doctors not currently affiliated with this facility (for affiliation management)
  const availableDoctors = await db.all(
    `SELECT d.id, d.full_name, d.specialty, d.license_number, d.verification_status
     FROM doctor_profiles d
     WHERE d.id NOT IN (
       SELECT doctor_id FROM doctor_hospital_affiliations WHERE hospital_id = ?
     )
     ORDER BY d.full_name ASC`,
    [hospital.id]
  );

  res.status(200).json({
    success: true,
    data: {
      facility: {
        id: hospital.id,
        name: hospital.name,
        address: hospital.address,
        city: hospital.city,
        state: hospital.state,
        phone: hospital.phone || 'Unavailable',
        email: hospital.email || 'Unavailable',
        websiteUrl: hospital.website_url || null,
        operatingHours: JSON.parse(hospital.operating_hours_json || '{}'),
        crowdLevel: hospital.crowd_level,
        emergencyAvailable: Boolean(hospital.emergency_available),
        isVerified: Boolean(hospital.is_verified === 1 && hospital.verification_status === 'verified'),
        verificationStatus: hospital.verification_status,
        departments: JSON.parse(hospital.departments_json || '[]'),
        provenanceStatus: hospital.provenance_status || 'synthetic_demo',
        sourceOrganization: hospital.source_organization,
        sourceUrl: hospital.source_url,
        lastCheckedDate: hospital.last_checked_date,
      },
      affiliatedDoctors: affiliatedDoctors.map((doc) => ({
        ...doc,
        isVerified: Boolean(doc.is_verified === 1 && doc.verification_status === 'verified'),
      })),
      availableDoctors,
      metrics: {
        totalAffiliatedDoctors: affiliatedDoctors.length,
        crowdStatus: hospital.crowd_level,
        emergencyActive: Boolean(hospital.emergency_available),
        verifiedProviders: affiliatedDoctors.filter((d) => d.verification_status === 'verified').length,
      },
      milestone: 'Milestone 3 Hospital & Facility Governance',
    },
  });
});

/**
 * PUT /api/hospital/profile
 * Update facility operating details, website, contact, and departments.
 * Strictly scoped to the authenticated manager's assigned hospital.
 */
router.put('/profile', async (req, res) => {

  const hospital = await db.get(
    `SELECT id, name FROM hospitals WHERE user_id = ?`,
    [req.user.id]
  );

  if (!hospital) {
    return res.status(404).json({
      success: false,
      error: 'Hospital facility record not found for authenticated manager.',
      code: 'HOSPITAL_NOT_FOUND',
    });
  }

  // Security: Hospital users cannot approve credentials, grant admin rights, or alter verification flags
  if (req.body.is_verified !== undefined || req.body.verification_status !== undefined || req.body.role !== undefined) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Hospital accounts cannot alter verification status or role assignments.',
      code: 'FORBIDDEN_FIELD_MUTATION',
    });
  }

  const name = req.body.name;
  const address = req.body.address;
  const city = req.body.city;
  const state = req.body.state;
  const phone = req.body.phone;
  const email = req.body.email;
  const website_url = req.body.website_url || req.body.websiteUrl;
  const emergency_available = req.body.emergency_available !== undefined ? req.body.emergency_available : req.body.emergencyAvailable;
  const operating_hours_json = req.body.operating_hours_json || (req.body.operating_hours ? JSON.stringify(req.body.operating_hours) : null);
  const departments_json = req.body.departments ? JSON.stringify(req.body.departments) : (req.body.departments_json || null);

  const invalid = message => res.status(400).json({success:false,error:message,code:'INVALID_PROFILE'});
  for (const [field,value] of Object.entries({name,address,city,state,phone,email,website_url})) {
    if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > 300)) return invalid(`${field} must be text of at most 300 characters.`);
  }
  if (name !== undefined && name.trim().length < 2) return invalid('Facility name is required.');
  if (website_url) { try { if (!['https:','http:'].includes(new URL(website_url).protocol)) return invalid('Website must use HTTP or HTTPS.'); } catch { return invalid('Enter a valid website URL.'); } }
  if (emergency_available !== undefined && ![true,false,0,1,null].includes(emergency_available)) return invalid('Emergency availability must be boolean or unknown.');
  if (operating_hours_json) {
    try { const hours=JSON.parse(operating_hours_json); if (!hours || typeof hours!=='object' || Array.isArray(hours) || Object.values(hours).some(v=>typeof v!=='string'||v.length>300)) return invalid('Operating hours must be a JSON object of text values.'); }
    catch { return invalid('Operating hours must be valid JSON.'); }
  }
  if (departments_json) {
    try { const departments=JSON.parse(departments_json); if (!Array.isArray(departments) || departments.length>80 || departments.some(d=>typeof d!=='string'||!d.trim()||d.length>100)) return invalid('Departments must be an array of department names.'); }
    catch { return invalid('Departments must be valid JSON.'); }
  }

  await db.transaction(async (tx) => {
    await tx.run(
      `UPDATE hospitals
       SET name = COALESCE(?, name),
           address = COALESCE(?, address),
           city = COALESCE(?, city),
           state = COALESCE(?, state),
           phone = COALESCE(?, phone),
           email = COALESCE(?, email),
           website_url = COALESCE(?, website_url),
           operating_hours_json = COALESCE(?, operating_hours_json),
           emergency_available = COALESCE(?, emergency_available),
           departments_json = COALESCE(?, departments_json),
           updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
      [
        name ? name.trim() : null,
        address ? address.trim() : null,
        city ? city.trim() : null,
        state ? state.trim() : null,
        phone ? phone.trim() : null,
        email ? email.trim() : null,
        website_url ? website_url.trim() : null,
        operating_hours_json ? operating_hours_json.trim() : null,
        emergency_available !== undefined && emergency_available !== null ? (emergency_available ? 1 : 0) : null,
        departments_json ? departments_json.trim() : null,
        hospital.id,
        req.user.id,
      ]
    );

    await tx.run(
      `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, details_json, ip_address)
       VALUES (?, 'HOSPITAL_PROFILE_UPDATED', 'HOSPITAL', ?, ?, ?)`,
      [
        req.user.id,
        hospital.id,
        JSON.stringify({ hospitalName: name || hospital.name, websiteUrl: website_url || null }),
        req.ip || '127.0.0.1',
      ]
    );
  });

  const updatedHospital = await db.get(
    `SELECT * FROM hospitals WHERE id = ? AND user_id = ?`,
    [hospital.id, req.user.id]
  );

  res.status(200).json({
    success: true,
    message: `${updatedHospital.name} details have been successfully updated.`,
    data: updatedHospital,
  });
});

/**
 * POST /api/hospital/affiliations
 * Affiliated doctor management: Add an affiliation to the authenticated hospital
 */
router.post(
  '/affiliations',
  validateBody({
    doctor_id: { required: true },
  }),
  async (req, res) => {
    const { doctor_id, role_at_facility, distance_text } = req.body;

    const hospital = await db.get(
      `SELECT id, name FROM hospitals WHERE user_id = ?`,
      [req.user.id]
    );

    if (!hospital) {
      return res.status(404).json({
        success: false,
        error: 'Hospital facility record not found.',
        code: 'HOSPITAL_NOT_FOUND',
      });
    }

    const doctorIdInt = parseInt(doctor_id, 10);
    const doctor = await db.get(
      `SELECT id, full_name FROM doctor_profiles WHERE id = ?`,
      [doctorIdInt]
    );

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found in directory.',
        code: 'DOCTOR_NOT_FOUND',
      });
    }

    // Check if affiliation already exists
    const existing = await db.get(
      `SELECT id FROM doctor_hospital_affiliations WHERE doctor_id = ? AND hospital_id = ?`,
      [doctorIdInt, hospital.id]
    );

    if (existing) {
      return res.status(400).json({
        success: false,
        error: `${doctor.full_name} is already affiliated with ${hospital.name}.`,
        code: 'AFFILIATION_ALREADY_EXISTS',
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    await db.transaction(async (tx) => {
      await tx.run(
        `INSERT INTO doctor_hospital_affiliations (
          doctor_id, hospital_id, role_at_facility, distance_text, affiliation_source, last_checked_date, is_primary
        ) VALUES (?, ?, ?, ?, 'Hospital Management Portal', ?, 0)`,
        [
          doctorIdInt,
          hospital.id,
          role_at_facility ? role_at_facility.trim() : 'Consultant Physician',
          distance_text ? distance_text.trim() : 'Local facility',
          todayStr,
        ]
      );

      await tx.run(
        `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, details_json, ip_address)
         VALUES (?, 'DOCTOR_AFFILIATION_ADDED', 'HOSPITAL', ?, ?, ?)`,
        [
          req.user.id,
          hospital.id,
          JSON.stringify({ doctorId: doctorIdInt, doctorName: doctor.full_name }),
          req.ip || '127.0.0.1',
        ]
      );
    });

    res.status(201).json({
      success: true,
      message: `${doctor.full_name} has been successfully affiliated with ${hospital.name}.`,
    });
  }
);

/**
 * DELETE /api/hospital/affiliations/:doctorId
 * Remove a doctor affiliation from the authenticated hospital
 */
router.delete('/affiliations/:doctorId', async (req, res) => {
  const doctorIdInt = parseInt(req.params.doctorId, 10);

  const hospital = await db.get(
    `SELECT id, name FROM hospitals WHERE user_id = ?`,
    [req.user.id]
  );

  if (!hospital) {
    return res.status(404).json({
      success: false,
      error: 'Hospital facility record not found.',
      code: 'HOSPITAL_NOT_FOUND',
    });
  }

  const existing = await db.get(
    `SELECT id FROM doctor_hospital_affiliations WHERE doctor_id = ? AND hospital_id = ?`,
    [doctorIdInt, hospital.id]
  );

  if (!existing) {
    return res.status(404).json({
      success: false,
      error: 'Affiliation record not found for this facility.',
      code: 'AFFILIATION_NOT_FOUND',
    });
  }

  await db.transaction(async (tx) => {
    await tx.run(
      `DELETE FROM doctor_hospital_affiliations WHERE doctor_id = ? AND hospital_id = ?`,
      [doctorIdInt, hospital.id]
    );

    await tx.run(
      `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, details_json, ip_address)
       VALUES (?, 'DOCTOR_AFFILIATION_REMOVED', 'HOSPITAL', ?, ?, ?)`,
      [
        req.user.id,
        hospital.id,
        JSON.stringify({ doctorId: doctorIdInt, hospitalName: hospital.name }),
        req.ip || '127.0.0.1',
      ]
    );
  });

  res.status(200).json({
    success: true,
    message: 'Doctor affiliation was successfully removed.',
  });
});

export default router;
