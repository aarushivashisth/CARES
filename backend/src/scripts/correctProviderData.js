import { db } from '../db/connection.js';
import { fileURLToPath } from 'node:url';

export function correctProviderData() {
  console.log('--- Commencing Safe Data Integrity and Provenance Corrections ---');

  const result = {
    doctorsUpdated: [],
    hospitalsUpdated: [],
    indexesCreated: [],
  };

  db.transaction((tx) => {
    // 1. Correct Publicly Sourced Doctors
    const publicDoctorNames = [
      'Prof. (Dr.) Sanjay Jain',
      'Prof. (Dr.) Rajesh Vijayvergiya',
      'Dr. Monica Gupta',
      'Dr. R. K. Jaswal'
    ];

    for (const name of publicDoctorNames) {
      const doc = tx.get(
        'SELECT id, full_name, is_verified, verification_status, license_number, provenance_status FROM doctor_profiles WHERE full_name = ?',
        [name]
      );

      if (doc) {
        tx.run(
          `UPDATE doctor_profiles 
           SET is_verified = 0,
               verification_status = 'unverified',
               registration_check_status = 'unchecked',
               license_number = NULL,
               issuing_council = NULL,
               provenance_status = 'publicly_sourced',
               updated_at = datetime('now')
           WHERE id = ?`,
          [doc.id]
        );

        result.doctorsUpdated.push({
          id: doc.id,
          name: doc.full_name,
          previous: {
            is_verified: doc.is_verified,
            verification_status: doc.verification_status,
            license_number: doc.license_number,
          },
          current: {
            is_verified: 0,
            verification_status: 'unverified',
            registration_check_status: 'unchecked',
            license_number: null,
            provenance_status: 'publicly_sourced'
          }
        });
        console.log(`  ✅ Corrected clinician: "${doc.full_name}" (ID: ${doc.id}) -> unverified, registration unchecked, null license.`);
      }
    }

    // 2. Correct Publicly Sourced Facilities
    const publicFacilityNames = [
      'Postgraduate Institute of Medical Education & Research (PGIMER)',
      'Government Medical College & Hospital (GMCH 32)',
      'Fortis Hospital Mohali'
    ];

    for (const facName of publicFacilityNames) {
      const fac = tx.get(
        'SELECT id, name, is_verified, verification_status, provenance_status FROM hospitals WHERE name = ?',
        [facName]
      );

      if (fac) {
        tx.run(
          `UPDATE hospitals
           SET is_verified = 0,
               verification_status = 'unverified',
               provenance_status = 'publicly_sourced',
               source_organization = COALESCE(source_organization, name),
               updated_at = datetime('now')
           WHERE id = ?`,
          [fac.id]
        );

        result.hospitalsUpdated.push({
          id: fac.id,
          name: fac.name,
          previous: {
            is_verified: fac.is_verified,
            verification_status: fac.verification_status,
            provenance_status: fac.provenance_status
          },
          current: {
            is_verified: 0,
            verification_status: 'unverified',
            provenance_status: 'publicly_sourced'
          }
        });
        console.log(`  ✅ Corrected facility: "${fac.name}" (ID: ${fac.id}) -> unverified, publicly_sourced.`);
      }
    }

    // 3. Add Safe Uniqueness Constraints (Partial Unique Indexes)
    tx.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_doctor_license_unique 
      ON doctor_profiles(license_number) 
      WHERE license_number IS NOT NULL AND TRIM(license_number) != '';

      CREATE UNIQUE INDEX IF NOT EXISTS idx_hospitals_name_unique 
      ON hospitals(LOWER(TRIM(name)));
    `);
    result.indexesCreated.push('idx_doctor_license_unique', 'idx_hospitals_name_unique');
    console.log('  ✅ Created unique indexes: idx_doctor_license_unique and idx_hospitals_name_unique.');

    // 4. Record Audit Event
    tx.run(
      `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, details_json, ip_address)
       VALUES (NULL, 'DATA_INTEGRITY_PROVENANCE_CORRECTION', 'SYSTEM', 0, ?, '127.0.0.1')`,
      [
        JSON.stringify({
          milestone: '3.1',
          doctorsCorrected: result.doctorsUpdated.map(d => d.name),
          hospitalsCorrected: result.hospitalsUpdated.map(h => h.name),
          timestamp: new Date().toISOString()
        })
      ]
    );
  });

  console.log('\n--- Data Integrity Corrections Successfully Applied ---');
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const res = correctProviderData();
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('❌ Data correction failed:', err);
    process.exit(1);
  }
}
