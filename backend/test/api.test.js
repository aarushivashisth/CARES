import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set test environment and isolated test database BEFORE loading app or database connection
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = process.env.TEST_DATABASE_PATH || './data/cares.test.db';

const { default: app } = await import('../src/app.js');
const { seedDatabase } = await import('../src/db/seed.js');
const { db } = await import('../src/db/connection.js');
const { importLocalProviders, validateFacilityRecord, validateDoctorRecord } = await import('../src/scripts/importLocalProviders.js');
const { validateJwtSecret, validateConfig, buildConfig, DEVELOPMENT_JWT_SECRET, isLiveDatabase, resolveDatabasePath } = await import('../src/config/env.js');
const { createAuthRateLimiter } = await import('../src/middleware/rateLimitMiddleware.js');

let server;
let baseUrl;

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

before(async () => {
  const { config } = await import('../src/config/env.js');
  const normalizedPath = config.databasePath.replace(/\\/g, '/');
  assert.ok(
    !normalizedPath.endsWith('/cares.db'),
    `CRITICAL SAFETY VIOLATION: Test suite attempted to run against live database (${config.databasePath})! Aborting.`
  );
  console.log(`🔒 [Test Suite Isolation] Test runner active on isolated database: ${config.databasePath}`);

  await seedDatabase();
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(() => {
  if (server) server.close();
  db.close();
});


test('GET /api/health returns 200 OK and service metadata', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.status, 'ok');
  assert.equal(data.service, 'CARES Healthcare Navigation REST API');
  assert.equal(data.database, 'connected');
});

test('POST /api/auth/login succeeds for valid admin credentials', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@cares.org',
      password: 'Admin@12345'
    })
  });
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.user.role, 'admin');
  assert.ok(data.token, 'Token must be returned');
});

test('POST /api/auth/login succeeds for valid doctor credentials', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'dr.daniel@cares.org',
      password: 'Doctor@12345'
    })
  });
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.user.role, 'doctor');
  assert.equal(data.user.profile.full_name, 'Dr. Daniel Park');
});

test('POST /api/auth/login rejects incorrect password with 401', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@cares.org',
      password: 'WrongPassword'
    })
  });
  const data = await res.json();

  assert.equal(res.status, 401);
  assert.equal(data.success, false);
  assert.equal(data.code, 'INVALID_CREDENTIALS');
});

test('POST /api/auth/register registers new patient and returns token', async () => {
  const randomEmail = `testpatient_${Date.now()}@example.com`;
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: randomEmail,
      password: 'Password123!',
      full_name: 'Test Patient User',
      phone: '555-9988'
    })
  });
  const data = await res.json();

  assert.equal(res.status, 201);
  assert.equal(data.success, true);
  assert.equal(data.user.role, 'patient');
  assert.equal(data.user.email, randomEmail);
  assert.ok(data.token);
});

test('Role-based access control: Patient accessing Admin dashboard returns 403 Forbidden', async () => {
  // Login as patient
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'patient@cares.org',
      password: 'Patient@12345'
    })
  });
  const loginData = await loginRes.json();
  const patientToken = loginData.token;

  // Try to access admin dashboard
  const adminRes = await fetch(`${baseUrl}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${patientToken}` }
  });
  const adminData = await adminRes.json();

  assert.equal(adminRes.status, 403);
  assert.equal(adminData.code, 'FORBIDDEN_ROLE');
});

test('Role-based access control: Admin accessing Admin dashboard returns 200 OK', async () => {
  // Login as admin
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@cares.org',
      password: 'Admin@12345'
    })
  });
  const loginData = await loginRes.json();
  const adminToken = loginData.token;

  const adminRes = await fetch(`${baseUrl}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const adminData = await adminRes.json();

  assert.equal(adminRes.status, 200);
  assert.equal(adminData.success, true);
  assert.ok(adminData.data.metrics);
});

test('GET /api/nonexistent returns 404 with structured error', async () => {
  const res = await fetch(`${baseUrl}/api/nonexistent-endpoint`);
  const data = await res.json();

  assert.equal(res.status, 404);
  assert.equal(data.code, 'ROUTE_NOT_FOUND');
});

/* ====================================================================
   Milestone 2: Database-Backed Doctor Search & Appointment Tests
   ==================================================================== */

test('GET /api/doctors returns database-backed provider directory with provenance', async () => {
  const res = await fetch(`${baseUrl}/api/doctors`);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.data), 'data must be an array');
  assert.ok(data.count >= 3, 'Must have at least 3 doctors');

  const doc1 = data.data.find((d) => d.id === 1);
  assert.ok(doc1, 'Doctor with id 1 must exist');
  assert.equal(doc1.name, 'Dr. Maya Bennett');
  assert.equal(doc1.provenanceStatus, 'synthetic_demo');
  assert.ok(doc1.sourceOrganization, 'Source organization must be populated');
  assert.ok(doc1.slots.length > 0, 'Doctor slots must be an array');
});

test('GET /api/doctors/:id returns specific doctor details', async () => {
  const res = await fetch(`${baseUrl}/api/doctors/2`);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.data.id, 2);
  assert.equal(data.data.name, 'Dr. Daniel Park');
  assert.equal(data.data.specialty, 'Cardiology · Heart Health');
  assert.equal(data.data.provenanceStatus, 'synthetic_demo');
  assert.equal(data.data.isSynthetic, true);
});

test('GET /api/doctors/:id returns 404 for unknown doctor ID', async () => {
  const res = await fetch(`${baseUrl}/api/doctors/999`);
  const data = await res.json();

  assert.equal(res.status, 404);
  assert.equal(data.success, false);
  assert.equal(data.code, 'DOCTOR_NOT_FOUND');
});

test('POST /api/patient/appointments rejects unauthenticated requests with 401', async () => {
  const res = await fetch(`${baseUrl}/api/patient/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctor_id: 1,
      preferred_slot: '11:30 AM',
      requested_date: '2026-11-15'
    })
  });
  const data = await res.json();

  assert.equal(res.status, 401);
  assert.equal(data.success, false);
});

test('POST /api/patient/appointments allows authenticated patient to submit appointment request', async () => {
  // Login as patient
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'patient@cares.org',
      password: 'Patient@12345'
    })
  });
  const { token } = await loginRes.json();

  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const apptRes = await fetch(`${baseUrl}/api/patient/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      doctor_id: 2,
      preferred_slot: '10:45 AM',
      requested_date: tomorrow,
      visit_type: 'In-person',
      reason_for_visit: 'Comprehensive cardiovascular checkup'
    })
  });
  const apptData = await apptRes.json();

  assert.equal(apptRes.status, 201);
  assert.equal(apptData.success, true);
  assert.equal(apptData.data.status, 'pending');
  assert.equal(apptData.data.doctor_id, 2);
  assert.equal(apptData.data.preferred_slot, '10:45 AM');
});

test('POST /api/patient/appointments rejects past appointment dates with 400', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'patient@cares.org',
      password: 'Patient@12345'
    })
  });
  const { token } = await loginRes.json();

  const res = await fetch(`${baseUrl}/api/patient/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      doctor_id: 1,
      preferred_slot: '11:30 AM',
      requested_date: '2020-01-01',
      visit_type: 'In-person'
    })
  });
  const data = await res.json();

  assert.equal(res.status, 400);
  assert.equal(data.success, false);
  assert.equal(data.code, 'PAST_APPOINTMENT_DATE');
});

test('POST /api/patient/appointments rejects nonexistent doctor ID with 404', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'patient@cares.org',
      password: 'Patient@12345'
    })
  });
  const { token } = await loginRes.json();

  const res = await fetch(`${baseUrl}/api/patient/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      doctor_id: 9999,
      preferred_slot: '11:30 AM',
      requested_date: '2026-12-01',
      visit_type: 'In-person'
    })
  });
  const data = await res.json();

  assert.equal(res.status, 404);
  assert.equal(data.success, false);
  assert.equal(data.code, 'DOCTOR_NOT_FOUND');
});

test('Doctor appointment management: Doctor views assigned requests and accepts pending request', async () => {
  // Login as Dr. Daniel Park (doctor ID 2)
  const docLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'dr.daniel@cares.org',
      password: 'Doctor@12345'
    })
  });
  const { token: doctorToken } = await docLoginRes.json();

  // Retrieve Dr. Daniel's appointments
  const apptsRes = await fetch(`${baseUrl}/api/doctor/portal/appointments`, {
    headers: { Authorization: `Bearer ${doctorToken}` }
  });
  const apptsData = await apptsRes.json();

  assert.equal(apptsRes.status, 200);
  assert.equal(apptsData.success, true);
  assert.ok(Array.isArray(apptsData.data));

  // Find a pending request for Dr. Daniel
  const pendingAppt = apptsData.data.find((a) => a.status === 'pending' || a.status === 'requested');
  assert.ok(pendingAppt, 'Should find at least one pending appointment request for Dr. Daniel');

  // Accept the request
  const acceptRes = await fetch(`${baseUrl}/api/doctor/portal/appointments/${pendingAppt.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${doctorToken}`
    },
    body: JSON.stringify({
      status: 'accepted',
      notes: 'Consultation slot confirmed by Dr. Daniel Park'
    })
  });
  const acceptData = await acceptRes.json();

  assert.equal(acceptRes.status, 200);
  assert.equal(acceptData.success, true);
  assert.equal(acceptData.data.status, 'accepted');
});

test('Doctor modifying another doctor appointment returns 403 Forbidden', async () => {
  // Login as Dr. Maya Bennett (doctor ID 1)
  const doc1LoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'dr.maya@cares.org',
      password: 'Doctor@12345'
    })
  });
  const { token: docMayaToken } = await doc1LoginRes.json();

  // Login as Dr. Daniel Park (doctor ID 2) to see Daniel's appointments
  const doc2LoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'dr.daniel@cares.org',
      password: 'Doctor@12345'
    })
  });
  const { token: docDanielToken } = await doc2LoginRes.json();

  const danielApptsRes = await fetch(`${baseUrl}/api/doctor/portal/appointments`, {
    headers: { Authorization: `Bearer ${docDanielToken}` }
  });
  const danielApptsData = await danielApptsRes.json();
  const danielsAppt = danielApptsData.data[0];

  assert.ok(danielsAppt, 'Dr. Daniel must have an appointment');

  // Dr. Maya tries to alter Dr. Daniel's appointment
  const tamperRes = await fetch(`${baseUrl}/api/doctor/portal/appointments/${danielsAppt.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${docMayaToken}`
    },
    body: JSON.stringify({
      status: 'declined',
      notes: 'Unauthorized tamper attempt'
    })
  });
  const tamperData = await tamperRes.json();

  assert.equal(tamperRes.status, 403);
  assert.equal(tamperData.success, false);
  assert.equal(tamperData.code, 'FORBIDDEN_APPOINTMENT_ACCESS');
});

test('Patient isolation: Patient dashboard only returns authenticated patient records', async () => {
  const patientLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'patient@cares.org',
      password: 'Patient@12345'
    })
  });
  const { token: patientToken, user: patientUser } = await patientLoginRes.json();

  const dashRes = await fetch(`${baseUrl}/api/patient/dashboard`, {
    headers: { Authorization: `Bearer ${patientToken}` }
  });
  const dashData = await dashRes.json();

  assert.equal(dashRes.status, 200);
  assert.equal(dashData.success, true);
  assert.ok(Array.isArray(dashData.data.appointments));
  // Every appointment in this list must belong to this patient
  for (const appt of dashData.data.appointments) {
    assert.equal(appt.patient_id, patientUser.profile.id);
  }
});

/* ==========================================================================
   MILESTONE 3 TESTS: Doctor Verification, Admin Governance, Hospital Mgmt
   ========================================================================== */

test('Milestone 3: Doctor credential verification submission and pending review status', async () => {
  // Login as Dr. Sofia Rivera (initially pending / unverified)
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'dr.sofia@cares.org',
      password: 'Doctor@12345'
    })
  });
  const { token: doctorToken, user: docUser } = await loginRes.json();

  // Check initial verification status endpoint
  const verifRes = await fetch(`${baseUrl}/api/doctor/portal/verification`, {
    headers: { Authorization: `Bearer ${doctorToken}` }
  });
  const verifData = await verifRes.json();
  assert.equal(verifRes.status, 200);
  assert.equal(verifData.success, true);
  assert.ok(verifData.data.doctor);

  // Attempt duplicate submission while already pending -> should reject with 400
  const dupRes = await fetch(`${baseUrl}/api/doctor/portal/verification/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${doctorToken}`
    },
    body: JSON.stringify({
      licenseNumber: 'PB-MCI-2019-9081',
      issuingCouncil: 'Punjab Medical Council (PMC)',
      qualifications: 'MBBS, MD (Pediatrics)'
    })
  });
  const dupData = await dupRes.json();
  assert.equal(dupRes.status, 400);
  assert.equal(dupData.code, 'APPLICATION_ALREADY_PENDING');
});

test('Milestone 3: Security: Doctor cannot self-approve or access admin review endpoint', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'dr.sofia@cares.org',
      password: 'Doctor@12345'
    })
  });
  const { token: doctorToken } = await loginRes.json();

  // Doctor attempts to call admin review endpoint
  const reviewRes = await fetch(`${baseUrl}/api/admin/verifications/1/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${doctorToken}`
    },
    body: JSON.stringify({
      decision: 'approved',
      notes: 'Doctor self-approval attempt'
    })
  });
  const reviewData = await reviewRes.json();

  assert.equal(reviewRes.status, 403);
  assert.equal(reviewData.success, false);
});

test('Milestone 3: Admin review lifecycle: Clarification request, Doctor reply, Approval, and Suspension', async () => {
  // 1. Admin logs in
  const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@cares.org',
      password: 'Admin@12345'
    })
  });
  const { token: adminToken } = await adminLoginRes.json();

  // 2. Fetch pending verifications
  const listRes = await fetch(`${baseUrl}/api/admin/verifications`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const listData = await listRes.json();
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listData.data.verifications));

  const sofiaApp = listData.data.verifications.find(v => v.applicant_email === 'dr.sofia@cares.org');
  assert.ok(sofiaApp, 'Dr. Sofia must have an application');

  // 3. Admin requests clarification
  const clarifyRes = await fetch(`${baseUrl}/api/admin/verifications/${sofiaApp.id}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      decision: 'needs_clarification',
      clarificationRequest: 'Please confirm date of registration renewal with Punjab Medical Council.',
      notes: 'Clarification requested regarding registration currency.'
    })
  });
  const clarifyData = await clarifyRes.json();
  assert.equal(clarifyRes.status, 200);
  assert.equal(clarifyData.data.status, 'needs_clarification');

  // Verify doctor's portal reflects needs_clarification
  const docLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'dr.sofia@cares.org',
      password: 'Doctor@12345'
    })
  });
  const { token: doctorToken } = await docLoginRes.json();

  const docVerifRes = await fetch(`${baseUrl}/api/doctor/portal/verification`, {
    headers: { Authorization: `Bearer ${doctorToken}` }
  });
  const docVerifData = await docVerifRes.json();
  assert.equal(docVerifData.data.doctor.verificationStatus, 'needs_clarification');

  // 4. Doctor responds to clarification
  const respondRes = await fetch(`${baseUrl}/api/doctor/portal/verification/clarify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${doctorToken}`
    },
    body: JSON.stringify({
      clarificationResponse: 'Renewal completed on 2026-01-15, Certificate #PMC-REN-2026-9081.'
    })
  });
  const respondData = await respondRes.json();
  assert.equal(respondRes.status, 200);
  assert.equal(respondData.data.status, 'pending');

  // 5. Admin approves application
  const approveRes = await fetch(`${baseUrl}/api/admin/verifications/${sofiaApp.id}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      decision: 'approved',
      notes: 'Primary source verified against Punjab Medical Council portal registry.'
    })
  });
  const approveData = await approveRes.json();
  assert.equal(approveRes.status, 200);
  assert.equal(approveData.data.status, 'approved');

  // Verify doctor profile now has is_verified = 1 and status = verified
  const publicDocRes = await fetch(`${baseUrl}/api/doctors/3`);
  const publicDocData = await publicDocRes.json();
  assert.equal(publicDocRes.status, 200);
  assert.equal(publicDocData.data.isVerified, true);
  assert.equal(publicDocData.data.verificationStatus, 'verified');

  // 6. Admin suspends verified doctor
  const suspendRes = await fetch(`${baseUrl}/api/admin/verifications/${sofiaApp.id}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      decision: 'suspended',
      decisionReason: 'Temporary administrative audit suspension.',
      notes: 'Suspended pending institutional credential re-check.'
    })
  });
  const suspendData = await suspendRes.json();
  assert.equal(suspendRes.status, 200);
  assert.equal(suspendData.data.status, 'suspended');

  // Verify public doctor profile is no longer verified
  const publicDocRes2 = await fetch(`${baseUrl}/api/doctors/3`);
  const publicDocData2 = await publicDocRes2.json();
  assert.equal(publicDocData2.data.isVerified, false);
  assert.equal(publicDocData2.data.verificationStatus, 'suspended');
});

test('Milestone 3: Public doctor endpoints enforce privacy and do not leak review notes or private evidence', async () => {
  const res = await fetch(`${baseUrl}/api/doctors/1`);
  const data = await res.json();

  assert.equal(res.status, 200);
  const doc = data.data;

  // Sensitive review notes or internal reviewer fields must NOT be exposed
  assert.equal(doc.verification_notes, undefined, 'Public response must not expose verification_notes');
  assert.equal(doc.verified_by_user_id, undefined, 'Public response must not expose reviewer ID');
  assert.equal(doc.password_hash, undefined, 'Public response must not expose passwords');
  assert.equal(doc.supporting_evidence_json, undefined, 'Public response must not expose private evidence');

  // Public safe fields must be available
  assert.ok(doc.id);
  assert.ok(doc.name);
  assert.ok(doc.specialty);
  assert.equal(typeof doc.isVerified, 'boolean');
});

test('Milestone 3: Hospital facility management: Profile update, RBAC scoping, and affiliation management', async () => {
  // 1. Hospital logs in
  const hospLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'hospital@riverside.org',
      password: 'Hospital@12345'
    })
  });
  const { token: hospToken } = await hospLoginRes.json();

  // 2. Fetch hospital dashboard
  const dashRes = await fetch(`${baseUrl}/api/hospital/dashboard`, {
    headers: { Authorization: `Bearer ${hospToken}` }
  });
  const dashData = await dashRes.json();
  assert.equal(dashRes.status, 200);
  assert.equal(dashData.success, true);
  assert.ok(dashData.data.facility);

  // 3. Hospital updates facility details
  const updateRes = await fetch(`${baseUrl}/api/hospital/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hospToken}`
    },
    body: JSON.stringify({
      name: 'Riverside Community Health Center',
      phone: '555-0199',
      website_url: 'https://riverside.example.org',
      emergency_available: 1,
      operating_hours_json: JSON.stringify({ regular: '08:00 - 20:00', emergency: '24/7' })
    })
  });
  const updateData = await updateRes.json();
  assert.equal(updateRes.status, 200);
  assert.equal(updateData.data.name, 'Riverside Community Health Center');
  assert.equal(updateData.data.website_url, 'https://riverside.example.org');

  // 4. Hospital attempts to alter restricted fields (is_verified or role) -> must reject with 403
  const hackRes = await fetch(`${baseUrl}/api/hospital/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hospToken}`
    },
    body: JSON.stringify({
      is_verified: 1,
      role: 'admin'
    })
  });
  const hackData = await hackRes.json();
  assert.equal(hackRes.status, 403);
  assert.equal(hackData.code, 'FORBIDDEN_FIELD_MUTATION');

  // 5. Hospital removes existing doctor affiliation
  const delAffRes1 = await fetch(`${baseUrl}/api/hospital/affiliations/3`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${hospToken}` }
  });
  const delAffData1 = await delAffRes1.json();
  assert.equal(delAffRes1.status, 200);
  assert.equal(delAffData1.success, true);

  // 6. Hospital adds doctor affiliation
  const addAffRes = await fetch(`${baseUrl}/api/hospital/affiliations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hospToken}`
    },
    body: JSON.stringify({
      doctor_id: 3,
      role_at_facility: 'Pediatric Specialist',
      affiliation_source: 'Hospital Credentialing Committee'
    })
  });
  const addAffData = await addAffRes.json();
  assert.equal(addAffRes.status, 201);
  assert.equal(addAffData.success, true);

  // 7. Hospital cleans up affiliation
  const delAffRes2 = await fetch(`${baseUrl}/api/hospital/affiliations/3`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${hospToken}` }
  });
  const delAffData2 = await delAffRes2.json();
  assert.equal(delAffRes2.status, 200);
  assert.equal(delAffData2.success, true);
});

// =========================================================================
// Milestone 3.1: Safe Data Integrity and Provider Provenance Tests
// =========================================================================

test('Milestone 3.1: Import validation rejects invalid facility and doctor records before any database writes', () => {
  // Facility validation
  const invalidFac1 = { name: 'AB', city: 'Chandigarh', state: 'UT' }; // name < 3 chars
  const errors1 = validateFacilityRecord(invalidFac1);
  assert.ok(errors1.length > 0, 'Facility with short name must be rejected');

  const invalidFac2 = { name: 'Valid Hospital', city: '', state: 'UT' };
  const errors2 = validateFacilityRecord(invalidFac2);
  assert.ok(errors2.length > 0, 'Facility with empty city must be rejected');

  const invalidFac3 = { name: 'Valid Hospital', city: 'Chandigarh', state: 'UT', sourceUrl: 'not-a-url' };
  const errors3 = validateFacilityRecord(invalidFac3);
  assert.ok(errors3.some(e => e.includes('valid HTTP/HTTPS URL')), 'Invalid URL must be rejected');

  // Doctor validation
  const invalidDoc1 = { fullName: '', specialty: 'Cardiology' };
  const errors4 = validateDoctorRecord(invalidDoc1);
  assert.ok(errors4.length > 0, 'Doctor with empty name must be rejected');

  const invalidDoc2 = { fullName: 'Dr. Valid', specialty: '', sourceUrl: 'ftp://unsupported' };
  const errors5 = validateDoctorRecord(invalidDoc2);
  assert.ok(errors5.length > 0, 'Doctor with empty specialty must be rejected');
});

test('Milestone 3.1: Dry-run performs zero database writes', () => {
  const initialHospCount = db.get('SELECT COUNT(*) as count FROM hospitals').count;
  const initialDocCount = db.get('SELECT COUNT(*) as count FROM doctor_profiles').count;

  const result = importLocalProviders({ dryRun: true });
  assert.ok(result.facilitiesImported > 0 || result.facilitiesSkipped > 0);

  const afterHospCount = db.get('SELECT COUNT(*) as count FROM hospitals').count;
  const afterDocCount = db.get('SELECT COUNT(*) as count FROM doctor_profiles').count;

  assert.equal(afterHospCount, initialHospCount, 'Dry-run must not modify hospitals table');
  assert.equal(afterDocCount, initialDocCount, 'Dry-run must not modify doctor_profiles table');
});

test('Milestone 3.1: Publicly sourced facilities and clinicians are imported with correct provenance and unverified flags', () => {
  const importSummary = importLocalProviders({ dryRun: false });
  assert.ok(importSummary.facilitiesImported > 0 || importSummary.facilitiesSkipped > 0);

  // Check imported public facilities
  const publicHospitals = db.all(
    `SELECT id, name, is_verified, verification_status, provenance_status 
     FROM hospitals WHERE provenance_status = 'publicly_sourced'`
  );
  assert.ok(publicHospitals.length >= 3, 'Must have at least 3 publicly sourced hospitals');
  for (const hosp of publicHospitals) {
    assert.equal(hosp.is_verified, 0, `Facility ${hosp.name} must have is_verified = 0`);
    assert.equal(hosp.verification_status, 'unverified', `Facility ${hosp.name} must have verification_status = 'unverified'`);
    assert.equal(hosp.provenance_status, 'publicly_sourced');
  }

  // Check imported public clinicians
  const publicDocs = db.all(
    `SELECT id, full_name, is_verified, verification_status, registration_check_status, provenance_status, license_number, issuing_council
     FROM doctor_profiles WHERE provenance_status = 'publicly_sourced'`
  );
  assert.ok(publicDocs.length >= 4, 'Must have at least 4 publicly sourced clinicians');
  for (const doc of publicDocs) {
    assert.equal(doc.is_verified, 0, `Doctor ${doc.full_name} must have is_verified = 0`);
    assert.equal(doc.verification_status, 'unverified', `Doctor ${doc.full_name} must have verification_status = 'unverified'`);
    assert.equal(doc.registration_check_status, 'unchecked', `Doctor ${doc.full_name} must have registration_check_status = 'unchecked'`);
    assert.equal(doc.provenance_status, 'publicly_sourced');
    assert.equal(doc.license_number, null, `Doctor ${doc.full_name} must not have fabricated license number`);
    assert.equal(doc.issuing_council, null);
  }
});

test('Milestone 3.1: Public endpoints expose unverified status and do not grant verified badges to public clinicians by default', async () => {
  const res = await fetch(`${baseUrl}/api/doctors`);
  const data = await res.json();
  assert.equal(res.status, 200);

  const publicDocs = data.data.filter(d => d.provenanceStatus === 'publicly_sourced');
  assert.ok(publicDocs.length >= 4);

  for (const doc of publicDocs) {
    assert.equal(doc.isVerified, false, 'Publicly sourced doctor must not have isVerified = true by default');
    assert.equal(doc.verificationStatus, 'unverified');
    assert.equal(doc.registrationCheckStatus, 'unchecked');
    assert.equal(doc.licenseNumber, null);
  }
});

test('Milestone 3.1: Repeated imports are idempotent and do not create duplicate records', () => {
  const initialHospCount = db.get('SELECT COUNT(*) as count FROM hospitals').count;
  const initialDocCount = db.get('SELECT COUNT(*) as count FROM doctor_profiles').count;

  const secondRun = importLocalProviders({ dryRun: false });
  assert.equal(secondRun.facilitiesImported, 0, 'No new facilities should be inserted on repeat run');
  assert.equal(secondRun.doctorsImported, 0, 'No new doctors should be inserted on repeat run');
  assert.ok(secondRun.facilitiesSkipped > 0, 'Existing facilities should be skipped');
  assert.ok(secondRun.doctorsSkipped > 0, 'Existing doctors should be skipped');

  const afterHospCount = db.get('SELECT COUNT(*) as count FROM hospitals').count;
  const afterDocCount = db.get('SELECT COUNT(*) as count FROM doctor_profiles').count;

  assert.equal(afterHospCount, initialHospCount, 'Repeat import must not increase hospital count');
  assert.equal(afterDocCount, initialDocCount, 'Repeat import must not increase doctor count');
});

test('Milestone 3.1: Batch import rollback ensures atomicity on failure', () => {
  const initialDocCount = db.get('SELECT COUNT(*) as count FROM doctor_profiles').count;
  const initialHospCount = db.get('SELECT COUNT(*) as count FROM hospitals').count;

  // Test that an atomic transaction rollback within SQLite properly reverts writes
  db.exec('BEGIN TRANSACTION;');
  let caughtError = null;
  try {
    const userRes = db.run(
      `INSERT INTO users (email, password_hash, role, status) VALUES ('rollback.test@cares.org', 'NO_HASH', 'doctor', 'pending_approval')`
    );
    db.run(
      `INSERT INTO doctor_profiles (user_id, full_name, specialty, is_synthetic, provenance_status) VALUES (?, 'Dr. Temporary Test', 'Test', 0, 'publicly_sourced')`,
      [userRes.lastInsertRowid]
    );
    throw new Error('Simulated batch import error');
  } catch (err) {
    caughtError = err;
    db.exec('ROLLBACK;');
  }

  assert.ok(caughtError, 'An error should have been caught');
  assert.match(caughtError.message, /Simulated batch import error/);

  const finalDocCount = db.get('SELECT COUNT(*) as count FROM doctor_profiles').count;
  const finalHospCount = db.get('SELECT COUNT(*) as count FROM hospitals').count;
  assert.equal(finalDocCount, initialDocCount, 'Rolled back transaction must leave doctor count unchanged');
  assert.equal(finalHospCount, initialHospCount, 'Rolled back transaction must leave hospital count unchanged');
  const tempDoc = db.get(`SELECT id FROM doctor_profiles WHERE full_name = 'Dr. Temporary Test'`);
  assert.equal(tempDoc, undefined, 'Rolled back record must not exist in database');
});

test('Milestone 3.1: Existing administrator verification decisions are not overwritten by provider re-import', () => {
  const targetDoc = db.get(`SELECT id, full_name FROM doctor_profiles WHERE provenance_status = 'publicly_sourced' LIMIT 1`);
  assert.ok(targetDoc, 'Target doctor must exist');

  db.run(
    `UPDATE doctor_profiles 
     SET is_verified = 1, verification_status = 'verified', registration_check_status = 'checked'
     WHERE id = ?`,
    [targetDoc.id]
  );

  // Run importLocalProviders again
  importLocalProviders({ dryRun: false });

  // Verify that the doctor's verified status was preserved and NOT overwritten to unverified
  const verifiedDoc = db.get(`SELECT is_verified, verification_status, registration_check_status FROM doctor_profiles WHERE id = ?`, [targetDoc.id]);
  assert.equal(verifiedDoc.is_verified, 1, 'Admin verification flag must be preserved');
  assert.equal(verifiedDoc.verification_status, 'verified', 'Admin verification status must be preserved');
  assert.equal(verifiedDoc.registration_check_status, 'checked');

  // Reset back to unverified for test purity
  db.run(
    `UPDATE doctor_profiles 
     SET is_verified = 0, verification_status = 'unverified', registration_check_status = 'unchecked'
     WHERE id = ?`,
    [targetDoc.id]
  );
});

test('Milestone 3.1: Synthetic demo records are clearly distinguished with isSynthetic = true and provenanceStatus = synthetic_demo', async () => {
  const res = await fetch(`${baseUrl}/api/doctors/1`);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.data.isSynthetic, true, 'Synthetic demo doctor must have isSynthetic = true');
  assert.equal(data.data.provenanceStatus, 'synthetic_demo', 'Synthetic demo doctor must have provenanceStatus = synthetic_demo');
});

// =========================================================================
// Milestone 3.2: Directory Authentication & Public Hospital Directory Tests
// =========================================================================

test('Milestone 3.2: Imported directory-only accounts are strictly barred from authenticating via login', async () => {
  // Query for an imported directory user account
  const directoryUser = db.get(
    `SELECT u.id, u.email FROM users u 
     WHERE u.email LIKE '%@directory.cares.org' 
        OR u.password_hash = 'DIRECTORY_IMPORT_NO_LOGIN_UNAUTHORIZED' 
     LIMIT 1`
  );

  assert.ok(directoryUser, 'Directory user should exist from local provider import');

  // Attempt login with any password -> must strictly return 401 INVALID_CREDENTIALS
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: directoryUser.email,
      password: 'AnyPassword123!'
    })
  });
  const loginData = await loginRes.json();

  assert.equal(loginRes.status, 401);
  assert.equal(loginData.success, false);
  assert.equal(loginData.code, 'INVALID_CREDENTIALS');

  // Verify normal accounts still authenticate successfully (authentication not weakened)
  const normalDoctorRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'dr.daniel@cares.org',
      password: 'Doctor@12345'
    })
  });
  assert.equal(normalDoctorRes.status, 200);
  const normalDocData = await normalDoctorRes.json();
  assert.equal(normalDocData.success, true);
  assert.equal(normalDocData.user.role, 'doctor');
});

test('Milestone 3.2: Public GET /api/hospitals returns sanitized healthcare facility directory', async () => {
  const res = await fetch(`${baseUrl}/api/hospitals`);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.data));
  assert.ok(data.count >= 4);

  // Inspect each facility record
  for (const hosp of data.data) {
    // Required public safe fields
    assert.ok(hosp.id);
    assert.ok(hosp.name);
    assert.ok(hosp.city);
    assert.ok(hosp.state);
    assert.ok(hosp.operatingHours);
    assert.ok(Array.isArray(hosp.departments));
    assert.equal(typeof hosp.emergencyAvailable, 'boolean');
    assert.equal(typeof hosp.isVerified, 'boolean');
    assert.ok(hosp.verificationStatus);
    assert.ok(hosp.provenanceStatus);
    assert.equal(typeof hosp.doctorCount, 'number');

    // Private fields must NOT be leaked
    assert.equal(hosp.user_id, undefined, 'Public response must not expose facility manager user_id');
    assert.equal(hosp.email, undefined, 'Public response must not leak manager internal email');
    assert.equal(hosp.password_hash, undefined, 'Public response must never leak password hashes');
  }

  // Test query parameter filtering
  const filteredRes = await fetch(`${baseUrl}/api/hospitals?emergency=true`);
  const filteredData = await filteredRes.json();
  assert.equal(filteredRes.status, 200);
  assert.ok(filteredData.data.every(h => h.emergencyAvailable === true));
});

test('Milestone 3.2: Public GET /api/hospitals/:id returns facility details with affiliated doctors and handles errors', async () => {
  // Test valid hospital: PGIMER (ID 2)
  const res = await fetch(`${baseUrl}/api/hospitals/2`);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  const facility = data.data;

  assert.equal(facility.id, 2);
  assert.equal(facility.name, 'Postgraduate Institute of Medical Education & Research (PGIMER)');
  assert.equal(facility.provenanceStatus, 'publicly_sourced');
  assert.equal(facility.isVerified, false);
  assert.equal(facility.verificationStatus, 'unverified');

  // Verify affiliated doctors array is present
  assert.ok(Array.isArray(facility.affiliatedDoctors));
  assert.ok(facility.affiliatedDoctors.length >= 2, 'PGIMER must have affiliated clinicians');
  const sanjayJain = facility.affiliatedDoctors.find(d => d.name.includes('Sanjay Jain'));
  assert.ok(sanjayJain, 'Prof. Sanjay Jain must be listed in affiliated doctors');
  assert.equal(sanjayJain.isVerified, false);

  // Test non-numeric ID -> 400
  const badIdRes = await fetch(`${baseUrl}/api/hospitals/invalid-id`);
  const badIdData = await badIdRes.json();
  assert.equal(badIdRes.status, 400);
  assert.equal(badIdData.code, 'INVALID_HOSPITAL_ID');

  // Test unknown hospital ID -> 404
  const notFoundRes = await fetch(`${baseUrl}/api/hospitals/99999`);
  const notFoundData = await notFoundRes.json();
  assert.equal(notFoundRes.status, 404);
  assert.equal(notFoundData.code, 'HOSPITAL_NOT_FOUND');
});

test('Milestone 4.1: Publicly sourced facilities have isSynthetic = false and suppress crowdLevel', async () => {
  const res = await fetch(`${baseUrl}/api/hospitals`);
  const data = await res.json();
  assert.equal(res.status, 200);

  const riverside = data.data.find(h => h.id === 1);
  assert.ok(riverside, 'Riverside facility must exist');
  assert.equal(riverside.isSynthetic, true, 'Riverside must remain synthetic demo');
  assert.equal(riverside.provenanceStatus, 'synthetic_demo');
  assert.ok(riverside.crowdLevel, 'Synthetic demo facilities may expose demo crowdLevel');

  const publicFacilities = data.data.filter(h => h.id !== 1);
  assert.ok(publicFacilities.length >= 3, 'Must have at least 3 public facilities');

  for (const fac of publicFacilities) {
    assert.equal(fac.isSynthetic, false, `Public facility "${fac.name}" must have isSynthetic = false`);
    assert.equal(fac.provenanceStatus, 'publicly_sourced');
    assert.equal(fac.isVerified, false, `Public facility "${fac.name}" must not be verified by default`);
    assert.equal(fac.crowdLevel, null, `Public facility "${fac.name}" must NOT expose unsupported crowdLevel`);
  }
});

test('Milestone 4.1: Repeat import preserves existing facility records and administrative status', async () => {
  const importResult = importLocalProviders({ dryRun: false });

  assert.ok(importResult.facilitiesSkipped >= 3, 'All existing facilities must be skipped');
  assert.equal(importResult.facilitiesImported, 0, 'Zero duplicate facilities must be created');

  // Verify database records were not overwritten
  const checkRes = await fetch(`${baseUrl}/api/hospitals/2`);
  const checkData = await checkRes.json();
  assert.equal(checkData.data.isSynthetic, false);
  assert.equal(checkData.data.isVerified, false);
});

// ====================================================================
// MILESTONE 5: APPOINTMENT WORKFLOW & DATA INTEGRITY TESTS
// ====================================================================

test('Milestone 5: Successful appointment booking with configured slot and future date', async () => {
  // Login as default patient
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@cares.org', password: 'Patient@12345' })
  });
  const { token } = await loginRes.json();

  // Pick a date 10 days in the future
  const d = new Date();
  d.setDate(d.getDate() + 10);
  const futureDate = d.toISOString().split('T')[0];

  const bookRes = await fetch(`${baseUrl}/api/patient/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      doctor_id: 1, // Dr. Maya Bennett
      preferred_slot: '11:30 AM',
      requested_date: futureDate,
      visit_type: 'In-person',
      reason_for_visit: 'Annual wellness checkup'
    })
  });
  const bookData = await bookRes.json();

  assert.equal(bookRes.status, 201);
  assert.equal(bookData.success, true);
  assert.equal(bookData.data.status, 'pending');
  assert.equal(bookData.data.preferred_slot, '11:30 AM');
  assert.equal(bookData.data.requested_date, futureDate);
  assert.ok(bookData.data.id, 'New appointment ID must be returned');
});

test('Milestone 5: Rejects appointment booking for doctor not accepting new patients', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@cares.org', password: 'Patient@12345' })
  });
  const { token } = await loginRes.json();

  // Explicitly set Dr. Sofia Rivera (id: 3) is_accepting_new_patients = 0 in test database
  db.exec("UPDATE doctor_profiles SET is_accepting_new_patients = 0 WHERE id = 3;");

  try {
    const res = await fetch(`${baseUrl}/api/patient/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        doctor_id: 3,
        preferred_slot: '10:00 AM',
        requested_date: '2026-11-15'
      })
    });
    const data = await res.json();

    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.equal(data.code, 'DOCTOR_NOT_ACCEPTING_REQUESTS');
  } finally {
    // Restore doctor 3 accepting status in test database
    db.exec("UPDATE doctor_profiles SET is_accepting_new_patients = 1 WHERE id = 3;");
  }
});

test('Milestone 5: Rejects appointment booking for non-existent doctor', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@cares.org', password: 'Patient@12345' })
  });
  const { token } = await loginRes.json();

  const res = await fetch(`${baseUrl}/api/patient/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      doctor_id: 99999,
      preferred_slot: '10:00 AM'
    })
  });
  const data = await res.json();

  assert.equal(res.status, 404);
  assert.equal(data.code, 'DOCTOR_NOT_FOUND');
});

test('Milestone 5: Rejects past appointment dates and dates exceeding 90-day booking horizon', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@cares.org', password: 'Patient@12345' })
  });
  const { token } = await loginRes.json();

  // Test past date
  const pastRes = await fetch(`${baseUrl}/api/patient/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      doctor_id: 1,
      preferred_slot: '11:30 AM',
      requested_date: '2020-01-01'
    })
  });
  const pastData = await pastRes.json();
  assert.equal(pastRes.status, 400);
  assert.equal(pastData.code, 'PAST_APPOINTMENT_DATE');

  // Test date > 90 days in the future
  const farFuture = new Date();
  farFuture.setDate(farFuture.getDate() + 95);
  const farFutureStr = farFuture.toISOString().split('T')[0];

  const futureRes = await fetch(`${baseUrl}/api/patient/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      doctor_id: 1,
      preferred_slot: '11:30 AM',
      requested_date: farFutureStr
    })
  });
  const futureData = await futureRes.json();
  assert.equal(futureRes.status, 400);
  assert.equal(futureData.code, 'DATE_EXCEEDS_HORIZON');
});

test('Milestone 5: Rejects unconfigured slots not belonging to doctor schedule', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@cares.org', password: 'Patient@12345' })
  });
  const { token } = await loginRes.json();

  const res = await fetch(`${baseUrl}/api/patient/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      doctor_id: 1,
      preferred_slot: '3:33 AM Middle of Night',
      requested_date: '2026-11-20'
    })
  });
  const data = await res.json();

  assert.equal(res.status, 400);
  assert.equal(data.code, 'INVALID_SLOT_SELECTED');
});

test('Milestone 5: Rejects rapid duplicate appointment submissions within 30 seconds', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@cares.org', password: 'Patient@12345' })
  });
  const { token } = await loginRes.json();

  const d = new Date();
  d.setDate(d.getDate() + 15);
  const testDate = d.toISOString().split('T')[0];

  // First submission
  const res1 = await fetch(`${baseUrl}/api/patient/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      doctor_id: 1,
      preferred_slot: '2:00 PM',
      requested_date: testDate
    })
  });
  assert.equal(res1.status, 201);

  // Rapid identical submission
  const res2 = await fetch(`${baseUrl}/api/patient/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      doctor_id: 1,
      preferred_slot: '2:00 PM',
      requested_date: testDate
    })
  });
  const data2 = await res2.json();

  assert.equal(res2.status, 409);
  assert.equal(data2.code, 'DUPLICATE_SUBMISSION_DETECTED');
});

test('Milestone 5: Accepted-slot collision prevention blocks booking of already-confirmed slot', async () => {
  // 1. Login as patient 1 and doctor 2 (Dr. Daniel Park)
  const p1Login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@cares.org', password: 'Patient@12345' })
  });
  const { token: p1Token } = await p1Login.json();

  const docLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dr.daniel@cares.org', password: 'Doctor@12345' })
  });
  const { token: docToken } = await docLogin.json();

  const d = new Date();
  d.setDate(d.getDate() + 25);
  const targetDate = d.toISOString().split('T')[0];
  const slot = '9:00 AM';

  // 2. Patient 1 requests slot
  const reqRes = await fetch(`${baseUrl}/api/patient/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${p1Token}`
    },
    body: JSON.stringify({
      doctor_id: 2,
      preferred_slot: slot,
      requested_date: targetDate
    })
  });
  const { data: reqData } = await reqRes.json();
  const apptId = reqData.id;

  // 3. Doctor 2 accepts this appointment
  const acceptRes = await fetch(`${baseUrl}/api/doctor/portal/appointments/${apptId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${docToken}`
    },
    body: JSON.stringify({ status: 'accepted' })
  });
  assert.equal(acceptRes.status, 200);

  // 4. Register a second patient and attempt to book the exact same slot
  const p2Email = `patient_collision_${Date.now()}@example.com`;
  const p2Reg = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: p2Email,
      password: 'Password123!',
      full_name: 'Patient Collision Test'
    })
  });
  const { token: p2Token } = await p2Reg.json();

  const conflictRes = await fetch(`${baseUrl}/api/patient/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${p2Token}`
    },
    body: JSON.stringify({
      doctor_id: 2,
      preferred_slot: slot,
      requested_date: targetDate
    })
  });
  const conflictData = await conflictRes.json();

  assert.equal(conflictRes.status, 409);
  assert.equal(conflictData.code, 'SLOT_ALREADY_BOOKED');
});

test('Milestone 5: Role isolation blocks non-patients from booking appointments', async () => {
  // Login as doctor
  const docLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dr.daniel@cares.org', password: 'Doctor@12345' })
  });
  const { token: docToken } = await docLogin.json();

  const res = await fetch(`${baseUrl}/api/patient/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${docToken}`
    },
    body: JSON.stringify({
      doctor_id: 1,
      preferred_slot: '11:30 AM',
      requested_date: '2026-11-28'
    })
  });
  const data = await res.json();

  assert.equal(res.status, 403);
  assert.equal(data.code, 'FORBIDDEN_ROLE');
});

test('Milestone 5: Patient-to-patient ownership isolation prevents unauthorized cancellation', async () => {
  // 1. Patient 1 books appointment
  const p1Login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@cares.org', password: 'Patient@12345' })
  });
  const { token: p1Token } = await p1Login.json();

  const d = new Date();
  d.setDate(d.getDate() + 30);
  const targetDate = d.toISOString().split('T')[0];

  const bookRes = await fetch(`${baseUrl}/api/patient/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${p1Token}`
    },
    body: JSON.stringify({
      doctor_id: 1,
      preferred_slot: '4:15 PM',
      requested_date: targetDate
    })
  });
  const { data: bookData } = await bookRes.json();
  const apptId = bookData.id;

  // 2. Patient 2 attempts to cancel Patient 1's appointment
  const p2Email = `patient_attacker_${Date.now()}@example.com`;
  const p2Reg = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: p2Email,
      password: 'Password123!',
      full_name: 'Patient Attacker Test'
    })
  });
  const { token: p2Token } = await p2Reg.json();

  const cancelRes = await fetch(`${baseUrl}/api/patient/appointments/${apptId}/cancel`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${p2Token}`
    }
  });
  const cancelData = await cancelRes.json();

  assert.equal(cancelRes.status, 403);
  assert.equal(cancelData.code, 'FORBIDDEN_APPOINTMENT_ACCESS');

  // Verify Patient 2 dedicated listing does NOT contain Patient 1's appointment
  const listRes = await fetch(`${baseUrl}/api/patient/appointments`, {
    headers: { Authorization: `Bearer ${p2Token}` }
  });
  const listData = await listRes.json();
  assert.equal(listRes.status, 200);
  assert.ok(!listData.data.some(a => a.id === apptId), 'Cross-patient appointment leakage detected');
});

test('Milestone 5: Doctor-to-doctor ownership isolation prevents cross-provider status updates', async () => {
  // 1. Patient books appointment with Dr. Maya Bennett (id: 1)
  const pLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@cares.org', password: 'Patient@12345' })
  });
  const { token: pToken } = await pLogin.json();

  const d = new Date();
  d.setDate(d.getDate() + 35);
  const targetDate = d.toISOString().split('T')[0];

  const bookRes = await fetch(`${baseUrl}/api/patient/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pToken}`
    },
    body: JSON.stringify({
      doctor_id: 1, // Dr. Maya
      preferred_slot: '11:30 AM',
      requested_date: targetDate
    })
  });
  const { data: bookData } = await bookRes.json();
  const apptId = bookData.id;

  // 2. Dr. Daniel Park (id: 2) attempts to accept Dr. Maya's appointment
  const doc2Login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dr.daniel@cares.org', password: 'Doctor@12345' })
  });
  const { token: doc2Token } = await doc2Login.json();

  const crossUpdate = await fetch(`${baseUrl}/api/doctor/portal/appointments/${apptId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${doc2Token}`
    },
    body: JSON.stringify({ status: 'accepted' })
  });
  const crossData = await crossUpdate.json();

  assert.equal(crossUpdate.status, 403);
  assert.equal(crossData.code, 'FORBIDDEN_APPOINTMENT_ACCESS');
});

test('Milestone 5: Doctor lifecycle state machine transitions (Accept, Decline, Complete, Cancel, Notes)', async () => {
  // Login patient and Dr. Daniel
  const pLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@cares.org', password: 'Patient@12345' })
  });
  const { token: pToken } = await pLogin.json();

  const docLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dr.daniel@cares.org', password: 'Doctor@12345' })
  });
  const { token: docToken } = await docLogin.json();

  // 1. Create appointment A
  const d = new Date();
  d.setDate(d.getDate() + 40);
  const targetDate = d.toISOString().split('T')[0];

  const bookRes = await fetch(`${baseUrl}/api/patient/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pToken}`
    },
    body: JSON.stringify({
      doctor_id: 2,
      preferred_slot: '10:45 AM',
      requested_date: targetDate
    })
  });
  const { data: apptA } = await bookRes.json();

  // 2. Doctor accepts appointment A
  const acceptRes = await fetch(`${baseUrl}/api/doctor/portal/appointments/${apptA.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${docToken}`
    },
    body: JSON.stringify({
      status: 'accepted',
      notes: 'Confirmed by cardiology department'
    })
  });
  assert.equal(acceptRes.status, 200);

  // 3. Doctor cannot mark appointment A completed if date is in the future
  const prematureComplete = await fetch(`${baseUrl}/api/doctor/portal/appointments/${apptA.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${docToken}`
    },
    body: JSON.stringify({ status: 'completed' })
  });
  assert.equal(prematureComplete.status, 400);
  const prematureData = await prematureComplete.json();
  assert.equal(prematureData.code, 'CANNOT_COMPLETE_FUTURE_APPOINTMENT');

  // Test same-day premature completion: slot time in future on current date
  const todayStr = getLocalDateString();
  const sameDayFutureAppt = db.run(
    `INSERT INTO appointment_requests (
      patient_id, doctor_id, hospital_id, requested_date, preferred_slot, visit_type, reason_for_visit, status
    ) VALUES (1, 2, 1, ?, '11:59 PM', 'In-person', 'Checkup', 'accepted')`,
    [todayStr]
  );
  const sameDayPrematureRes = await fetch(`${baseUrl}/api/doctor/portal/appointments/${sameDayFutureAppt.lastInsertRowid}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${docToken}`
    },
    body: JSON.stringify({ status: 'completed' })
  });
  assert.equal(sameDayPrematureRes.status, 400);
  const sameDayPrematureData = await sameDayPrematureRes.json();
  assert.equal(sameDayPrematureData.code, 'CANNOT_COMPLETE_FUTURE_APPOINTMENT');

  // Test completing an appointment whose scheduled date/time has passed succeeds
  const pastAppt = db.run(
    `INSERT INTO appointment_requests (
      patient_id, doctor_id, hospital_id, requested_date, preferred_slot, visit_type, reason_for_visit, status
    ) VALUES (1, 2, 1, '2026-01-01', '09:00 AM', 'In-person', 'Followup', 'accepted')`
  );
  const completePastRes = await fetch(`${baseUrl}/api/doctor/portal/appointments/${pastAppt.lastInsertRowid}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${docToken}`
    },
    body: JSON.stringify({ status: 'completed', notes: 'Completed patient consultation successfully' })
  });
  assert.equal(completePastRes.status, 200);
  const completePastData = await completePastRes.json();
  assert.equal(completePastData.data.status, 'completed');

  // 4. Doctor cancels accepted appointment A with required reason
  // Missing reason fails
  const noReasonCancel = await fetch(`${baseUrl}/api/doctor/portal/appointments/${apptA.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${docToken}`
    },
    body: JSON.stringify({ status: 'cancelled' })
  });
  assert.equal(noReasonCancel.status, 400);

  // Valid reason succeeds
  const validCancel = await fetch(`${baseUrl}/api/doctor/portal/appointments/${apptA.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${docToken}`
    },
    body: JSON.stringify({
      status: 'cancelled',
      notes: 'Emergency operating schedule change'
    })
  });
  assert.equal(validCancel.status, 200);

  // 5. Terminal status immutability: Cannot transition from cancelled
  const reAccept = await fetch(`${baseUrl}/api/doctor/portal/appointments/${apptA.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${docToken}`
    },
    body: JSON.stringify({ status: 'accepted' })
  });
  assert.equal(reAccept.status, 400);
  const reAcceptData = await reAccept.json();
  assert.equal(reAcceptData.code, 'TERMINAL_STATUS_IMMUTABLE');

  // 6. Verify history endpoint returns audit trail
  const histRes = await fetch(`${baseUrl}/api/doctor/portal/appointments/${apptA.id}/history`, {
    headers: { Authorization: `Bearer ${docToken}` }
  });
  const histData = await histRes.json();
  assert.equal(histRes.status, 200);
  assert.ok(histData.data.length >= 3, 'Must contain pending, accepted, and cancelled entries');
});

test('Milestone 5: Doctor collision prevention blocks accepting multiple requests for the same slot', async () => {
  const docLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dr.daniel@cares.org', password: 'Doctor@12345' })
  });
  const { token: docToken } = await docLogin.json();

  const d = new Date();
  d.setDate(d.getDate() + 45);
  const targetDate = d.toISOString().split('T')[0];
  const slot = '10:45 AM';

  // Insert two pending requests for the same doctor, date, and slot
  const req1 = db.run(
    `INSERT INTO appointment_requests (patient_id, doctor_id, hospital_id, requested_date, preferred_slot, visit_type, reason_for_visit, status)
     VALUES (1, 2, 1, ?, ?, 'In-person', 'Consult 1', 'pending')`,
    [targetDate, slot]
  );
  const req2 = db.run(
    `INSERT INTO appointment_requests (patient_id, doctor_id, hospital_id, requested_date, preferred_slot, visit_type, reason_for_visit, status)
     VALUES (1, 2, 1, ?, ?, 'In-person', 'Consult 2', 'pending')`,
    [targetDate, slot]
  );

  // Accept request 1 -> succeeds
  const accept1Res = await fetch(`${baseUrl}/api/doctor/portal/appointments/${req1.lastInsertRowid}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${docToken}`
    },
    body: JSON.stringify({ status: 'accepted' })
  });
  assert.equal(accept1Res.status, 200);

  // Accept request 2 for same slot -> blocked with 409 SLOT_ALREADY_CONFIRMED
  const accept2Res = await fetch(`${baseUrl}/api/doctor/portal/appointments/${req2.lastInsertRowid}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${docToken}`
    },
    body: JSON.stringify({ status: 'accepted' })
  });
  assert.equal(accept2Res.status, 409);
  const accept2Data = await accept2Res.json();
  assert.equal(accept2Data.code, 'SLOT_ALREADY_CONFIRMED');
});

test('Milestone 5: Patient cancellation authorization, same-day rules, and past slot rejections', async () => {
  const pLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@cares.org', password: 'Patient@12345' })
  });
  const { token: pToken } = await pLogin.json();

  const todayStr = getLocalDateString();

  // Configure Doctor 1 with '11:59 PM' slot to guarantee future same-day booking
  const origSlots = db.get(`SELECT available_slots_json FROM doctor_profiles WHERE id = 1`).available_slots_json;
  const updatedSlots = [...JSON.parse(origSlots), '11:59 PM'];
  db.exec(`UPDATE doctor_profiles SET available_slots_json = '${JSON.stringify(updatedSlots)}' WHERE id = 1;`);

  try {
    // 1. Book future slot for today
    const bookRes = await fetch(`${baseUrl}/api/patient/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pToken}`
      },
      body: JSON.stringify({
        doctor_id: 1,
        preferred_slot: '11:59 PM',
        requested_date: todayStr
      })
    });
    const { data: bookData } = await bookRes.json();
    assert.equal(bookRes.status, 201);

    // 2. Same-day cancellation before appointment takes place succeeds
    const cancelRes = await fetch(`${baseUrl}/api/patient/appointments/${bookData.id}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pToken}`
      }
    });
    const cancelData = await cancelRes.json();

    assert.equal(cancelRes.status, 200);
    assert.equal(cancelData.data.status, 'cancelled');

    // 3. Rejection of cancellation when slot time has already passed on today's date
    const pastTimeAppt = db.run(
      `INSERT INTO appointment_requests (
        patient_id, doctor_id, hospital_id, requested_date, preferred_slot, visit_type, reason_for_visit, status
      ) VALUES (1, 1, 1, ?, '01:00 AM', 'In-person', 'Early Checkup', 'accepted')`,
      [todayStr]
    );

    const pastCancelRes = await fetch(`${baseUrl}/api/patient/appointments/${pastTimeAppt.lastInsertRowid}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pToken}`
      }
    });
    assert.equal(pastCancelRes.status, 400);
    const pastCancelData = await pastCancelRes.json();
    assert.equal(pastCancelData.code, 'APPOINTMENT_TIME_PASSED');

    // 4. Rejection of booking past slot on today's date
    const slotsWithPast = ['01:00 AM', ...updatedSlots];
    db.exec(`UPDATE doctor_profiles SET available_slots_json = '${JSON.stringify(slotsWithPast)}' WHERE id = 1;`);

    const pastBookRes = await fetch(`${baseUrl}/api/patient/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pToken}`
      },
      body: JSON.stringify({
        doctor_id: 1,
        preferred_slot: '01:00 AM',
        requested_date: todayStr
      })
    });
    assert.equal(pastBookRes.status, 400);
    const pastBookData = await pastBookRes.json();
    assert.equal(pastBookData.code, 'PAST_APPOINTMENT_SLOT');
  } finally {
    // Restore original slots
    db.exec(`UPDATE doctor_profiles SET available_slots_json = '${origSlots}' WHERE id = 1;`);
  }
});

// ====================================================================
// MILESTONE 6: PRACTICE SETTINGS, AVAILABILITY & PATIENT PROFILE TESTS
// ====================================================================

test('Milestone 6: Doctor practice profile update succeeds and audits DOCTOR_PROFILE_UPDATED', async () => {
  const docLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dr.maya@cares.org', password: 'Doctor@12345' }),
  });
  const { token: docToken } = await docLogin.json();

  const updateRes = await fetch(`${baseUrl}/api/doctor/portal/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${docToken}`,
    },
    body: JSON.stringify({
      bio: 'Board-certified cardiologist dedicated to evidence-based preventive care and community heart health.',
      consultationFee: 750,
      languages: ['English', 'Hindi', 'Punjabi'],
      visitTypes: ['In-person', 'Video consultation'],
      isWheelchairAccessible: true,
    }),
  });

  const updateData = await updateRes.json();
  assert.equal(updateRes.status, 200);
  assert.equal(updateData.success, true);
  assert.equal(updateData.data.consultationFee, 750);
  assert.deepEqual(updateData.data.languages, ['English', 'Hindi', 'Punjabi']);
  assert.deepEqual(updateData.data.visitTypes, ['In-person', 'Video consultation']);
  assert.equal(updateData.data.isWheelchairAccessible, true);
  assert.ok(updateData.data.bio.includes('Board-certified cardiologist'));

  // Verify audit event
  const audit = db.get(
    `SELECT * FROM audit_events WHERE action = 'DOCTOR_PROFILE_UPDATED' ORDER BY id DESC LIMIT 1`
  );
  assert.ok(audit, 'DOCTOR_PROFILE_UPDATED audit record must exist');
  assert.equal(audit.target_type, 'DOCTOR_PROFILE');

  // Verify public GET /api/doctors reflects updated profile
  const publicRes = await fetch(`${baseUrl}/api/doctors/1`);
  const publicData = await publicRes.json();
  assert.equal(publicRes.status, 200);
  assert.equal(publicData.data.consultationFee, 750);
  assert.deepEqual(publicData.data.languages, ['English', 'Hindi', 'Punjabi']);
});

test('Milestone 6: Doctor practice profile input validation rejects invalid inputs and protected fields', async () => {
  const docLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dr.maya@cares.org', password: 'Doctor@12345' }),
  });
  const { token: docToken } = await docLogin.json();

  // 1. Negative fee
  const negFeeRes = await fetch(`${baseUrl}/api/doctor/portal/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({ consultationFee: -100 }),
  });
  assert.equal(negFeeRes.status, 400);

  // 2. Malformed languages (not an array)
  const badLangRes = await fetch(`${baseUrl}/api/doctor/portal/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({ languages: 'English, Hindi' }),
  });
  assert.equal(badLangRes.status, 400);

  // 3. Unsupported visit type
  const badVisitRes = await fetch(`${baseUrl}/api/doctor/portal/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({ visitTypes: ['Home visit', 'In-person'] }),
  });
  assert.equal(badVisitRes.status, 400);

  // 4. Invalid accessibility (string instead of boolean)
  const badAccessRes = await fetch(`${baseUrl}/api/doctor/portal/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({ isWheelchairAccessible: 'yes' }),
  });
  assert.equal(badAccessRes.status, 400);

  // 5. Protected field tampering attempt (license_number, is_verified, or arbitrary fields)
  const tamperRes = await fetch(`${baseUrl}/api/doctor/portal/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({ license_number: 'HACK-1234', is_verified: 1 }),
  });
  assert.equal(tamperRes.status, 400);
  const tamperData = await tamperRes.json();
  assert.ok(
    tamperData.code === 'DISALLOWED_FIELD' || tamperData.code === 'PROTECTED_FIELD_MUTATION',
    `Expected DISALLOWED_FIELD or PROTECTED_FIELD_MUTATION but got ${tamperData.code}`
  );

  // 6. Bio exceeding 1000 characters
  const longBio = 'A'.repeat(1005);
  const longBioRes = await fetch(`${baseUrl}/api/doctor/portal/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({ bio: longBio }),
  });
  assert.equal(longBioRes.status, 400);

  // 7. Non-doctor access denied (patient token)
  const pLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@cares.org', password: 'Patient@12345' }),
  });
  const { token: pToken } = await pLogin.json();

  const patientForbiddenRes = await fetch(`${baseUrl}/api/doctor/portal/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pToken}` },
    body: JSON.stringify({ consultationFee: 500 }),
  });
  assert.equal(patientForbiddenRes.status, 403);
});

test('Milestone 6: Doctor availability scheduling controls intake, slots, and enforces conflict protections', async () => {
  const docLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dr.maya@cares.org', password: 'Doctor@12345' }),
  });
  const { token: docToken } = await docLogin.json();

  const pLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@cares.org', password: 'Patient@12345' }),
  });
  const { token: pToken } = await pLogin.json();

  const docProfile = db.get(`SELECT available_slots_json FROM doctor_profiles WHERE id = 1`);
  const initialSlots = JSON.parse(docProfile.available_slots_json);

  // 1. Pause intake
  const pauseRes = await fetch(`${baseUrl}/api/doctor/portal/availability`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({
      isAcceptingNewPatients: false,
      availableSlots: initialSlots,
    }),
  });
  assert.equal(pauseRes.status, 200);

  // Verify booking is rejected while intake paused
  const futureDate = '2026-12-01';
  const bookWhilePausedRes = await fetch(`${baseUrl}/api/patient/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pToken}` },
    body: JSON.stringify({
      doctor_id: 1,
      preferred_slot: initialSlots[0],
      requested_date: futureDate,
    }),
  });
  assert.equal(bookWhilePausedRes.status, 400);
  const bookPausedData = await bookWhilePausedRes.json();
  assert.equal(bookPausedData.code, 'DOCTOR_NOT_ACCEPTING_REQUESTS');

  // 2. Reopening intake requires non-empty schedule
  const emptyScheduleRes = await fetch(`${baseUrl}/api/doctor/portal/availability`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({
      isAcceptingNewPatients: true,
      availableSlots: [],
    }),
  });
  assert.equal(emptyScheduleRes.status, 400);
  const emptyData = await emptyScheduleRes.json();
  assert.equal(emptyData.code, 'SCHEDULE_REQUIRED_FOR_INTAKE');

  // 3. Reopen intake with slots including new slots '07:30 AM' and '05:45 PM'
  const expandedSlots = [...initialSlots, '07:30 AM', '05:45 PM'];
  const reopenRes = await fetch(`${baseUrl}/api/doctor/portal/availability`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({
      isAcceptingNewPatients: true,
      availableSlots: expandedSlots,
    }),
  });
  assert.equal(reopenRes.status, 200);
  const reopenData = await reopenRes.json();
  assert.ok(reopenData.data.availableSlots.includes('07:30 AM'));

  // Verify DOCTOR_AVAILABILITY_UPDATED audit
  const audit = db.get(
    `SELECT * FROM audit_events WHERE action = 'DOCTOR_AVAILABILITY_UPDATED' ORDER BY id DESC LIMIT 1`
  );
  assert.ok(audit, 'DOCTOR_AVAILABILITY_UPDATED audit record must exist');

  // 4. Booking newly added slot now succeeds
  const bookNewSlotRes = await fetch(`${baseUrl}/api/patient/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pToken}` },
    body: JSON.stringify({
      doctor_id: 1,
      preferred_slot: '07:30 AM',
      requested_date: futureDate,
    }),
  });
  assert.equal(bookNewSlotRes.status, 201);
  const bookNewSlotData = await bookNewSlotRes.json();
  assert.ok(bookNewSlotData.data.id);

  // 5. Attempting to remove '07:30 AM' is blocked with 409 because active booking exists
  const removeConflictRes = await fetch(`${baseUrl}/api/doctor/portal/availability`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({
      isAcceptingNewPatients: true,
      availableSlots: initialSlots, // Excludes '07:30 AM'
    }),
  });
  assert.equal(removeConflictRes.status, 409);
  const removeConflictData = await removeConflictRes.json();
  assert.equal(removeConflictData.code, 'SLOT_REMOVAL_CONFLICT');
  assert.ok(removeConflictData.error.includes('07:30 AM'));

  // 6. Removing an unbooked slot ('05:45 PM') succeeds
  const slotsWithout545 = [...initialSlots, '07:30 AM'];
  const removeUnbookedRes = await fetch(`${baseUrl}/api/doctor/portal/availability`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({
      isAcceptingNewPatients: true,
      availableSlots: slotsWithout545,
    }),
  });
  assert.equal(removeUnbookedRes.status, 200);

  // 7. Duplicate and malformed slots rejected
  const dupRes = await fetch(`${baseUrl}/api/doctor/portal/availability`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({
      isAcceptingNewPatients: true,
      availableSlots: ['09:00 AM', '09:00 AM'],
    }),
  });
  assert.equal(dupRes.status, 400);

  const malformedRes = await fetch(`${baseUrl}/api/doctor/portal/availability`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({
      isAcceptingNewPatients: true,
      availableSlots: ['25:99 XX'],
    }),
  });
  assert.equal(malformedRes.status, 400);
});

test('Milestone 6: Patient profile update succeeds, enforces strict isolation, and validates fields', async () => {
  const pLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@cares.org', password: 'Patient@12345' }),
  });
  const { token: pToken } = await pLogin.json();

  // 1. Successful update of patient profile
  const updateRes = await fetch(`${baseUrl}/api/patient/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pToken}`,
    },
    body: JSON.stringify({
      full_name: 'Ananya Sharma Updated',
      phone: '+91-9876543210',
      gender: 'Female',
      date_of_birth: '1995-08-20',
      emergency_contact: 'Vikram Sharma (+91-9876543211)',
      city: 'Mohali',
    }),
  });

  assert.equal(updateRes.status, 200);
  const updateData = await updateRes.json();
  assert.equal(updateData.success, true);
  assert.equal(updateData.data.full_name, 'Ananya Sharma Updated');
  assert.equal(updateData.data.phone, '+91-9876543210');
  assert.equal(updateData.data.gender, 'Female');
  assert.equal(updateData.data.date_of_birth, '1995-08-20');
  assert.equal(updateData.data.emergency_contact, 'Vikram Sharma (+91-9876543211)');
  assert.equal(updateData.data.city, 'Mohali');

  // Verify PATIENT_PROFILE_UPDATED audit
  const audit = db.get(
    `SELECT * FROM audit_events WHERE action = 'PATIENT_PROFILE_UPDATED' ORDER BY id DESC LIMIT 1`
  );
  assert.ok(audit, 'PATIENT_PROFILE_UPDATED audit record must exist');

  // Verify GET /api/patient/dashboard returns the updated profile
  const dashRes = await fetch(`${baseUrl}/api/patient/dashboard`, {
    headers: { Authorization: `Bearer ${pToken}` },
  });
  const dashData = await dashRes.json();
  assert.equal(dashData.data.profile.full_name, 'Ananya Sharma Updated');
  assert.equal(dashData.data.profile.city, 'Mohali');

  // 2. Reject future date of birth
  const futureDobRes = await fetch(`${baseUrl}/api/patient/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pToken}` },
    body: JSON.stringify({ date_of_birth: '2099-01-01' }),
  });
  assert.equal(futureDobRes.status, 400);
  const futureDobData = await futureDobRes.json();
  assert.equal(futureDobData.code, 'FUTURE_DOB_NOT_ALLOWED');

  // 3. Reject invalid phone number
  const badPhoneRes = await fetch(`${baseUrl}/api/patient/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pToken}` },
    body: JSON.stringify({ phone: '123' }),
  });
  assert.equal(badPhoneRes.status, 400);

  // 4. Reject mass assignment / protected fields (e.g. role, status, user_id, password_hash)
  const massAssignRes = await fetch(`${baseUrl}/api/patient/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pToken}` },
    body: JSON.stringify({ role: 'admin', status: 'active', user_id: 99 }),
  });
  assert.equal(massAssignRes.status, 400);
  const massAssignData = await massAssignRes.json();
  assert.equal(massAssignData.code, 'DISALLOWED_FIELD');

  // 5. Non-patient access denied
  const docLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dr.maya@cares.org', password: 'Doctor@12345' }),
  });
  const { token: docToken } = await docLogin.json();

  const docForbiddenRes = await fetch(`${baseUrl}/api/patient/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({ full_name: 'Attempted Doctor Overwrite' }),
  });
  assert.equal(docForbiddenRes.status, 403);

  // 6. Patient-to-patient isolation: another patient cannot modify target patient's profile
  const p2Reg = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `isolated_patient_${Date.now()}@example.com`,
      password: 'Patient@12345',
      full_name: 'Second Patient',
      phone: '555-9988',
      gender: 'Male',
    }),
  });
  const { token: p2Token } = await p2Reg.json();

  // Patient 2 updates their own profile
  const p2Update = await fetch(`${baseUrl}/api/patient/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p2Token}` },
    body: JSON.stringify({ full_name: 'Second Patient Modified', city: 'Panchkula' }),
  });
  assert.equal(p2Update.status, 200);

  // Patient 1's profile remains untouched
  const p1Check = await fetch(`${baseUrl}/api/patient/dashboard`, {
    headers: { Authorization: `Bearer ${pToken}` },
  });
  const p1CheckData = await p1Check.json();
  assert.equal(p1CheckData.data.profile.full_name, 'Ananya Sharma Updated');
  assert.equal(p1CheckData.data.profile.city, 'Mohali');

  // Verify patient appointments remain intact
  assert.ok(Array.isArray(p1CheckData.data.appointments));
});

test('Milestone 7: Production JWT configuration enforcement rejects unsafe secrets and accepts valid keys', () => {
  // 1. Missing or blank secret in production throws
  assert.throws(
    () => validateJwtSecret('', 'production'),
    /FATAL: JWT_SECRET environment variable is missing or blank/
  );
  assert.throws(
    () => validateJwtSecret('   ', 'production'),
    /FATAL: JWT_SECRET environment variable is missing or blank/
  );
  assert.throws(
    () => validateJwtSecret(null, 'production'),
    /FATAL: JWT_SECRET environment variable is missing or blank/
  );

  // 2. Known development fallback secret in production throws
  assert.throws(
    () => validateJwtSecret(DEVELOPMENT_JWT_SECRET, 'production'),
    /FATAL: Insecure development JWT_SECRET cannot be used in production mode/
  );

  // 3. Short secret (< 32 chars) in production throws
  assert.throws(
    () => validateJwtSecret('short-secret-key-12345', 'production'),
    /FATAL: JWT_SECRET must be at least 32 characters long in production/
  );

  // 4. Valid strong secret in production passes without error
  const validProductionSecret = 'a_very_secure_and_long_production_jwt_secret_key_exceeding_32_characters';
  assert.doesNotThrow(() => validateJwtSecret(validProductionSecret, 'production'));

  // 5. Test buildConfig and validateConfig integration
  const prodConfigUnsafe = buildConfig({ NODE_ENV: 'production', JWT_SECRET: DEVELOPMENT_JWT_SECRET });
  assert.throws(() => validateConfig(prodConfigUnsafe), /Insecure development JWT_SECRET/);

  const prodConfigValid = buildConfig({ NODE_ENV: 'production', JWT_SECRET: validProductionSecret });
  assert.equal(validateConfig(prodConfigValid), true);

  // 6. In development, missing secret safely uses fallback
  const devConfig = buildConfig({ NODE_ENV: 'development' });
  assert.equal(devConfig.jwtSecret, DEVELOPMENT_JWT_SECRET);
});

test('Milestone 7: HTTP security headers are enforced and X-Powered-By is disabled', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);

  // Assert X-Powered-By is strictly omitted
  assert.equal(res.headers.get('x-powered-by'), null);

  // Assert standard security headers
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.equal(res.headers.get('cross-origin-resource-policy'), 'cross-origin');

  const csp = res.headers.get('content-security-policy');
  assert.ok(csp && csp.includes("default-src 'none'"));

  // Assert HSTS is set when request simulates HTTPS via proxy
  const httpsRes = await fetch(`${baseUrl}/api/health`, {
    headers: { 'x-forwarded-proto': 'https' },
  });
  const hsts = httpsRes.headers.get('strict-transport-security');
  assert.ok(hsts && hsts.includes('max-age=31536000'));
});

test('Milestone 7: Authentication rate limiting rejects excessive requests with HTTP 429 and standard format', async () => {
  // Create an isolated limiter to test threshold enforcement deterministically
  const testLimiter = createAuthRateLimiter({
    windowMs: 60000,
    maxRequests: 3,
    message: 'Too many authentication attempts for test.',
  });

  let nextCalled = 0;
  const mockNext = () => { nextCalled += 1; };

  const fakeReq = { ip: '192.168.1.100', socket: { remoteAddress: '192.168.1.100' } };
  let lastStatus = 200;
  let lastJson = null;
  const headersSet = {};

  const fakeRes = {
    setHeader(key, val) { headersSet[key] = val; },
    status(code) {
      lastStatus = code;
      return {
        json(body) { lastJson = body; return body; },
      };
    },
  };

  // First 3 requests should pass
  testLimiter(fakeReq, fakeRes, mockNext);
  assert.equal(nextCalled, 1);
  assert.equal(headersSet['RateLimit-Remaining'], 2);

  testLimiter(fakeReq, fakeRes, mockNext);
  assert.equal(nextCalled, 2);
  assert.equal(headersSet['RateLimit-Remaining'], 1);

  testLimiter(fakeReq, fakeRes, mockNext);
  assert.equal(nextCalled, 3);
  assert.equal(headersSet['RateLimit-Remaining'], 0);

  // 4th request must be rejected with HTTP 429
  testLimiter(fakeReq, fakeRes, mockNext);
  assert.equal(nextCalled, 3); // next was NOT called
  assert.equal(lastStatus, 429);
  assert.equal(lastJson.success, false);
  assert.equal(lastJson.code, 'TOO_MANY_REQUESTS');
  assert.ok(lastJson.retryAfterSeconds > 0);
  assert.ok(headersSet['Retry-After'] > 0);

  // Limiter reset clears store
  testLimiter.reset();
  testLimiter(fakeReq, fakeRes, mockNext);
  assert.equal(nextCalled, 4); // Passes again after reset
});

test('Safety Guard: resolveDatabasePath anchors relative paths to backend root consistently', () => {
  const backendRoot = path.resolve(__dirname, '..');

  // Standard relative paths
  assert.equal(resolveDatabasePath('./data/cares.db'), path.resolve(backendRoot, 'data/cares.db'));
  assert.equal(resolveDatabasePath('data/cares.demo.db'), path.resolve(backendRoot, 'data/cares.demo.db'));
  assert.equal(resolveDatabasePath('data\\cares.demo.db'), path.resolve(backendRoot, 'data/cares.demo.db'));

  // Traversal paths
  assert.equal(resolveDatabasePath('./data/../data/cares.db'), path.resolve(backendRoot, 'data/cares.db'));

  // Absolute path preserved
  const absPath = path.resolve('C:/some/custom/isolated.db');
  assert.equal(resolveDatabasePath(absPath), absPath);

  // Whitespace trimming
  assert.equal(resolveDatabasePath('  ./data/cares.db  '), path.resolve(backendRoot, 'data/cares.db'));

  // Non-string or empty input safely returns empty string
  assert.equal(resolveDatabasePath(''), '');
  assert.equal(resolveDatabasePath(null), '');
  assert.equal(resolveDatabasePath(undefined), '');
});

test('Safety Guard: isLiveDatabase correctly identifies live database variants and rejects non-live paths', () => {
  const backendRoot = path.resolve(__dirname, '..');
  const liveAbs = path.resolve(backendRoot, 'data/cares.db');

  // Must identify live database variants
  assert.equal(isLiveDatabase('./data/cares.db'), true);
  assert.equal(isLiveDatabase('data\\cares.db'), true);
  assert.equal(isLiveDatabase('DATA/CARES.DB'), true);
  assert.equal(isLiveDatabase('./data/../data/cares.db'), true);
  assert.equal(isLiveDatabase(liveAbs), true);
  assert.equal(isLiveDatabase(liveAbs.toUpperCase()), true);
  assert.equal(isLiveDatabase('   ./data/cares.db   '), true);

  // Must reject test and demo databases
  assert.equal(isLiveDatabase('./data/cares.demo.db'), false);
  assert.equal(isLiveDatabase('./data/cares.test.db'), false);
  assert.equal(isLiveDatabase('data\\cares.test-isolated.db'), false);
  assert.equal(isLiveDatabase(''), false);
  assert.equal(isLiveDatabase(null), false);
  assert.equal(isLiveDatabase(undefined), false);
});

test('Safety Guard: seedDatabase strictly refuses execution against live database without modifying data', async () => {
  await assert.rejects(
    async () => {
      await seedDatabase('./data/cares.db');
    },
    {
      name: 'Error',
      message: /CRITICAL SAFETY GUARD: Database seeding is refused because the target database/
    }
  );

  await assert.rejects(
    async () => {
      await seedDatabase('data\\cares.db');
    },
    /CRITICAL SAFETY GUARD/
  );

  await assert.rejects(
    async () => {
      await seedDatabase('DATA/CARES.DB');
    },
    /CRITICAL SAFETY GUARD/
  );
});

test('Safety Guard: correctMilestone4Data script safely exits when --confirm-correction is omitted', () => {
  const scriptPath = path.resolve(__dirname, '../src/scripts/correctMilestone4Data.js');
  const res = spawnSync(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      TARGET_DATABASE_PATH: './data/cares.test-dummy-unconfirmed.db'
    },
    encoding: 'utf-8'
  });

  assert.equal(res.status, 0);
  assert.match(res.stderr, /SAFETY GUARD: Milestone 4\.1 data correction script requires explicit confirmation/);
  assert.match(res.stderr, /To run this correction against the configured database, re-run with: --confirm-correction/);
});

test('Safety Guard: correctMilestone4Data script refuses live database if --allow-live-correction is omitted', () => {
  const scriptPath = path.resolve(__dirname, '../src/scripts/correctMilestone4Data.js');
  const res = spawnSync(process.execPath, [scriptPath, '--confirm-correction'], {
    env: {
      ...process.env,
      TARGET_DATABASE_PATH: './data/cares.db'
    },
    encoding: 'utf-8'
  });

  assert.equal(res.status, 1);
  assert.match(res.stderr, /CRITICAL SAFETY GUARD: Target database resolves to the protected live database/);
});
