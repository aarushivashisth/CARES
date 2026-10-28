-- ====================================================================
-- CARES Healthcare Navigation Platform - Relational Database Schema
-- Milestone 1 Foundation
-- ====================================================================

-- 1. Users & Roles Table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('patient', 'doctor', 'hospital', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'pending_approval', 'suspended', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. Patient Profiles Table
CREATE TABLE IF NOT EXISTS patient_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  date_of_birth TEXT,
  gender TEXT CHECK(gender IN ('Female', 'Male', 'Non-binary', 'Prefer not to say')),
  emergency_contact TEXT,
  city TEXT DEFAULT 'Chandigarh',
  is_synthetic INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_patient_user ON patient_profiles(user_id);

-- 3. Doctor / Healthcare Provider Profiles Table
CREATE TABLE IF NOT EXISTS doctor_profiles (
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

CREATE INDEX IF NOT EXISTS idx_doctor_user ON doctor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_doctor_specialty ON doctor_profiles(specialty);
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctor_license_unique ON doctor_profiles(license_number) WHERE license_number IS NOT NULL AND TRIM(license_number) != '';

-- 4. Hospitals & Clinics Table
CREATE TABLE IF NOT EXISTS hospitals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  website_url TEXT DEFAULT NULL,
  operating_hours_json TEXT NOT NULL DEFAULT '{"regular":"08:00 - 20:00","emergency":"24/7"}',
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

CREATE INDEX IF NOT EXISTS idx_hospitals_city ON hospitals(city);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hospitals_name_unique ON hospitals(LOWER(TRIM(name)));

-- 4b. Doctor-Hospital Affiliations (Many-to-Many)
CREATE TABLE IF NOT EXISTS doctor_hospital_affiliations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doctor_id INTEGER NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  role_at_facility TEXT DEFAULT 'Consultant Physician',
  distance_text TEXT DEFAULT '1.8 miles away',
  affiliation_source TEXT DEFAULT 'Administrative Affiliation',
  last_checked_date TEXT DEFAULT NULL,
  is_verified_affiliation INTEGER NOT NULL DEFAULT 1,
  is_primary INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(doctor_id, hospital_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliations_doctor ON doctor_hospital_affiliations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_affiliations_hospital ON doctor_hospital_affiliations(hospital_id);

-- 5. Appointment Requests Table
CREATE TABLE IF NOT EXISTS appointment_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
  requested_date TEXT DEFAULT (date('now')),
  preferred_slot TEXT NOT NULL,
  visit_type TEXT DEFAULT 'In-person',
  reason_for_visit TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'requested', 'accepted', 'confirmed', 'declined', 'cancelled', 'completed', 'rescheduled')),
  is_demo_request INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointment_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointment_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointment_requests(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_accepted_slot ON appointment_requests(doctor_id, requested_date, preferred_slot) WHERE status IN ('accepted', 'confirmed');

-- 5b. Appointment Status History Table (Audit trail of state transitions)
CREATE TABLE IF NOT EXISTS appointment_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER NOT NULL REFERENCES appointment_requests(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  notes TEXT,
  changed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_app_history ON appointment_status_history(appointment_id);

-- 6. Provider & Facility Verification Applications Table
CREATE TABLE IF NOT EXISTS verification_applications (
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

CREATE INDEX IF NOT EXISTS idx_verifications_status ON verification_applications(status);

-- 7. Audit Events Table (Administrative and Security log)
CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER,
  details_json TEXT DEFAULT '{}',
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at);
