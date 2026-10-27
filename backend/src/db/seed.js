import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { db } from './connection.js';
import { initDatabase } from './initDb.js';

export async function seedDatabase() {
  console.log('🌱 Starting database seeding with synthetic demonstration data...');

  // Ensure tables exist
  initDatabase();

  const saltRounds = 10;
  const adminPasswordHash = await bcrypt.hash('Admin@12345', saltRounds);
  const patientPasswordHash = await bcrypt.hash('Patient@12345', saltRounds);
  const doctorPasswordHash = await bcrypt.hash('Doctor@12345', saltRounds);
  const hospitalPasswordHash = await bcrypt.hash('Hospital@12345', saltRounds);

  db.transaction((tx) => {
    // 1. Clear existing seed data safely
    tx.exec(`
      DELETE FROM audit_events;
      DELETE FROM verification_applications;
      DELETE FROM appointment_status_history;
      DELETE FROM appointment_requests;
      DELETE FROM doctor_hospital_affiliations;
      DELETE FROM hospitals;
      DELETE FROM doctor_profiles;
      DELETE FROM patient_profiles;
      DELETE FROM users;
      DELETE FROM sqlite_sequence;
    `);

    // 2. Insert Users
    // Admin
    const adminUser = tx.run(
      `INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, 'admin', 'active')`,
      ['admin@cares.org', adminPasswordHash]
    );

    // Patient
    const patientUser = tx.run(
      `INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, 'patient', 'active')`,
      ['patient@cares.org', patientPasswordHash]
    );

    // Doctors
    const doctorUser1 = tx.run(
      `INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, 'doctor', 'active')`,
      ['dr.maya@cares.org', doctorPasswordHash]
    );
    const doctorUser2 = tx.run(
      `INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, 'doctor', 'active')`,
      ['dr.daniel@cares.org', doctorPasswordHash]
    );
    const doctorUser3 = tx.run(
      `INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, 'doctor', 'active')`,
      ['dr.sofia@cares.org', doctorPasswordHash]
    );

    // Hospital Facility Admin
    const hospitalUser = tx.run(
      `INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, 'hospital', 'active')`,
      ['hospital@riverside.org', hospitalPasswordHash]
    );

    // 3. Insert Patient Profile
    const patientProfile = tx.run(
      `INSERT INTO patient_profiles (user_id, full_name, phone, date_of_birth, gender, emergency_contact, city, is_synthetic)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        patientUser.lastInsertRowid,
        'Ananya Sharma',
        '555-0192',
        '1992-05-14',
        'Female',
        'Vikram Sharma (555-0193)',
        'Chandigarh'
      ]
    );

    // 4. Insert Doctor Profiles (Mirroring Phase 1 doctor data for continuity)
    const doc1 = tx.run(
      `INSERT INTO doctor_profiles (
        user_id, full_name, specialty, license_number, issuing_council, qualifications, experience_years, bio, rating, reviews_count,
        consultation_fee, languages_json, visit_types_json, available_slots_json, insurance_accepted_json,
        is_accepting_new_patients, is_wheelchair_accessible, is_verified, verification_status, verified_at,
        registration_check_status, is_synthetic, source_url, source_organization, last_checked_date, provenance_status, affiliation_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'verified', datetime('now'), 'checked', 1, ?, ?, ?, 'synthetic_demo', ?)`,
      [
        doctorUser1.lastInsertRowid,
        'Dr. Maya Bennett',
        'Primary Care · Internal Medicine',
        'MED-PB-2014-0891',
        'Punjab Medical Council (PMC)',
        'MBBS, MD (Internal Medicine)',
        12,
        'Dedicated to evidence-based primary care and preventive medicine with over a decade of community experience.',
        4.9,
        128,
        500,
        JSON.stringify(['English', 'Spanish']),
        JSON.stringify(['In-person', 'Video consultation']),
        JSON.stringify(['11:30 AM', '2:00 PM', '4:15 PM']),
        JSON.stringify(['Blue Cross Blue Shield']),
        1,
        1,
        'https://cares.demo/academic-prototype',
        'CARES Academic Prototype Dataset',
        '2026-10-27',
        'Riverside Medical Center Affiliation Registry'
      ]
    );

    const doc2 = tx.run(
      `INSERT INTO doctor_profiles (
        user_id, full_name, specialty, license_number, issuing_council, qualifications, experience_years, bio, rating, reviews_count,
        consultation_fee, languages_json, visit_types_json, available_slots_json, insurance_accepted_json,
        is_accepting_new_patients, is_wheelchair_accessible, is_verified, verification_status, verified_at,
        registration_check_status, is_synthetic, source_url, source_organization, last_checked_date, provenance_status, affiliation_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'verified', datetime('now'), 'checked', 1, ?, ?, ?, 'synthetic_demo', ?)`,
      [
        doctorUser2.lastInsertRowid,
        'Dr. Daniel Park',
        'Cardiology · Heart Health',
        'MED-PB-2010-0442',
        'Punjab Medical Council (PMC)',
        'MBBS, DM (Cardiology)',
        16,
        'Specializing in comprehensive preventive cardiology, hypertension management, and non-invasive cardiovascular health.',
        4.9,
        96,
        750,
        JSON.stringify(['English', 'Korean']),
        JSON.stringify(['In-person', 'Video consultation']),
        JSON.stringify(['9:00 AM', '10:45 AM', '1:30 PM']),
        JSON.stringify(['Other insurance']),
        1,
        1,
        'https://cares.demo/academic-prototype',
        'CARES Academic Prototype Dataset',
        '2026-10-27',
        'Riverside Medical Center Cardiology Directory'
      ]
    );

    const doc3 = tx.run(
      `INSERT INTO doctor_profiles (
        user_id, full_name, specialty, license_number, issuing_council, qualifications, experience_years, bio, rating, reviews_count,
        consultation_fee, languages_json, visit_types_json, available_slots_json, insurance_accepted_json,
        is_accepting_new_patients, is_wheelchair_accessible, is_verified, verification_status, verified_at,
        registration_check_status, is_synthetic, source_url, source_organization, last_checked_date, provenance_status, affiliation_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', NULL, 'unchecked', 1, ?, ?, ?, 'synthetic_demo', ?)`,
      [
        doctorUser3.lastInsertRowid,
        'Dr. Sofia Rivera',
        'Primary Care · Family Medicine',
        'MED-PB-2017-0923',
        'Delhi Medical Council (DMC)',
        'MBBS, DNB (Family Medicine)',
        9,
        'Focused on family-centered healthcare, routine wellness exams, and chronic care management across all age groups.',
        4.8,
        112,
        450,
        JSON.stringify(['English', 'Spanish']),
        JSON.stringify(['In-person']),
        JSON.stringify(['10:00 AM', '12:15 PM', '3:30 PM']),
        JSON.stringify(['Blue Cross Blue Shield', 'Other insurance']),
        1,
        0,
        'https://cares.demo/academic-prototype',
        'CARES Academic Prototype Dataset',
        '2026-10-27',
        'Riverside Medical Center Family Medicine Directory'
      ]
    );

    // 5. Insert Hospital
    const hospital = tx.run(
      `INSERT INTO hospitals (
        user_id, name, address, city, state, phone, email, website_url, operating_hours_json, crowd_level, emergency_available,
        is_verified, verification_status, departments_json, is_synthetic,
        source_url, source_organization, last_checked_date, provenance_status, affiliation_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', ?, 1, ?, ?, ?, 'synthetic_demo', ?)`,
      [
        hospitalUser.lastInsertRowid,
        'Riverside Medical Center',
        'Sector 16-B, Healthcare Corridor',
        'Chandigarh',
        'Punjab / Chandigarh UT',
        '555-0100',
        'info@riversidemedical.org',
        'https://riverside.cares.demo',
        JSON.stringify({
          regular: '08:00 - 20:00',
          emergency: '24/7 Everyday',
          opd_hours: 'Monday – Saturday, 09:00 – 16:00'
        }),
        'low',
        1,
        1,
        JSON.stringify([
          { name: 'Primary care', crowd: 'Low crowd', wait: '15–25 min', width: '28%', level: 'low' },
          { name: 'Orthopedics', crowd: 'Moderate', wait: '30–45 min', width: '56%', level: 'moderate' },
          { name: 'Cardiology', crowd: 'Low crowd', wait: '20–30 min', width: '36%', level: 'low' }
        ]),
        'https://cares.demo/academic-prototype',
        'CARES Academic Prototype Dataset',
        '2026-10-27',
        'Official Riverside Hospital Administration'
      ]
    );

    // 6. Affiliations
    tx.run(
      `INSERT INTO doctor_hospital_affiliations (doctor_id, hospital_id, role_at_facility, distance_text, affiliation_source, last_checked_date, is_primary)
       VALUES (?, ?, 'Attending Internist', '1.8 miles away', 'Riverside Medical Center Credentialing', '2026-10-27', 1)`,
      [doc1.lastInsertRowid, hospital.lastInsertRowid]
    );
    tx.run(
      `INSERT INTO doctor_hospital_affiliations (doctor_id, hospital_id, role_at_facility, distance_text, affiliation_source, last_checked_date, is_primary)
       VALUES (?, ?, 'Senior Cardiologist', '1.8 miles away', 'Riverside Medical Center Credentialing', '2026-10-27', 1)`,
      [doc2.lastInsertRowid, hospital.lastInsertRowid]
    );
    tx.run(
      `INSERT INTO doctor_hospital_affiliations (doctor_id, hospital_id, role_at_facility, distance_text, affiliation_source, last_checked_date, is_primary)
       VALUES (?, ?, 'Family Physician', '2.1 miles away', 'Riverside Medical Center Credentialing', '2026-10-27', 1)`,
      [doc3.lastInsertRowid, hospital.lastInsertRowid]
    );

    // 7. Sample Demonstration Appointment Request
    const appt = tx.run(
      `INSERT INTO appointment_requests (
        patient_id, doctor_id, hospital_id, preferred_slot, visit_type, reason_for_visit, status, is_demo_request
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 1)`,
      [
        patientProfile.lastInsertRowid,
        doc2.lastInsertRowid,
        hospital.lastInsertRowid,
        '9:00 AM',
        'In-person',
        'Cardiovascular health evaluation & blood pressure check'
      ]
    );

    tx.run(
      `INSERT INTO appointment_status_history (appointment_id, status, notes, changed_by_user_id)
       VALUES (?, 'pending', 'Appointment requested via CARES patient portal (illustrative demo)', ?)`,
      [appt.lastInsertRowid, patientUser.lastInsertRowid]
    );

    // 8. Sample Verification Applications
    // Dr. Daniel Park (Approved)
    tx.run(
      `INSERT INTO verification_applications (
        user_id, target_type, target_id, submitted_license_number, issuing_council, qualifications,
        supporting_evidence_json, affiliation_requested, review_notes, status, reviewed_by_user_id, reviewed_at
      ) VALUES (?, 'doctor', ?, ?, ?, ?, ?, ?, 'Credentials verified against state medical registry.', 'approved', ?, datetime('now'))`,
      [
        doctorUser2.lastInsertRowid,
        doc2.lastInsertRowid,
        'MED-PB-2010-0442',
        'Punjab Medical Council (PMC)',
        'MBBS, DM (Cardiology)',
        JSON.stringify([
          { title: 'State Medical Council Certificate', document_type: 'Registration Certificate', certificate_number: 'PMC-2010-0442', issue_date: '2010-05-18' }
        ]),
        'Riverside Medical Center',
        adminUser.lastInsertRowid
      ]
    );

    // Dr. Sofia Rivera (Pending Review with Supporting Evidence Metadata)
    tx.run(
      `INSERT INTO verification_applications (
        user_id, target_type, target_id, submitted_license_number, issuing_council, qualifications,
        supporting_evidence_json, affiliation_requested, review_notes, status
      ) VALUES (?, 'doctor', ?, ?, ?, ?, ?, ?, 'Awaiting administrative verification check.', 'pending')`,
      [
        doctorUser3.lastInsertRowid,
        doc3.lastInsertRowid,
        'MED-PB-2017-0923',
        'Delhi Medical Council (DMC)',
        'MBBS, DNB (Family Medicine)',
        JSON.stringify([
          { title: 'Medical Council Registration Certificate', document_type: 'Registration Certificate', certificate_number: 'DMC-2017-0923', issue_date: '2017-08-14' },
          { title: 'Postgraduate Degree Diploma', document_type: 'Degree Certificate', certificate_number: 'DNB-FM-2020-112', issue_date: '2020-06-30' }
        ]),
        'Riverside Medical Center'
      ]
    );

    // 9. Initial Audit Log
    tx.run(
      `INSERT INTO audit_events (actor_user_id, action, target_type, target_id, details_json, ip_address)
       VALUES (?, 'SYSTEM_SEED', 'DATABASE', 1, ?, '127.0.0.1')`,
      [
        adminUser.lastInsertRowid,
        JSON.stringify({ note: 'Milestone 1 synthetic relational foundation seeded successfully' })
      ]
    );
  });

  console.log('✅ Synthetic seed data inserted successfully:');
  console.log('   👤 Admin:    admin@cares.org       / Admin@12345');
  console.log('   👤 Patient:  patient@cares.org     / Patient@12345');
  console.log('   🩺 Doctor:   dr.daniel@cares.org   / Doctor@12345');
  console.log('   🏥 Hospital: hospital@riverside.org / Hospital@12345');
}

// Allow standalone execution via `npm run db:seed`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await seedDatabase();
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to seed database:', err);
    process.exit(1);
  }
}
