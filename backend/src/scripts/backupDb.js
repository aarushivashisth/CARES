import { getDb } from '../db/connection.js';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function backupDatabase() {
  const db = getDb();
  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dataDir = path.resolve(__dirname, '../../data');
  const src = path.join(dataDir, 'cares.db');
  const dest = path.join(dataDir, `cares.db.backup.${timestamp}`);

  if (!fs.existsSync(src)) {
    throw new Error(`Source database not found at ${src}`);
  }

  fs.copyFileSync(src, dest);

  // Verify backup readability
  const testDb = new DatabaseSync(dest);
  const docCount = testDb.prepare('SELECT count(*) as count FROM doctor_profiles').get().count;
  const hospCount = testDb.prepare('SELECT count(*) as count FROM hospitals').get().count;
  const userCount = testDb.prepare('SELECT count(*) as count FROM users').get().count;
  const apptCount = testDb.prepare('SELECT count(*) as count FROM appointment_requests').get().count;
  const verifCount = testDb.prepare('SELECT count(*) as count FROM verification_applications').get().count;
  testDb.close();

  const backupInfo = {
    backupPath: dest,
    verified: true,
    records: {
      users: userCount,
      doctors: docCount,
      hospitals: hospCount,
      appointments: apptCount,
      verifications: verifCount
    }
  };

  console.log('✅ SQLite database backed up successfully:');
  console.log(JSON.stringify(backupInfo, null, 2));
  return backupInfo;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    backupDatabase();
  } catch (err) {
    console.error('❌ Backup failed:', err);
    process.exit(1);
  }
}
