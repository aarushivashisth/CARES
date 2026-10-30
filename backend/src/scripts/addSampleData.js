import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';

const importAction = 'SAMPLE_DATA_IMPORT_V1';
export const sampleAccounts = [
  { key: 'admin', email: 'demo.admin@example.com', role: 'admin' },
  { key: 'patient', email: 'demo.patient@example.com', role: 'patient' },
  { key: 'maya', email: 'demo.maya@example.com', role: 'doctor' },
  { key: 'daniel', email: 'demo.daniel@example.com', role: 'doctor' },
  { key: 'sofia', email: 'demo.sofia@example.com', role: 'doctor', status: 'pending_approval' },
  { key: 'hospital', email: 'demo.hospital@example.com', role: 'hospital' },
];

// Additive, atomic PostgreSQL import. No existing account or provider is updated.
export async function addSampleData(client, passwords) {
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(10439872)');
    await client.query('LOCK TABLE users, patient_profiles, doctor_profiles, hospitals, doctor_hospital_affiliations, appointment_requests, appointment_status_history, verification_applications, audit_events, home_care_requests, home_care_history IN SHARE ROW EXCLUSIVE MODE');
    const previous = await client.query('SELECT id FROM audit_events WHERE action = $1 LIMIT 1', [importAction]);
    if (previous.rows.length) {
      await client.query('COMMIT');
      return { imported: false, reason: 'Sample dataset already imported; existing records preserved.' };
    }
    const collisions = await client.query('SELECT id FROM users WHERE LOWER(email) = ANY($1::text[])', [sampleAccounts.map(account => account.email)]);
    if (collisions.rows.length) throw new Error('A sample email already exists. Import refused without changing records.');
    const providerCollisions = await client.query('SELECT id FROM doctor_profiles WHERE license_number = ANY($1::text[])', [['DEMO-MAYA-001', 'DEMO-DANIEL-002', 'DEMO-SOFIA-003']]);
    const hospitalCollisions = await client.query('SELECT id FROM hospitals WHERE LOWER(TRIM(name)) = $1', ['riverside medical center (demo)']);
    if (providerCollisions.rows.length || hospitalCollisions.rows.length) throw new Error('A sample provider already exists. Import refused without changing records.');

    // Table and column names are code-owned constants. All values are bound.
    async function insert(table, record) {
      const columns = Object.keys(record);
      const result = await client.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`, Object.values(record));
      return result.rows[0].id;
    }
    const users = {};
    for (const account of sampleAccounts) {
      const password = passwords[account.key];
      if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 72) throw new Error('Each sample account needs a password between 12 and 72 bytes.');
      users[account.key] = await insert('users', {
        email: account.email, password_hash: await bcrypt.hash(password, 12),
        role: account.role, status: account.status || 'active',
      });
    }
    const patient = await insert('patient_profiles', {
      user_id: users.patient, full_name: 'Ananya Sharma (Demo)', phone: '555-0192',
      gender: 'Prefer not to say', city: 'Chandigarh', is_synthetic: 1,
    });
    const hospital = await insert('hospitals', {
      user_id: users.hospital, name: 'Riverside Medical Center (Demo)',
      address: 'Fictional Demo Campus, Sector 16', city: 'Chandigarh', state: 'Chandigarh',
      phone: '555-0100', email: 'demo.hospital@example.com',
      operating_hours_json: JSON.stringify({ regular: 'Demo schedule: Monday–Saturday, 09:00–17:00' }),
      emergency_available: null, is_verified: 0, verification_status: 'unverified',
      departments_json: JSON.stringify([{ name: 'Primary care' }, { name: 'Cardiology' }, { name: 'Family medicine' }]),
      is_synthetic: 1, provenance_status: 'synthetic_demo',
      source_organization: 'CARES fictional sample dataset; demonstration only',
    });
    const doctors = {};
    for (const doctor of [
      { key: 'maya', name: 'Dr. Maya Bennett (Demo)', specialty: 'Primary Care · Internal Medicine', license: 'DEMO-MAYA-001', fee: 500, slots: ['11:30 AM', '2:00 PM', '4:15 PM'] },
      { key: 'daniel', name: 'Dr. Daniel Park (Demo)', specialty: 'Cardiology · Heart Health', license: 'DEMO-DANIEL-002', fee: 750, slots: ['9:00 AM', '10:45 AM', '1:30 PM'] },
      { key: 'sofia', name: 'Dr. Sofia Rivera (Demo)', specialty: 'Primary Care · Family Medicine', license: 'DEMO-SOFIA-003', fee: 450, slots: ['10:00 AM', '12:15 PM', '3:30 PM'] },
    ]) {
      doctors[doctor.key] = await insert('doctor_profiles', {
        user_id: users[doctor.key], full_name: doctor.name, specialty: doctor.specialty,
        license_number: doctor.license, experience_years: 0,
        bio: 'Fictional sample clinician for testing CARES workflows. Fees and slots are illustrative; no real registration or care availability is claimed.',
        reviews_count: 0, consultation_fee: doctor.fee,
        languages_json: JSON.stringify(['English', 'Hindi']),
        visit_types_json: JSON.stringify(['In-person', 'Video consultation']),
        available_slots_json: JSON.stringify(doctor.slots),
        is_accepting_new_patients: doctor.key === 'sofia' ? 0 : 1,
        is_verified: 0, verification_status: doctor.key === 'sofia' ? 'pending' : 'unverified',
        registration_check_status: 'unchecked', is_synthetic: 1, provenance_status: 'synthetic_demo',
        source_organization: 'CARES fictional sample dataset; demonstration only',
        affiliation_source: 'Fictional demonstration affiliation',
      });
      await insert('doctor_hospital_affiliations', {
        doctor_id: doctors[doctor.key], hospital_id: hospital,
        role_at_facility: 'Demo clinician', distance_text: 'Demo location; distance not measured',
        affiliation_source: 'Fictional demonstration affiliation', is_verified_affiliation: 0, is_primary: 1,
      });
    }
    const futureDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const appointment = await insert('appointment_requests', {
      patient_id: patient, doctor_id: doctors.daniel, hospital_id: hospital,
      requested_date: futureDate, preferred_slot: '9:00 AM', visit_type: 'In-person',
      reason_for_visit: 'Fictional sample appointment for demonstrating request management.',
      status: 'pending', is_demo_request: 1,
    });
    await insert('appointment_status_history', {
      appointment_id: appointment, status: 'pending', changed_by_user_id: users.patient,
      notes: 'Synthetic sample request; no real appointment or patient.',
    });
    await insert('verification_applications', {
      user_id: users.sofia, target_type: 'doctor', target_id: doctors.sofia,
      submitted_license_number: 'DEMO-SOFIA-003', status: 'pending',
      affiliation_requested: 'Riverside Medical Center (Demo)',
      review_notes: 'Fictional application for demonstrating review. No real credentials supplied or verified.',
    });
    const homeCare = await insert('home_care_requests', {
      patient_id: patient, service_type: 'elder_support', requested_date: futureDate,
      contact_phone: '555-0192', address: 'Fictional sample home; demonstration only',
      city: 'Chandigarh', status: 'requested',
    });
    await insert('home_care_history', { request_id: homeCare, status: 'requested', changed_by_user_id: users.patient });
    await insert('audit_events', {
      actor_user_id: users.admin, action: importAction, target_type: 'DATABASE',
      details_json: JSON.stringify({ dataset: 'cares-sample-v1', synthetic: true, note: 'Owner-authorized additive sample import. No existing records changed.' }),
    });
    await client.query('COMMIT');
    return { imported: true, users: 6, patients: 1, doctors: 3, hospitals: 1, appointments: 1, homeCareEnquiries: 1, pendingApplications: 1 };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes('--confirm-sample-data') || !config.databaseUrl || config.nodeEnv === 'production') throw new Error('Requires --confirm-sample-data, an approved development PostgreSQL database, and non-production NODE_ENV.');
  const credentialsFile = new URL('../../.sample-accounts.json', import.meta.url);
  let accounts;
  if (fs.existsSync(credentialsFile)) accounts = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
  else {
    accounts = sampleAccounts.map(account => ({ ...account, password: `Demo!${randomBytes(18).toString('base64url')}7a` }));
    fs.writeFileSync(credentialsFile, JSON.stringify(accounts, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  // Do not reset passwords on retries or print credentials in logs.
  const passwords = Object.fromEntries(sampleAccounts.map(account => {
    const stored = accounts.find(entry => entry.key === account.key && entry.email === account.email);
    if (!stored?.password) throw new Error('Private sample credential file is incomplete. No account passwords changed.');
    return [account.key, stored.password];
  }));
  const { Client } = await import('pg');
  const client = new Client({ connectionString: config.databaseUrl, connectionTimeoutMillis: 5000, statement_timeout: 15000, query_timeout: 20000 });
  try {
    await client.connect();
    console.log(JSON.stringify(await addSampleData(client, passwords)));
    console.log('Demo account credentials are saved privately in backend/.sample-accounts.json.');
  } catch (error) {
    console.error(`Sample import failed (${error.code || 'VALIDATION'}). No existing records were replaced; inspect the database privately.`);
    process.exitCode = 1;
  } finally { await client.end(); }
}
