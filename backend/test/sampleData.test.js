import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../src/db/migrate.js';
import { addSampleData, sampleAccounts } from '../src/scripts/addSampleData.js';

const passwords = Object.fromEntries(sampleAccounts.map(account => [account.key, 'Synthetic-test-only@12345']));
async function withDatabase(callback) {
  const engine = new PGlite();
  const client = { query: (sql, params = []) => !params.length && sql.split(';').filter(part => part.trim()).length > 1 ? engine.exec(sql).then(results => results.at(-1)) : engine.query(sql, params) };
  try { await migrate(client); await callback(client); }
  finally { await engine.close(); }
}

test('Sample PostgreSQL import preserves existing accounts, labels fictional data, hashes passwords, and is safe to repeat', async () => {
  await withDatabase(async client => {
    await client.query("INSERT INTO users (email,password_hash,role) VALUES ('existing@example.com','untouched-test-hash','patient')");
    const result = await addSampleData(client, passwords);
    assert.equal(result.imported, true);
    assert.equal(result.doctors, 3);
    assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count, 7);
    assert.equal((await client.query("SELECT password_hash FROM users WHERE email='existing@example.com'")).rows[0].password_hash, 'untouched-test-hash');
    const admin = (await client.query('SELECT password_hash FROM users WHERE email=$1', ['demo.admin@example.com'])).rows[0];
    assert.notEqual(admin.password_hash, passwords.admin);
    assert.equal(await bcrypt.compare(passwords.admin, admin.password_hash), true);
    const doctors = (await client.query('SELECT is_synthetic, is_verified, registration_check_status, provenance_status FROM doctor_profiles')).rows;
    assert.equal(doctors.length, 3);
    assert.ok(doctors.every(doctor => doctor.is_synthetic === 1 && doctor.is_verified === 0 && doctor.registration_check_status === 'unchecked' && doctor.provenance_status === 'synthetic_demo'));
    const hospital = (await client.query('SELECT is_synthetic, emergency_available FROM hospitals')).rows[0];
    assert.equal(hospital.is_synthetic, 1);
    assert.equal(hospital.emergency_available, null);
    assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM home_care_requests')).rows[0].count, 1);
    assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM verification_applications')).rows[0].count, 1);
    const appointment = (await client.query('SELECT requested_date,is_demo_request FROM appointment_requests')).rows[0];
    assert.ok(appointment.requested_date > new Date().toISOString().slice(0, 10));
    assert.equal(appointment.is_demo_request, 1);
    assert.equal((await addSampleData(client, passwords)).imported, false);
    assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count, 7);
    assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM appointment_requests')).rows[0].count, 1);
  });
});

test('Sample import rejects conflicting accounts without changing the existing account', async () => {
  await withDatabase(async client => {
    await client.query("INSERT INTO users (email,password_hash,role) VALUES ('demo.admin@example.com','existing-hash','patient')");
    await assert.rejects(() => addSampleData(client, passwords), /sample email already exists/);
    assert.deepEqual((await client.query('SELECT email,password_hash,role FROM users')).rows, [{ email: 'demo.admin@example.com', password_hash: 'existing-hash', role: 'patient' }]);
    assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM doctor_profiles')).rows[0].count, 0);
  });
});

test('Sample import rolls back newly inserted accounts if a later insert fails', async () => {
  await withDatabase(async client => {
    const failingClient = { query: (sql, params) => {
      if (sql.startsWith('INSERT INTO hospitals')) throw new Error('Synthetic mid-import failure');
      return client.query(sql, params);
    } };
    await assert.rejects(() => addSampleData(failingClient, passwords), /Synthetic mid-import failure/);
    assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count, 0);
    assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM patient_profiles')).rows[0].count, 0);
    assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM audit_events')).rows[0].count, 0);
  });
});
