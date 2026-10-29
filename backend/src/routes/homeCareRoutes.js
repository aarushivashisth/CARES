import { Router } from '../middleware/asyncRouter.js';
import { db } from '../db/database.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';

const router = Router();
export const SERVICES = [
  { id: 'nursing', name: 'Nursing support enquiry' },
  { id: 'physiotherapy', name: 'Home physiotherapy enquiry' },
  { id: 'elder_support', name: 'Non-emergency elder support enquiry' },
];
const transitions = { requested: ['under_review','declined'], under_review: ['contacted','declined'], contacted: ['closed','declined'] };
const fail = (res, status, error) => res.status(status).json({ success: false, error });
router.get('/services', (req, res) => res.json({ success: true, data: SERVICES }));
router.use(authenticateToken, requireRole('patient','admin'));
async function owner(req) { return db.get('SELECT id FROM patient_profiles WHERE user_id = ?', [req.user.id]); }
async function find(req) {
  if (!/^\d+$/.test(req.params.id)) return null;
  return db.get(`SELECT * FROM home_care_requests WHERE id = ? ${req.user.role === 'admin' ? '' : 'AND patient_id = (SELECT id FROM patient_profiles WHERE user_id = ?)'}`, req.user.role === 'admin' ? [Number(req.params.id)] : [Number(req.params.id), req.user.id]);
}
router.get('/', async (req,res) => {
  const admin = req.user.role === 'admin';
  const rows = await db.all(`SELECT id, service_type, requested_date, city, status, created_at FROM home_care_requests ${admin ? '' : 'WHERE patient_id = (SELECT id FROM patient_profiles WHERE user_id = ?)'} ORDER BY id DESC LIMIT 100`, admin ? [] : [req.user.id]);
  res.json({ success: true, data: rows });
});
router.get('/:id', async (req,res) => {
  const row = await find(req);
  if (!row) return fail(res,404,'Request not found.');
  const history = await db.all('SELECT status, created_at FROM home_care_history WHERE request_id = ? ORDER BY id', [row.id]);
  res.setHeader('Cache-Control','no-store');
  res.json({ success: true, data: { ...row, history } });
});
router.post('/', requireRole('patient'), async (req,res) => {
  const body = req.body;
  const fields = ['service_type','requested_date','contact_phone','address','city'];
  if (Object.keys(body).some(k => !fields.includes(k))) return fail(res,400,'Unsupported field. Do not include health information.');
  if (!SERVICES.some(s => s.id === body.service_type)) return fail(res,400,'Choose a supported service.');
  const date = body.requested_date;
  const today = new Date().toISOString().slice(0,10);
  const horizon = new Date(Date.now()+90*86400000).toISOString().slice(0,10);
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date || date < today || date > horizon) return fail(res,400,'Request date must be a real date within the next 90 days.');
  if (typeof body.contact_phone !== 'string' || !/^\+?[\d ()-]{7,25}$/.test(body.contact_phone) || body.contact_phone.replace(/\D/g,'').length < 7) return fail(res,400,'Enter a valid contact phone.');
  for (const [key,min,max] of [['address',8,240],['city',2,80]]) {
    if (typeof body[key] !== 'string' || body[key].trim().length < min || body[key].length > max || /[\x00-\x1f]/.test(body[key])) return fail(res,400,`Enter a valid ${key}.`);
  }
  const profile = await owner(req);
  if (!profile) return fail(res,404,'Patient profile not found.');
  const id = await db.transaction(async tx => {
    const result = await tx.run('INSERT INTO home_care_requests (patient_id, service_type, requested_date, contact_phone, address, city) VALUES (?, ?, ?, ?, ?, ?)', [profile.id,body.service_type,date,body.contact_phone.trim(),body.address.trim(),body.city.trim()]);
    await tx.run('INSERT INTO home_care_history (request_id, status, changed_by_user_id) VALUES (?, ?, ?)', [result.lastInsertRowid,'requested',req.user.id]);
    await tx.run("INSERT INTO audit_events (actor_user_id, action, target_type, target_id) VALUES (?, 'HOME_CARE_CREATED', 'HOME_CARE', ?)", [req.user.id,result.lastInsertRowid]);
    return result.lastInsertRowid;
  });
  res.status(201).json({ success: true, data: { id, status: 'requested' }, message: 'Enquiry received. This is not a confirmed booking or provider assignment.' });
});
router.patch('/:id/status', async (req,res) => {
  if (Object.keys(req.body).some(k => k !== 'status')) return fail(res,400,'Only status can be changed.');
  const row = await find(req);
  if (!row) return fail(res,404,'Request not found.');
  const status = req.body.status;
  const allowed = req.user.role === 'patient' ? !['cancelled','declined','closed'].includes(row.status) && status === 'cancelled' : (transitions[row.status] || []).includes(status);
  if (!allowed) return fail(res,409,'This status transition is not allowed.');
  const changed = await db.transaction(async tx => {
    const update = await tx.run("UPDATE home_care_requests SET status = ?, updated_at = datetime('now') WHERE id = ? AND status = ?", [status,row.id,row.status]);
    if (!update.changes) return false;
    await tx.run('INSERT INTO home_care_history (request_id, status, changed_by_user_id) VALUES (?, ?, ?)', [row.id,status,req.user.id]);
    await tx.run("INSERT INTO audit_events (actor_user_id, action, target_type, target_id, details_json) VALUES (?, 'HOME_CARE_STATUS', 'HOME_CARE', ?, ?)", [req.user.id,row.id,JSON.stringify({ from: row.status, to: status })]);
    return true;
  });
  if (!changed) return fail(res,409,'Request changed; refresh and try again.');
  res.json({ success: true, data: { id: row.id, status } });
});
export default router;
