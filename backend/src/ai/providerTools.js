import { db } from '../db/database.js';
const specialties = ['Cardiology','Dermatology','Orthopedics','Pediatrics','General Medicine'];
export function validateTool(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('Invalid lookup.'),{status:400});
  const {type,query='',specialty=''}=body;
  if (!['doctors','hospitals','specialties','departments','my_appointments'].includes(type) || typeof query !== 'string' || query.length>80 || typeof specialty !== 'string' || specialty.length>80 || Object.keys(body).some(k=>!['type','query','specialty'].includes(k))) throw Object.assign(new Error('Unsupported lookup parameters.'),{status:400});
  return {type,query:query.trim(),specialty:specialty.trim()};
}
export async function lookup(body,user) {
  const {type,query,specialty}=validateTool(body);
  // Escape LIKE metacharacters so searches remain literal. All SQL parameters bound.
  const pattern = `%${query.replace(/[\\%_]/g,'\\$&')}%`;
  if (type==='specialties') return { type, data: await db.all('SELECT DISTINCT specialty FROM doctor_profiles ORDER BY specialty LIMIT 100') };
  if (type==='doctors') return { type, data: await db.all(`SELECT id, full_name, specialty, is_synthetic, provenance_status, source_url, verification_status, is_verified FROM doctor_profiles WHERE LOWER(full_name || ' ' || specialty) LIKE LOWER(?) ESCAPE '\\' AND (? = '' OR LOWER(specialty) = LOWER(?) OR LOWER(specialty) LIKE LOWER(?) ESCAPE '\\') ORDER BY id LIMIT 20`,[pattern,specialty,specialty,`${specialty.replace(/[\\%_]/g,'\\$&')} · %`]) };
  if (type==='hospitals' || type==='departments') {
    const rows = await db.all(`SELECT id, name, city, departments_json, emergency_available, operating_hours_json, is_synthetic, provenance_status, source_url, verification_status, is_verified FROM hospitals WHERE LOWER(name || ' ' || city || ' ' || departments_json) LIKE LOWER(?) ESCAPE '\\' ORDER BY id LIMIT 20`, [pattern]);
    return { type, data:rows.map(r=>({...r,departments:JSON.parse(r.departments_json || '[]'),hours:JSON.parse(r.operating_hours_json || '{}')})) };
  }
  if (!user || user.role!=='patient') throw Object.assign(new Error('Patient authentication is required.'),{status:403});
  // Identity is only the verified JWT principal, never a caller/LLM supplied ID.
  return { type, private:true, data:await db.all(`SELECT a.id, a.status, a.requested_date, a.preferred_slot, d.full_name AS doctor_name FROM appointment_requests a JOIN patient_profiles p ON p.id=a.patient_id JOIN doctor_profiles d ON d.id=a.doctor_id WHERE p.user_id=? ORDER BY a.id DESC LIMIT 20`,[user.id]) };
}
export {specialties};
