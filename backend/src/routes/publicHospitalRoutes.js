import { Router } from 'express';
import { db } from '../db/connection.js';

const router = Router();

/**
 * GET /api/hospitals
 * Public healthcare facility directory with provenance and capacity information
 */
router.get('/', (req, res) => {
  const { city, emergency } = req.query;

  let query = `
    SELECT 
      h.id, h.name, h.address, h.city, h.state, h.phone, h.website_url,
      h.operating_hours_json, h.crowd_level, h.emergency_available,
      h.is_verified, h.verification_status, h.departments_json, h.is_synthetic,
      h.source_url, h.source_organization, h.last_checked_date, h.provenance_status,
      COUNT(dha.doctor_id) AS doctor_count
    FROM hospitals h
    LEFT JOIN doctor_hospital_affiliations dha ON h.id = dha.hospital_id
    WHERE 1=1
  `;
  const params = [];

  if (city && city.trim()) {
    query += ` AND LOWER(h.city) = LOWER(?)`;
    params.push(city.trim());
  }

  if (emergency !== undefined) {
    const isEmergency = emergency === 'true' || emergency === '1';
    query += ` AND h.emergency_available = ?`;
    params.push(isEmergency ? 1 : 0);
  }

  query += ` GROUP BY h.id ORDER BY h.id ASC`;

  const hospitals = db.all(query, params);

  const formatted = hospitals.map((h) => ({
    id: h.id,
    name: h.name,
    address: h.address,
    city: h.city,
    state: h.state,
    phone: h.phone || null,
    websiteUrl: h.website_url || null,
    operatingHours: JSON.parse(h.operating_hours_json || '{"regular":"08:00 - 20:00","emergency":"24/7"}'),
    crowdLevel: h.is_synthetic ? h.crowd_level : null,
    emergencyAvailable: h.emergency_available === 1 ? true : (h.emergency_available === 0 ? false : null),
    departments: JSON.parse(h.departments_json || '[]'),
    isVerified: Boolean(h.is_verified === 1 && h.verification_status === 'verified' && !h.is_synthetic),
    verificationStatus: h.verification_status,
    isSynthetic: Boolean(h.is_synthetic),
    provenanceStatus: h.provenance_status || (h.is_synthetic ? 'synthetic_demo' : 'publicly_sourced'),
    sourceUrl: h.source_url || null,
    sourceOrganization: h.source_organization || null,
    lastCheckedDate: h.last_checked_date || null,
    doctorCount: Number(h.doctor_count || 0),
  }));

  res.status(200).json({
    success: true,
    count: formatted.length,
    data: formatted,
  });
});

/**
 * GET /api/hospitals/:id
 * Public detailed hospital profile with capacity, departments, and affiliated doctors
 */
router.get('/:id', (req, res) => {
  const hospitalId = parseInt(req.params.id, 10);
  if (isNaN(hospitalId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid hospital ID provided.',
      code: 'INVALID_HOSPITAL_ID',
    });
  }

  const h = db.get(
    `SELECT 
       h.id, h.name, h.address, h.city, h.state, h.phone, h.website_url,
       h.operating_hours_json, h.crowd_level, h.emergency_available,
       h.is_verified, h.verification_status, h.departments_json, h.is_synthetic,
       h.source_url, h.source_organization, h.last_checked_date, h.provenance_status
     FROM hospitals h
     WHERE h.id = ?`,
    [hospitalId]
  );

  if (!h) {
    return res.status(404).json({
      success: false,
      error: 'Hospital not found in directory.',
      code: 'HOSPITAL_NOT_FOUND',
    });
  }

  const affiliatedDoctors = db.all(
    `SELECT 
       d.id, d.full_name, d.specialty, d.rating, d.experience_years,
       d.is_verified, d.verification_status, d.is_synthetic, d.provenance_status,
       dha.role_at_facility, dha.distance_text, dha.is_primary
     FROM doctor_hospital_affiliations dha
     JOIN doctor_profiles d ON dha.doctor_id = d.id
     WHERE dha.hospital_id = ?
     ORDER BY dha.is_primary DESC, d.full_name ASC`,
    [hospitalId]
  );

  const formattedHospital = {
    id: h.id,
    name: h.name,
    address: h.address,
    city: h.city,
    state: h.state,
    phone: h.phone || null,
    websiteUrl: h.website_url || null,
    operatingHours: JSON.parse(h.operating_hours_json || '{"regular":"08:00 - 20:00","emergency":"24/7"}'),
    crowdLevel: h.is_synthetic ? h.crowd_level : null,
    emergencyAvailable: h.emergency_available === 1 ? true : (h.emergency_available === 0 ? false : null),
    departments: JSON.parse(h.departments_json || '[]'),
    isVerified: Boolean(h.is_verified === 1 && h.verification_status === 'verified' && !h.is_synthetic),
    verificationStatus: h.verification_status,
    isSynthetic: Boolean(h.is_synthetic),
    provenanceStatus: h.provenance_status || (h.is_synthetic ? 'synthetic_demo' : 'publicly_sourced'),
    sourceUrl: h.source_url || null,
    sourceOrganization: h.source_organization || null,
    lastCheckedDate: h.last_checked_date || null,
    affiliatedDoctors: affiliatedDoctors.map((doc) => ({
      id: doc.id,
      name: doc.full_name,
      specialty: doc.specialty,
      rating: doc.rating,
      experience: doc.experience_years,
      roleAtFacility: doc.role_at_facility,
      distance: doc.distance_text,
      isPrimary: Boolean(doc.is_primary),
      isVerified: Boolean(doc.is_verified === 1 && doc.verification_status === 'verified' && !doc.is_synthetic),
      verificationStatus: doc.verification_status,
      isSynthetic: Boolean(doc.is_synthetic),
      provenanceStatus: doc.provenance_status,
    })),
  };

  res.status(200).json({
    success: true,
    data: formattedHospital,
  });
});

export default router;
