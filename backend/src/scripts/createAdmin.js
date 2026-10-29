import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { config } from '../config/env.js';
import { db } from '../db/database.js';
export async function bootstrapAdmin(adapter,email,password) {
  const normalized=email?.trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || !password || password.length<12 || Buffer.byteLength(password)>72) throw new Error('Invalid private bootstrap credentials.');
  return adapter.transaction(async tx=>{
    if (await tx.get('SELECT id FROM users WHERE LOWER(email)=LOWER(?)',[normalized])) throw new Error('Account already exists.');
    const user=await tx.run("INSERT INTO users (email,password_hash,role,status) VALUES (?,?,'admin','active')",[normalized,await bcrypt.hash(password,12)]);
    await tx.run("INSERT INTO audit_events (actor_user_id,action,target_type,target_id) VALUES (?,'OWNER_ADMIN_BOOTSTRAP','USER',?)",[user.lastInsertRowid,user.lastInsertRowid]);
  });
}
// CLI-only variables; set privately for this one-time owner-run action.
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  if (!process.argv.includes('--confirm-admin-create') || !config.databaseUrl) throw new Error('Explicit owner confirmation and DATABASE_URL required.');
  try {
    await bootstrapAdmin(db,process.env.ADMIN_BOOTSTRAP_EMAIL,process.env.ADMIN_BOOTSTRAP_PASSWORD);
    console.log('Administrator created; no demo accounts or provider verification records added. Clear the bootstrap password from your shell environment.');
  } catch { console.error('Administrator creation failed. Inspect configuration and account uniqueness privately.');process.exitCode=1; }
  finally {await db.close();}
}
