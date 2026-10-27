import { getDb } from '../db/connection.js';

export function checkDuplicates() {
  const db = getDb();

  console.log('--- Duplicate Hospital Names (Normalized) ---');
  const hospDupes = db.prepare(`
    SELECT LOWER(TRIM(name)) AS norm_name, COUNT(*) AS cnt, GROUP_CONCAT(id) as ids, GROUP_CONCAT(name) as names 
    FROM hospitals 
    GROUP BY LOWER(TRIM(name)) 
    HAVING cnt > 1
  `).all();
  console.log('Hospital duplicates found:', hospDupes.length);
  if (hospDupes.length > 0) console.table(hospDupes);

  console.log('\n--- Duplicate Doctor License Numbers (Non-null) ---');
  const docDupes = db.prepare(`
    SELECT LOWER(TRIM(license_number)) AS norm_lic, COUNT(*) AS cnt, GROUP_CONCAT(id) as ids, GROUP_CONCAT(full_name) as names 
    FROM doctor_profiles 
    WHERE license_number IS NOT NULL AND TRIM(license_number) != '' 
    GROUP BY LOWER(TRIM(license_number)) 
    HAVING cnt > 1
  `).all();
  console.log('Doctor license duplicates found:', docDupes.length);
  if (docDupes.length > 0) console.table(docDupes);

  return { hospDupes, docDupes };
}

if (process.argv[1] && process.argv[1].endsWith('checkDuplicates.js')) {
  checkDuplicates();
}
