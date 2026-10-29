import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
process.env.NODE_ENV='test';
process.env.DATABASE_URL='postgresql://synthetic-test-never-connected.invalid/test';
// No local SQLite database is opened by this suite.
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cares-postgres-'));
const { migrate }=await import('../src/db/migrate.js');
const { createPostgresDb, configureTestDatabase, postgresSql }=await import('../src/db/database.js');
let engine, pool, adapter, app, server, base;
function poolFor(engine) {
  const wrapper={
    async query(sql,params=[]) {
      if (!params.length && sql.split(';').filter(s=>s.trim()).length>1) {const rows=await engine.exec(sql);return rows.at(-1);}
      return engine.query(sql,params);
    },
    // Embedded engine is single-connection; tests send sequential transactions.
    async connect(){return {...wrapper,release(){}};},
    async end(){await engine.close();},
  };
  return wrapper;
}
before(async()=>{
  engine=new PGlite(path.join(directory,'database'));
  pool=poolFor(engine);await migrate(pool);await migrate(pool);
  adapter=createPostgresDb(pool);configureTestDatabase(adapter);
  const bcrypt=(await import('bcryptjs')).default;
  for(const [email,role] of [['pg.patient@example.com','patient'],['pg.admin@example.com','admin'],['pg.doctor@example.com','doctor'],['pg.other@example.com','patient'],['pg.hospital@example.com','hospital']]) {
    const u=await adapter.run("INSERT INTO users (email,password_hash,role,status) VALUES (?,?,?,'active')",[email,await bcrypt.hash('Synthetic@12345',4),role]);
    if(role==='patient') await adapter.run('INSERT INTO patient_profiles (user_id,full_name,is_synthetic) VALUES (?,?,1)',[u.lastInsertRowid,'Synthetic PostgreSQL patient']);
    if(role==='doctor') await adapter.run("INSERT INTO doctor_profiles (user_id,full_name,specialty,available_slots_json,is_verified,verification_status,is_synthetic) VALUES (?,?,'Cardiology',?,1,'verified',1)",[u.lastInsertRowid,'Synthetic PostgreSQL doctor',JSON.stringify(['09:00 AM','02:00 PM'])]);
    if(role==='hospital') await adapter.run("INSERT INTO hospitals (user_id,name,address,city,state,is_synthetic) VALUES (?,?,?,?,?,1)",[u.lastInsertRowid,'Synthetic PostgreSQL hospital','Synthetic address','Chandigarh','Chandigarh']);
  }
  app=(await import('../src/app.js')).default;
  await new Promise((resolve,reject)=>{server=app.listen(0,'127.0.0.1',resolve);server.on('error',reject);});
  base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{if(server)await new Promise(r=>server.close(r));if(adapter)await adapter.close();fs.rmSync(directory,{recursive:true,force:true});});
async function request(route,token,method='GET',body) {return fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});}
async function login(email){const r=await request('/api/auth/login',null,'POST',{email,password:'Synthetic@12345'});assert.equal(r.status,200);return (await r.json()).token;}

test('PostgreSQL migrations, bound queries, constraints and rollback',async()=>{
  assert.equal((await adapter.all('SELECT version FROM schema_migrations')).length,3);
  assert.equal(postgresSql("SELECT '?' AS text, id FROM users WHERE email = ?"),"SELECT '?' AS text, id FROM users WHERE email = $1");
  await assert.rejects(()=>adapter.transaction(async tx=>{await tx.run("INSERT INTO users (email,password_hash,role) VALUES ('rollback@example.com','synthetic','patient')");throw new Error('rollback test');}),/rollback test/);
  assert.equal(await adapter.get('SELECT id FROM users WHERE email = ?',['rollback@example.com']),undefined);
  await assert.rejects(()=>adapter.run('INSERT INTO patient_profiles (user_id,full_name) VALUES (?,?)',[999999,'Synthetic']),e=>e.code==='23503');
  await assert.rejects(()=>adapter.run("INSERT INTO users (email,password_hash,role) VALUES ('PG.PATIENT@example.com','synthetic','patient')"),e=>e.code==='23505');
});
test('PostgreSQL HTTP: login, search, owned booking, acceptance, conflict and cancellation',async()=>{
  const patient=await login('pg.patient@example.com'), doctor=await login('pg.doctor@example.com'), other=await login('pg.other@example.com');
  assert.equal((await request('/api/hospitals')).status,200);
  assert.equal((await request('/api/doctors')).status,200);
  const date=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
  const body={doctor_id:1,requested_date:date,preferred_slot:'09:00 AM',visit_type:'In-person'};
  const booked=await request('/api/patient/appointments',patient,'POST',body);assert.equal(booked.status,201,JSON.stringify(await booked.clone().json()));
  const id=(await booked.json()).data.id;
  const unauthorized=await request(`/api/patient/appointments/${id}/cancel`,other,'PATCH',{});assert.equal(unauthorized.status,403);
  const accepted=await request(`/api/doctor/portal/appointments/${id}/status`,doctor,'PATCH',{status:'accepted',notes:'Synthetic test only'});assert.equal(accepted.status,200,JSON.stringify(await accepted.clone().json()));
  assert.equal((await request('/api/patient/appointments',other,'POST',body)).status,409);
  const dashboard=await (await request('/api/patient/dashboard',patient)).json();assert.equal(dashboard.data.appointments[0].status,'accepted');
  assert.equal((await request(`/api/patient/appointments/${id}/cancel`,patient,'PATCH',{})).status,200);
  const history=await adapter.all('SELECT status FROM appointment_status_history WHERE appointment_id = ? ORDER BY id',[id]);assert.deepEqual(history.map(r=>r.status),['pending','accepted','cancelled']);
});
test('PostgreSQL HTTP: home care and structured tools use durable owned records',async()=>{
  const patient=await login('pg.patient@example.com'),admin=await login('pg.admin@example.com');
  const response=await request('/api/home-care',patient,'POST',{service_type:'physiotherapy',requested_date:new Date(Date.now()+86400000).toISOString().slice(0,10),contact_phone:'9876543210',address:'Synthetic address for PostgreSQL',city:'Chandigarh'});
  assert.equal(response.status,201);const id=(await response.json()).data.id;
  assert.equal((await request(`/api/home-care/${id}/status`,admin,'PATCH',{status:'under_review'})).status,200);
  assert.equal((await request('/api/ai/lookup',patient,'POST',{type:'my_appointments'})).status,200);
  assert.equal((await request('/api/ai/lookup',null,'POST',{type:'my_appointments'})).status,401);
  const injection=await (await request('/api/ai/lookup',null,'POST',{type:'doctors',query:"' OR 1=1 --"})).json();assert.deepEqual(injection.data.data,[]);
});
test('PostgreSQL HTTP: doctor onboarding to admin credential decision to login',async()=>{
  const res=await request('/api/auth/apply-doctor',null,'POST',{email:'pg.applicant@example.com',password:'Synthetic@12345',full_name:'Synthetic Applicant',license_number:'TEST-PG-ONLY-001',specialty:'Dermatology'});
  assert.equal(res.status,202);
  const restricted=await request('/api/auth/application-login',null,'POST',{email:'pg.applicant@example.com',password:'Synthetic@12345'});
  assert.equal(restricted.status,200);const onboardingToken=(await restricted.json()).token;
  assert.equal((await request('/api/auth/me',onboardingToken)).status,200);
  assert.equal((await request('/api/doctor/portal/verification',onboardingToken)).status,200);
  for(const route of ['/api/doctor/portal/dashboard','/api/doctor/portal/appointments','/api/admin/dashboard'])assert.equal((await request(route,onboardingToken)).status,403);
  assert.equal((await request('/api/auth/login',null,'POST',{email:'pg.applicant@example.com',password:'Synthetic@12345'})).status,403);
  const admin=await login('pg.admin@example.com');
  const application=await adapter.get("SELECT id FROM verification_applications WHERE submitted_license_number='TEST-PG-ONLY-001'");
  assert.equal((await request(`/api/admin/verifications/${application.id}/review`,admin,'POST',{decision:'needs_clarification',clarification_request:'Provide synthetic test council details'})).status,200);
  assert.equal((await request('/api/doctor/portal/verification/clarify',onboardingToken,'POST',{clarification_response:'Synthetic credential clarification for workflow test'})).status,200);
  const decision=await request(`/api/admin/verifications/${application.id}/review`,admin,'POST',{decision:'approved',reason:'Synthetic workflow test, no real credentials verified'});assert.equal(decision.status,200,JSON.stringify(await decision.clone().json()));
  assert.ok(await login('pg.applicant@example.com'));
  assert.equal((await adapter.get("SELECT provenance_status FROM doctor_profiles WHERE license_number='TEST-PG-ONLY-001'")).provenance_status,'cares_verified');
});
test('PostgreSQL rate limits share atomic counters across independent middleware instances',async()=>{
 const {sharedRateLimiter}=await import('../src/middleware/sharedRateLimit.js');
 const one=sharedRateLimiter('pg-isolated-test',{maxRequests:2,windowMs:60000});
 const two=sharedRateLimiter('pg-isolated-test',{maxRequests:2,windowMs:60000});
 let allowed=0;let status=200;let body;
 const request={ip:'192.0.2.50',socket:{remoteAddress:'192.0.2.50'}};
 const response={setHeader(){},status(code){status=code;return this;},json(value){body=value;return value;}};
 const next=error=>{if(error)throw error;allowed++;};
 await one(request,response,next);await two(request,response,next);await one(request,response,next);
 assert.equal(allowed,2);assert.equal(status,429);assert.equal(body.code,'TOO_MANY_REQUESTS');
 const row=await adapter.get("SELECT key,hits FROM rate_limit_counters WHERE key LIKE 'pg-isolated-test:%'");assert.equal(row.hits,3);assert.ok(!row.key.includes('192.0.2.50'));
});
test('PostgreSQL persistence survives close and reopen of disposable database',async()=>{
  const expected=await adapter.get('SELECT COUNT(*)::integer AS count FROM home_care_requests');
  await adapter.close();engine=new PGlite(path.join(directory,'database'));pool=poolFor(engine);adapter=createPostgresDb(pool);
  assert.deepEqual(await adapter.get('SELECT COUNT(*)::integer AS count FROM home_care_requests'),expected);
});

test('Owner bootstrap creates a hashed admin and audit without changing existing accounts',async()=>{
 const {bootstrapAdmin}=await import('../src/scripts/createAdmin.js');
 const before=await adapter.get('SELECT COUNT(*)::integer AS count FROM users');
 await assert.rejects(()=>bootstrapAdmin(adapter,'owner@example.com','short'),/Invalid private/);
 await bootstrapAdmin(adapter,'owner@example.com','Synthetic-bootstrap-only@123');
 const account=await adapter.get("SELECT * FROM users WHERE email='owner@example.com'");assert.equal(account.role,'admin');assert.notEqual(account.password_hash,'Synthetic-bootstrap-only@123');
 assert.ok(await (await import('bcryptjs')).default.compare('Synthetic-bootstrap-only@123',account.password_hash));
 assert.ok(await adapter.get("SELECT id FROM audit_events WHERE action='OWNER_ADMIN_BOOTSTRAP' AND actor_user_id=?",[account.id]));
 await assert.rejects(()=>bootstrapAdmin(adapter,'OWNER@example.com','Synthetic-bootstrap-only@123'),/already exists/);
 assert.equal((await adapter.get('SELECT COUNT(*)::integer AS count FROM users')).count,before.count+1);
});
