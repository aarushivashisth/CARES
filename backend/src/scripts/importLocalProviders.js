import { getDb } from '../db/connection.js';
import { config } from '../config/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALID_PROVENANCE_STATUSES = new Set([
  'synthetic_demo',
  'publicly_sourced',
  'registration_checked',
  'cares_verified'
]);

function isValidUrl(urlString) {
  if (!urlString) return true; // optional
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateFacilityRecord(fac) {
  const errors = [];
  if (!fac.name || typeof fac.name !== 'string' || fac.name.trim().length < 3) {
    errors.push('name must be a non-empty string with at least 3 characters');
  }
  if (!fac.city || typeof fac.city !== 'string' || fac.city.trim().length < 2) {
    errors.push('city must be a valid string');
  }
  if (!fac.state || typeof fac.state !== 'string' || fac.state.trim().length < 2) {
    errors.push('state must be a valid string');
  }
  if (fac.sourceUrl && !isValidUrl(fac.sourceUrl)) {
    errors.push(`sourceUrl "${fac.sourceUrl}" is not a valid HTTP/HTTPS URL`);
  }
  if (fac.provenanceStatus && !VALID_PROVENANCE_STATUSES.has(fac.provenanceStatus)) {
    errors.push(`provenanceStatus "${fac.provenanceStatus}" is not in valid enum set`);
  }
  return errors;
}

export function validateDoctorRecord(doc) {
  const errors = [];
  if (!doc.fullName || typeof doc.fullName !== 'string' || doc.fullName.trim().length < 2) {
    errors.push('fullName must be a non-empty string');
  }
  if (!doc.specialty || typeof doc.specialty !== 'string' || doc.specialty.trim().length < 2) {
    errors.push('specialty must be a non-empty string');
  }
  if (doc.sourceUrl && !isValidUrl(doc.sourceUrl)) {
    errors.push(`sourceUrl "${doc.sourceUrl}" is not a valid HTTP/HTTPS URL`);
  }
  if (doc.provenanceStatus && !VALID_PROVENANCE_STATUSES.has(doc.provenanceStatus)) {
    errors.push(`provenanceStatus "${doc.provenanceStatus}" is not in valid enum set`);
  }
  return errors;
}

export function importLocalProviders(options = { dryRun: false }) {
  const db = getDb();
  const dataPath = path.join(__dirname, '../data/localProvidersChandigarhMohali.json');
  
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Data file not found at ${dataPath}`);
  }

  const dataset = options.data || JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  const meta = dataset.datasetMetadata || {};
  const targetDbName = path.basename(config.databasePath || 'cares.db');
  console.log(`[Import] Target Database: ${targetDbName}`);
  console.log(`[Import] Region: ${meta.region || 'Unknown'}, Version: ${meta.version || '1.1'}`);
  console.log(`[Import] Mode: ${options.dryRun ? 'DRY-RUN (verification only, zero DB writes)' : 'LIVE IMPORT (atomic transaction)'}`);

  const results = {
    facilitiesImported: 0,
    facilitiesSkipped: 0,
    facilitiesRejected: 0,
    doctorsImported: 0,
    doctorsSkipped: 0,
    doctorsRejected: 0,
    affiliationsCreated: 0,
    affiliationsSkipped: 0,
    rejections: [],
    dryRun: options.dryRun
  };

  const hospitalIdMap = new Map();

  // Validate and plan Facilities
  const facilities = dataset.facilities || [];
  const validFacilities = [];

  for (const fac of facilities) {
    const errors = validateFacilityRecord(fac);
    if (errors.length > 0) {
      console.warn(`  [REJECTED Facility] "${fac.name || 'Unknown'}": ${errors.join(', ')}`);
      results.facilitiesRejected++;
      results.rejections.push({ type: 'facility', name: fac.name, errors });
    } else {
      validFacilities.push(fac);
    }
  }

  // Validate and plan Doctors
  const doctors = dataset.doctors || [];
  const validDoctors = [];

  for (const doc of doctors) {
    const errors = validateDoctorRecord(doc);
    if (errors.length > 0) {
      console.warn(`  [REJECTED Doctor] "${doc.fullName || 'Unknown'}": ${errors.join(', ')}`);
      results.doctorsRejected++;
      results.rejections.push({ type: 'doctor', name: doc.fullName, errors });
    } else {
      validDoctors.push(doc);
    }
  }

  const executeImport = (database) => {
    // 1. Process Valid Facilities
    for (const fac of validFacilities) {
      const existing = database.prepare(
        'SELECT id, name, provenance_status, verification_status, is_verified, is_synthetic FROM hospitals WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))'
      ).get(fac.name);

      if (existing) {
        console.log(`  Existing facility found: "${existing.name}" (ID: ${existing.id}). Preserving admin decision & verification status (${existing.verification_status}).`);
        hospitalIdMap.set(fac.name, existing.id);
        results.facilitiesSkipped++;
      } else {
        if (!options.dryRun) {
          const stmt = database.prepare(`
            INSERT INTO hospitals (
              name, address, city, state, phone, emergency_available,
              website_url, operating_hours_json, affiliation_source,
              is_verified, verification_status, provenance_status, source_url, source_organization,
              last_checked_date, is_synthetic, departments_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `);
          const opHoursStr = typeof fac.operatingHours === 'object' ? JSON.stringify(fac.operatingHours) : (fac.operatingHours || null);
          const deptsJson = fac.departments ? JSON.stringify(fac.departments) : '[]';
          const isSynthetic = fac.isSynthetic !== undefined
            ? (fac.isSynthetic ? 1 : 0)
            : (fac.provenanceStatus === 'publicly_sourced' ? 0 : 1);
          const emergencyAvailable = fac.emergencyAvailable !== undefined && fac.emergencyAvailable !== null
            ? (fac.emergencyAvailable ? 1 : 0)
            : null;

          const info = stmt.run(
            fac.name.trim(),
            fac.address.trim(),
            fac.city.trim(),
            fac.state.trim(),
            fac.phone || null,
            emergencyAvailable,
            fac.websiteUrl || null,
            opHoursStr,
            fac.affiliationSource || fac.sourceOrganization || 'official_public_website',
            0, // is_verified = 0 by default for imported public facility
            fac.verificationStatus || 'unverified',
            fac.provenanceStatus || 'publicly_sourced',
            fac.sourceUrl || null,
            fac.sourceOrganization || null,
            fac.lastCheckedDate || null,
            isSynthetic,
            deptsJson
          );
          const newId = Number(info.lastInsertRowid);
          hospitalIdMap.set(fac.name, newId);
          console.log(`  Imported facility: "${fac.name}" -> ID: ${newId} (is_synthetic: ${isSynthetic})`);
        } else {
          hospitalIdMap.set(fac.name, 9999);
        }
        results.facilitiesImported++;
      }
    }

    // 2. Process Valid Doctors
    for (const doc of validDoctors) {
      // Find existing doctor either by non-null license number or by normalized name + specialty
      let existing = null;
      if (doc.licenseNumber && doc.licenseNumber.trim()) {
        existing = database.prepare(
          'SELECT id, full_name, is_verified, verification_status FROM doctor_profiles WHERE license_number = ?'
        ).get(doc.licenseNumber.trim());
      }
      if (!existing) {
        existing = database.prepare(
          'SELECT id, full_name, is_verified, verification_status FROM doctor_profiles WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(?)) AND specialty = ?'
        ).get(doc.fullName.trim(), doc.specialty.trim());
      }

      let doctorProfileId;

      if (existing) {
        console.log(`  Existing doctor found: "${existing.full_name}" (ID: ${existing.id}). Status: ${existing.verification_status}`);
        doctorProfileId = existing.id;
        results.doctorsSkipped++;
      } else {
        if (!options.dryRun) {
          // Provision an inactive placeholder user with non-working credentials
          const cleanName = doc.fullName.toLowerCase().replace(/[^a-z0-9]/g, '.');
          const directoryEmail = `${cleanName}.${Date.now().toString(36)}@directory.cares.org`;
          
          const userStmt = database.prepare(`
            INSERT INTO users (email, password_hash, role, status, created_at, updated_at)
            VALUES (?, 'DIRECTORY_IMPORT_NO_LOGIN_UNAUTHORIZED', 'doctor', 'pending_approval', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `);
          const userInfo = userStmt.run(directoryEmail);
          const userId = Number(userInfo.lastInsertRowid);

          const stmt = database.prepare(`
            INSERT INTO doctor_profiles (
              user_id, full_name, specialty, license_number, issuing_council,
              qualifications, experience_years, bio, consultation_fee,
              languages_json, visit_types_json, available_slots_json, insurance_accepted_json,
              is_accepting_new_patients, is_wheelchair_accessible, is_synthetic,
              is_verified, verification_status, registration_check_status,
              provenance_status, source_organization, source_url, last_checked_date,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `);
          const info = stmt.run(
            userId,
            doc.fullName.trim(),
            doc.specialty.trim(),
            doc.licenseNumber ? doc.licenseNumber.trim() : null,
            doc.issuingCouncil ? doc.issuingCouncil.trim() : null,
            doc.qualifications ? doc.qualifications.trim() : null,
            doc.experienceYears || 0,
            doc.bio || null,
            doc.consultationFee || 0,
            JSON.stringify(doc.languages || ["English", "Hindi"]),
            JSON.stringify(doc.visitTypes || ["In-person"]),
            JSON.stringify(doc.slots || []),
            JSON.stringify(doc.insuranceAccepted || []),
            doc.isAcceptingNewPatients ?? 1,
            doc.isWheelchairAccessible ?? 1,
            doc.isSynthetic ?? 0,
            0, // Must NOT automatically be verified
            doc.verificationStatus || 'unverified',
            doc.registrationCheckStatus || 'unchecked',
            doc.provenanceStatus || 'publicly_sourced',
            doc.sourceOrganization || null,
            doc.sourceUrl || null,
            doc.lastCheckedDate || null
          );
          doctorProfileId = Number(info.lastInsertRowid);
          console.log(`  Imported doctor: "${doc.fullName}" -> ID: ${doctorProfileId}`);
        } else {
          doctorProfileId = 9999;
        }
        results.doctorsImported++;
      }

      // 3. Process Doctor Affiliation
      if (doc.hospitalAffiliationName && hospitalIdMap.has(doc.hospitalAffiliationName)) {
        const realHospitalId = hospitalIdMap.get(doc.hospitalAffiliationName);
        if (!options.dryRun && doctorProfileId) {
          const affExists = database.prepare(
            'SELECT id FROM doctor_hospital_affiliations WHERE doctor_id = ? AND hospital_id = ?'
          ).get(doctorProfileId, realHospitalId);

          if (!affExists) {
            database.prepare(`
              INSERT INTO doctor_hospital_affiliations (
                doctor_id, hospital_id, role_at_facility, affiliation_source,
                last_checked_date, is_verified_affiliation, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(
              doctorProfileId,
              realHospitalId,
              doc.roleAtFacility || doc.specialty,
              doc.affiliationSource || doc.sourceOrganization || 'Official Hospital Faculty Directory',
              doc.lastCheckedDate || new Date().toISOString().slice(0, 10),
              0 // Affiliation unverified until hospital confirms
            );
            results.affiliationsCreated++;
            console.log(`    Affiliated "${doc.fullName}" to "${doc.hospitalAffiliationName}" (ID: ${realHospitalId})`);
          } else {
            results.affiliationsSkipped++;
          }
        } else if (options.dryRun) {
          results.affiliationsCreated++;
        }
      }
    }
  };

  // If live mode, wrap the whole batch in an atomic transaction
  if (!options.dryRun) {
    db.exec('BEGIN TRANSACTION;');
    try {
      executeImport(db);
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      console.error('[Import Error - Batch Rolled Back]:', err);
      throw err;
    }
  } else {
    executeImport(db);
  }

  return results;
}

if (process.argv[1] && process.argv[1].endsWith('importLocalProviders.js')) {
  const isDryRun = process.argv.includes('--dry-run');
  try {
    const summary = importLocalProviders({ dryRun: isDryRun });
    console.log('\n[Import Summary]');
    console.log(JSON.stringify(summary, null, 2));
  } catch (err) {
    console.error('[Import Fatal]:', err);
    process.exit(1);
  }
}
