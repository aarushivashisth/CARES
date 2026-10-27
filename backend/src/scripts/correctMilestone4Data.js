import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../../data/cares.db');
const backupPath = path.resolve(__dirname, `../../data/cares.db.backup.${new Date().toISOString().replace(/[:.]/g, '-')}`);

console.log('=== Milestone 4.1 Hospital Data Integrity Correction ===');
console.log(`Database Path: ${dbPath}`);
console.log(`Backup Target: ${backupPath}`);

if (!fs.existsSync(dbPath)) {
  console.error(`Error: Database not found at ${dbPath}`);
  process.exit(1);
}

// 1. Checkpoint WAL and create verified backup
console.log('\n1. Checkpointing WAL and creating backup...');
const dbBefore = new DatabaseSync(dbPath);
try {
  dbBefore.exec('PRAGMA wal_checkpoint(FULL);');
} catch (e) {
  console.warn('WAL checkpoint note:', e.message);
}
dbBefore.close();

fs.copyFileSync(dbPath, backupPath);

// Verify backup
if (!fs.existsSync(backupPath)) {
  console.error('CRITICAL: Backup file was not created!');
  process.exit(1);
}

const originalSize = fs.statSync(dbPath).size;
const backupSize = fs.statSync(backupPath).size;
console.log(`Backup created successfully. Size: ${backupSize} bytes (Original: ${originalSize} bytes)`);

const backupDb = new DatabaseSync(backupPath, { open: true, readOnly: true });
const backupCounts = {
  users: backupDb.prepare('SELECT COUNT(*) as count FROM users').get().count,
  doctors: backupDb.prepare('SELECT COUNT(*) as count FROM doctor_profiles').get().count,
  hospitals: backupDb.prepare('SELECT COUNT(*) as count FROM hospitals').get().count,
  appointments: backupDb.prepare('SELECT COUNT(*) as count FROM appointment_requests').get().count,
  auditEvents: backupDb.prepare('SELECT COUNT(*) as count FROM audit_events').get().count,
};
backupDb.close();
console.log('Verified backup contents:', backupCounts);

// 2. Perform narrowly scoped update on live database
console.log('\n2. Inspecting existing hospital records before update...');
const db = new DatabaseSync(dbPath);

const beforeRecords = db.prepare('SELECT id, name, is_synthetic, provenance_status, is_verified, verification_status FROM hospitals ORDER BY id ASC').all();
console.log('Hospitals before update:');
console.table(beforeRecords);

// Read facility metadata from localProvidersChandigarhMohali.json
const jsonPath = path.resolve(__dirname, '../data/localProvidersChandigarhMohali.json');
const dataset = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
const facilitiesJson = dataset.facilities || [];

console.log('\n3. Applying precision updates to records 2, 3, 4...');
const updateStmt = db.prepare(`
  UPDATE hospitals 
  SET 
    is_synthetic = 0,
    departments_json = ?,
    source_url = ?,
    source_organization = ?,
    last_checked_date = ?,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = ? 
    AND LOWER(TRIM(name)) = LOWER(TRIM(?))
    AND provenance_status = 'publicly_sourced'
`);

db.exec('BEGIN TRANSACTION');
try {
  let updatedCount = 0;
  for (const fac of facilitiesJson) {
    const existing = db.prepare('SELECT id, name, is_synthetic, provenance_status FROM hospitals WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))').get(fac.name);
    if (!existing) {
      console.warn(`Facility "${fac.name}" not found in database.`);
      continue;
    }

    if (existing.id === 1) {
      console.warn(`Skipping synthetic facility ID 1: "${existing.name}"`);
      continue;
    }

    const deptsJson = JSON.stringify(fac.departments || []);
    const sourceUrl = fac.sourceUrl || null;
    const sourceOrg = fac.sourceOrganization || null;
    const lastChecked = fac.lastCheckedDate || '2026-10-27';

    const info = updateStmt.run(
      deptsJson,
      sourceUrl,
      sourceOrg,
      lastChecked,
      existing.id,
      fac.name
    );

    console.log(`Updated facility ID ${existing.id} ("${fac.name}"): changes = ${info.changes}`);
    updatedCount += Number(info.changes);
  }

  db.exec('COMMIT');
  console.log(`\nSuccessfully updated ${updatedCount} records.`);
} catch (err) {
  db.exec('ROLLBACK');
  console.error('Update failed, rolled back:', err);
  db.close();
  process.exit(1);
}

// 3. Verify final state of live database
console.log('\n4. Verifying post-update hospital records in live database...');
const afterRecords = db.prepare(`
  SELECT 
    id, name, is_synthetic, provenance_status, is_verified, verification_status,
    LENGTH(departments_json) as depts_len, source_organization, last_checked_date
  FROM hospitals 
  ORDER BY id ASC
`).all();
console.table(afterRecords);

// Safety assertions
const riverside = afterRecords.find((h) => h.id === 1);
if (!riverside || riverside.is_synthetic !== 1 || riverside.provenance_status !== 'synthetic_demo') {
  console.error('SAFETY VIOLATION: Riverside Community Health Center was improperly modified!');
  db.close();
  process.exit(1);
}

for (const pubId of [2, 3, 4]) {
  const pub = afterRecords.find((h) => h.id === pubId);
  if (!pub) {
    console.error(`SAFETY VIOLATION: Hospital ID ${pubId} is missing!`);
    db.close();
    process.exit(1);
  }
  if (pub.is_synthetic !== 0) {
    console.error(`SAFETY VIOLATION: Hospital ID ${pubId} does not have is_synthetic = 0!`);
    db.close();
    process.exit(1);
  }
  if (pub.is_verified !== 0 || pub.verification_status !== 'unverified') {
    console.error(`SAFETY VIOLATION: Hospital ID ${pubId} was marked verified or has non-unverified status!`);
    db.close();
    process.exit(1);
  }
}

db.close();
console.log('\n=== All safety constraints passed! Data integrity update complete. ===');
