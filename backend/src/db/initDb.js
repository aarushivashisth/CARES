import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function applyMigrations() {
  try {
    const docCols = db.all("PRAGMA table_info(doctor_profiles)").map((c) => c.name);
    if (!docCols.includes('source_url')) db.exec("ALTER TABLE doctor_profiles ADD COLUMN source_url TEXT DEFAULT NULL;");
    if (!docCols.includes('source_organization')) db.exec("ALTER TABLE doctor_profiles ADD COLUMN source_organization TEXT DEFAULT NULL;");
    if (!docCols.includes('last_checked_date')) db.exec("ALTER TABLE doctor_profiles ADD COLUMN last_checked_date TEXT DEFAULT NULL;");
    if (!docCols.includes('provenance_status')) db.exec("ALTER TABLE doctor_profiles ADD COLUMN provenance_status TEXT DEFAULT 'synthetic_demo';");
    if (!docCols.includes('affiliation_source')) db.exec("ALTER TABLE doctor_profiles ADD COLUMN affiliation_source TEXT DEFAULT NULL;");
    if (!docCols.includes('issuing_council')) db.exec("ALTER TABLE doctor_profiles ADD COLUMN issuing_council TEXT DEFAULT NULL;");
    if (!docCols.includes('qualifications')) db.exec("ALTER TABLE doctor_profiles ADD COLUMN qualifications TEXT DEFAULT NULL;");
    if (!docCols.includes('verified_at')) db.exec("ALTER TABLE doctor_profiles ADD COLUMN verified_at TEXT DEFAULT NULL;");
    if (!docCols.includes('verified_by_user_id')) db.exec("ALTER TABLE doctor_profiles ADD COLUMN verified_by_user_id INTEGER DEFAULT NULL;");
    if (!docCols.includes('verification_notes')) db.exec("ALTER TABLE doctor_profiles ADD COLUMN verification_notes TEXT DEFAULT NULL;");
    if (!docCols.includes('registration_check_status')) db.exec("ALTER TABLE doctor_profiles ADD COLUMN registration_check_status TEXT DEFAULT 'unchecked';");

    const hospCols = db.all("PRAGMA table_info(hospitals)").map((c) => c.name);
    if (!hospCols.includes('source_url')) db.exec("ALTER TABLE hospitals ADD COLUMN source_url TEXT DEFAULT NULL;");
    if (!hospCols.includes('source_organization')) db.exec("ALTER TABLE hospitals ADD COLUMN source_organization TEXT DEFAULT NULL;");
    if (!hospCols.includes('last_checked_date')) db.exec("ALTER TABLE hospitals ADD COLUMN last_checked_date TEXT DEFAULT NULL;");
    if (!hospCols.includes('provenance_status')) db.exec("ALTER TABLE hospitals ADD COLUMN provenance_status TEXT DEFAULT 'synthetic_demo';");
    if (!hospCols.includes('website_url')) db.exec("ALTER TABLE hospitals ADD COLUMN website_url TEXT DEFAULT NULL;");
    if (!hospCols.includes('operating_hours_json')) db.exec("ALTER TABLE hospitals ADD COLUMN operating_hours_json TEXT DEFAULT '{}';");
    if (!hospCols.includes('affiliation_source')) db.exec("ALTER TABLE hospitals ADD COLUMN affiliation_source TEXT DEFAULT NULL;");

    const affCols = db.all("PRAGMA table_info(doctor_hospital_affiliations)").map((c) => c.name);
    if (!affCols.includes('affiliation_source')) db.exec("ALTER TABLE doctor_hospital_affiliations ADD COLUMN affiliation_source TEXT DEFAULT 'Administrative Affiliation';");
    if (!affCols.includes('last_checked_date')) db.exec("ALTER TABLE doctor_hospital_affiliations ADD COLUMN last_checked_date TEXT DEFAULT NULL;");
    if (!affCols.includes('is_verified_affiliation')) db.exec("ALTER TABLE doctor_hospital_affiliations ADD COLUMN is_verified_affiliation INTEGER DEFAULT 1;");

    const verCols = db.all("PRAGMA table_info(verification_applications)").map((c) => c.name);
    if (!verCols.includes('issuing_council')) db.exec("ALTER TABLE verification_applications ADD COLUMN issuing_council TEXT DEFAULT NULL;");
    if (!verCols.includes('qualifications')) db.exec("ALTER TABLE verification_applications ADD COLUMN qualifications TEXT DEFAULT NULL;");
    if (!verCols.includes('supporting_evidence_json')) db.exec("ALTER TABLE verification_applications ADD COLUMN supporting_evidence_json TEXT DEFAULT '[]';");
    if (!verCols.includes('affiliation_requested')) db.exec("ALTER TABLE verification_applications ADD COLUMN affiliation_requested TEXT DEFAULT NULL;");
    if (!verCols.includes('clarification_request')) db.exec("ALTER TABLE verification_applications ADD COLUMN clarification_request TEXT DEFAULT NULL;");
    if (!verCols.includes('clarification_response')) db.exec("ALTER TABLE verification_applications ADD COLUMN clarification_response TEXT DEFAULT NULL;");
    if (!verCols.includes('decision_reason')) db.exec("ALTER TABLE verification_applications ADD COLUMN decision_reason TEXT DEFAULT NULL;");

    const apptCols = db.all("PRAGMA table_info(appointment_requests)").map((c) => c.name);
    if (!apptCols.includes('requested_date')) db.exec("ALTER TABLE appointment_requests ADD COLUMN requested_date TEXT DEFAULT NULL;");

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_doctor_license_unique 
      ON doctor_profiles(license_number) 
      WHERE license_number IS NOT NULL AND TRIM(license_number) != '';

      CREATE UNIQUE INDEX IF NOT EXISTS idx_hospitals_name_unique
      ON hospitals(LOWER(TRIM(name)));
    `);

    // Safely check for conflicting legacy records before creating the unique index
    try {
      const duplicates = db.all(`
        SELECT doctor_id, requested_date, preferred_slot, COUNT(*) as conflict_count,
               GROUP_CONCAT(id) as appointment_ids
        FROM appointment_requests
        WHERE status IN ('accepted', 'confirmed')
        GROUP BY doctor_id, requested_date, preferred_slot
        HAVING COUNT(*) > 1
      `);

      if (duplicates && duplicates.length > 0) {
        console.warn('⚠️ [Migration Warning] Cannot create unique index idx_unique_accepted_slot: conflicting accepted/confirmed appointments detected on legacy data:');
        duplicates.forEach((d) => {
          console.warn(`   - Doctor #${d.doctor_id}, Date: ${d.requested_date}, Slot: ${d.preferred_slot}, Conflicting Appointment IDs: [${d.appointment_ids}]`);
        });
        console.warn('   Manual remediation required: Review and adjust conflicting appointment records to non-conflicting statuses before the index can be applied.');
      } else {
        db.exec(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_accepted_slot
          ON appointment_requests(doctor_id, requested_date, preferred_slot)
          WHERE status IN ('accepted', 'confirmed');
        `);
      }
    } catch (migErr) {
      console.warn(`⚠️ [Migration Notice] Could not create idx_unique_accepted_slot (${migErr.message}).`);
    }

    // Check if appointment_requests CHECK constraint allows 'pending' and 'accepted'
    const apptTableSqlRow = db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='appointment_requests'");
    if (apptTableSqlRow && apptTableSqlRow.sql && !apptTableSqlRow.sql.includes("'pending'")) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        DROP TABLE IF EXISTS appointment_requests_v2;
        CREATE TABLE appointment_requests_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_id INTEGER NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
          doctor_id INTEGER NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
          hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
          preferred_slot TEXT NOT NULL,
          requested_date TEXT,
          visit_type TEXT NOT NULL DEFAULT 'In-person' CHECK(visit_type IN ('In-person', 'Video consultation')),
          reason_for_visit TEXT,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'requested', 'accepted', 'confirmed', 'declined', 'cancelled', 'completed', 'rescheduled')),
          is_demo_request INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO appointment_requests_v2 (id, patient_id, doctor_id, hospital_id, preferred_slot, requested_date, visit_type, reason_for_visit, status, is_demo_request, created_at, updated_at)
        SELECT id, patient_id, doctor_id, hospital_id, preferred_slot, requested_date, visit_type, reason_for_visit, status, is_demo_request, created_at, updated_at FROM appointment_requests;
        DROP TABLE appointment_requests;
        ALTER TABLE appointment_requests_v2 RENAME TO appointment_requests;
        CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointment_requests(patient_id);
        CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointment_requests(doctor_id);
        CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointment_requests(status);
        PRAGMA foreign_keys = ON;
      `);
    }

    const historyTableSqlRow = db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='appointment_status_history'");
    if (historyTableSqlRow && historyTableSqlRow.sql && !historyTableSqlRow.sql.includes("'pending'")) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        DROP TABLE IF EXISTS appointment_status_history_v2;
        CREATE TABLE appointment_status_history_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          appointment_id INTEGER NOT NULL REFERENCES appointment_requests(id) ON DELETE CASCADE,
          status TEXT NOT NULL CHECK(status IN ('pending', 'requested', 'accepted', 'confirmed', 'declined', 'cancelled', 'completed', 'rescheduled')),
          notes TEXT,
          changed_by_user_id INTEGER NOT NULL REFERENCES users(id),
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO appointment_status_history_v2 (id, appointment_id, status, notes, changed_by_user_id, created_at)
        SELECT id, appointment_id, status, notes, changed_by_user_id, created_at FROM appointment_status_history;
        DROP TABLE appointment_status_history;
        ALTER TABLE appointment_status_history_v2 RENAME TO appointment_status_history;
        CREATE INDEX IF NOT EXISTS idx_history_appointment ON appointment_status_history(appointment_id);
        PRAGMA foreign_keys = ON;
      `);
    }

    // Check if doctor_profiles CHECK constraint allows 'needs_clarification'
    const docTableSqlRow = db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='doctor_profiles'");
    if (docTableSqlRow && docTableSqlRow.sql && !docTableSqlRow.sql.includes("'needs_clarification'")) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        DROP TABLE IF EXISTS doctor_profiles_v2;
        CREATE TABLE doctor_profiles_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          full_name TEXT NOT NULL,
          specialty TEXT NOT NULL,
          license_number TEXT,
          issuing_council TEXT DEFAULT NULL,
          qualifications TEXT DEFAULT NULL,
          experience_years INTEGER NOT NULL DEFAULT 0,
          bio TEXT,
          rating REAL NOT NULL DEFAULT 5.0,
          reviews_count INTEGER NOT NULL DEFAULT 0,
          consultation_fee REAL DEFAULT 0,
          languages_json TEXT NOT NULL DEFAULT '["English"]',
          visit_types_json TEXT NOT NULL DEFAULT '["In-person"]',
          available_slots_json TEXT NOT NULL DEFAULT '[]',
          insurance_accepted_json TEXT NOT NULL DEFAULT '[]',
          is_accepting_new_patients INTEGER NOT NULL DEFAULT 1,
          is_wheelchair_accessible INTEGER NOT NULL DEFAULT 1,
          is_verified INTEGER NOT NULL DEFAULT 0,
          verification_status TEXT NOT NULL DEFAULT 'not_submitted' CHECK(verification_status IN ('not_submitted', 'unverified', 'pending', 'needs_clarification', 'verified', 'rejected', 'suspended')),
          verified_at TEXT DEFAULT NULL,
          verified_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          verification_notes TEXT DEFAULT NULL,
          registration_check_status TEXT NOT NULL DEFAULT 'unchecked' CHECK(registration_check_status IN ('unchecked', 'checked', 'discrepancy_found')),
          is_synthetic INTEGER NOT NULL DEFAULT 1,
          source_url TEXT DEFAULT NULL,
          source_organization TEXT DEFAULT NULL,
          last_checked_date TEXT DEFAULT NULL,
          provenance_status TEXT NOT NULL DEFAULT 'synthetic_demo' CHECK(provenance_status IN ('synthetic_demo', 'publicly_sourced', 'registration_checked', 'cares_verified', 'curated_local', 'verified_registry', 'facility_website')),
          affiliation_source TEXT DEFAULT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO doctor_profiles_v2 (
          id, user_id, full_name, specialty, license_number, issuing_council, qualifications,
          experience_years, bio, rating, reviews_count, consultation_fee, languages_json,
          visit_types_json, available_slots_json, insurance_accepted_json, is_accepting_new_patients,
          is_wheelchair_accessible, is_verified, verification_status, verified_at, verified_by_user_id,
          verification_notes, registration_check_status, is_synthetic, source_url, source_organization,
          last_checked_date, provenance_status, affiliation_source, created_at, updated_at
        )
        SELECT 
          id, user_id, full_name, specialty, license_number, issuing_council, qualifications,
          experience_years, bio, rating, reviews_count, consultation_fee, languages_json,
          visit_types_json, available_slots_json, insurance_accepted_json, is_accepting_new_patients,
          is_wheelchair_accessible, is_verified, verification_status, verified_at, verified_by_user_id,
          verification_notes, registration_check_status, is_synthetic, source_url, source_organization,
          last_checked_date, provenance_status, affiliation_source, created_at, updated_at
        FROM doctor_profiles;
        DROP TABLE doctor_profiles;
        ALTER TABLE doctor_profiles_v2 RENAME TO doctor_profiles;
        CREATE INDEX IF NOT EXISTS idx_doctor_user ON doctor_profiles(user_id);
        CREATE INDEX IF NOT EXISTS idx_doctor_specialty ON doctor_profiles(specialty);
        PRAGMA foreign_keys = ON;
      `);
    }

    // Check if verification_applications CHECK constraint allows 'needs_clarification'
    const verTableSqlRow = db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='verification_applications'");
    if (verTableSqlRow && verTableSqlRow.sql && !verTableSqlRow.sql.includes("'needs_clarification'")) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        DROP TABLE IF EXISTS verification_applications_v2;
        CREATE TABLE verification_applications_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          target_type TEXT NOT NULL CHECK(target_type IN ('doctor', 'hospital')),
          target_id INTEGER NOT NULL,
          submitted_license_number TEXT,
          issuing_council TEXT DEFAULT NULL,
          qualifications TEXT DEFAULT NULL,
          supporting_evidence_json TEXT NOT NULL DEFAULT '[]',
          affiliation_requested TEXT DEFAULT NULL,
          clarification_request TEXT DEFAULT NULL,
          clarification_response TEXT DEFAULT NULL,
          decision_reason TEXT DEFAULT NULL,
          review_notes TEXT,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'needs_clarification', 'suspended', 'more_info_needed')),
          reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          reviewed_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO verification_applications_v2 (
          id, user_id, target_type, target_id, submitted_license_number, issuing_council,
          qualifications, supporting_evidence_json, affiliation_requested, clarification_request,
          clarification_response, decision_reason, review_notes, status, reviewed_by_user_id,
          reviewed_at, created_at, updated_at
        )
        SELECT 
          id, user_id, target_type, target_id, submitted_license_number, issuing_council,
          qualifications, supporting_evidence_json, affiliation_requested, clarification_request,
          clarification_response, decision_reason, review_notes, status, reviewed_by_user_id,
          reviewed_at, created_at, updated_at
        FROM verification_applications;
        DROP TABLE verification_applications;
        ALTER TABLE verification_applications_v2 RENAME TO verification_applications;
        CREATE INDEX IF NOT EXISTS idx_verifications_status ON verification_applications(status);
        PRAGMA foreign_keys = ON;
      `);
    }

    const hospTableSqlRow = db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='hospitals'");
    if (hospTableSqlRow && hospTableSqlRow.sql && hospTableSqlRow.sql.includes("emergency_available INTEGER NOT NULL DEFAULT 1")) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        DROP TABLE IF EXISTS hospitals_v2;
        CREATE TABLE hospitals_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          address TEXT NOT NULL,
          city TEXT NOT NULL,
          state TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          website_url TEXT DEFAULT NULL,
          operating_hours_json TEXT NOT NULL DEFAULT '{}',
          crowd_level TEXT NOT NULL DEFAULT 'moderate' CHECK(crowd_level IN ('low', 'moderate', 'high', 'critical')),
          emergency_available INTEGER DEFAULT NULL,
          is_verified INTEGER NOT NULL DEFAULT 0,
          verification_status TEXT NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
          departments_json TEXT NOT NULL DEFAULT '[]',
          is_synthetic INTEGER NOT NULL DEFAULT 0,
          source_url TEXT DEFAULT NULL,
          source_organization TEXT DEFAULT NULL,
          last_checked_date TEXT DEFAULT NULL,
          provenance_status TEXT NOT NULL DEFAULT 'synthetic_demo' CHECK(provenance_status IN ('synthetic_demo', 'publicly_sourced', 'registration_checked', 'cares_verified', 'curated_local', 'verified_registry', 'facility_website')),
          affiliation_source TEXT DEFAULT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO hospitals_v2 (
          id, user_id, name, address, city, state, phone, email, website_url,
          operating_hours_json, crowd_level, emergency_available, is_verified,
          verification_status, departments_json, is_synthetic, source_url,
          source_organization, last_checked_date, provenance_status, affiliation_source,
          created_at, updated_at
        )
        SELECT 
          id, user_id, name, address, city, state, phone, email, website_url,
          operating_hours_json, crowd_level, emergency_available, is_verified,
          verification_status, departments_json, is_synthetic, source_url,
          source_organization, last_checked_date, provenance_status, affiliation_source,
          created_at, updated_at
        FROM hospitals;
        DROP TABLE hospitals;
        ALTER TABLE hospitals_v2 RENAME TO hospitals;
        CREATE INDEX IF NOT EXISTS idx_hospitals_city ON hospitals(city);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_hospitals_name_unique ON hospitals(LOWER(TRIM(name)));
        PRAGMA foreign_keys = ON;
      `);
    }
  } catch (err) {
    console.warn('Migration step warning:', err.message);
  }
}

export function initDatabase() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  console.log('🔄 Initializing database schema...');
  db.exec(schemaSql);
  applyMigrations();
  db.exec(fs.readFileSync(path.resolve(__dirname, 'migrations/002_home_care.sql'), 'utf-8'));
  console.log('✅ Database schema and migrations applied successfully.');
}

// Allow standalone execution via `npm run db:init`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    initDatabase();
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
  }
}
