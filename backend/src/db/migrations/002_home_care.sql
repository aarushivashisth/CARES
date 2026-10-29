-- Additive migration. Run only on explicitly selected, reviewed databases.
CREATE TABLE IF NOT EXISTS home_care_requests (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 patient_id INTEGER NOT NULL REFERENCES patient_profiles(id),
 service_type TEXT NOT NULL CHECK(service_type IN ('nursing','physiotherapy','elder_support')),
 requested_date TEXT NOT NULL,
 contact_phone TEXT NOT NULL,
 address TEXT NOT NULL,
 city TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','under_review','contacted','closed','declined','cancelled')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_home_care_patient ON home_care_requests(patient_id);
CREATE TABLE IF NOT EXISTS home_care_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 request_id INTEGER NOT NULL REFERENCES home_care_requests(id),
 status TEXT NOT NULL,
 changed_by_user_id INTEGER NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
