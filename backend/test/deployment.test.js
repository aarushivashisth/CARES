import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {buildConfig,validateDeployment,validateJwtSecret,resolveDatabaseUrl} from '../src/config/env.js';
test('Production environment rejects weak placeholders, non-TLS database, invalid origin and blanket proxy trust',()=>{
 const env={NODE_ENV:'production',JWT_SECRET:'synthetic-unit-test-only-secret-at-least-thirty-two-characters',DATABASE_URL:'postgresql://test:synthetic@db.example.invalid/test?sslmode=verify-full',CLIENT_ORIGIN:'https://cares.example.invalid',TRUST_PROXY:'1'};
 assert.equal(validateDeployment(buildConfig(env)),true);
 for(const patch of [{DATABASE_URL:''},{DATABASE_URL:'file:/tmp/x.db'},{DATABASE_URL:'postgresql://db.invalid/test'},{CLIENT_ORIGIN:'http://example.invalid'},{CLIENT_ORIGIN:'https://example.invalid/path'},{TRUST_PROXY:'true'}])assert.throws(()=>validateDeployment(buildConfig({...env,...patch})));
 assert.throws(()=>validateJwtSecret('replace_with_a_secure_random_secret_at_least_32_characters','production'),/Placeholder/);
});
test('Vercel service entry refuses missing durable database without starting a listener or opening SQLite',()=>{
 const result=spawnSync(process.execPath,['--input-type=module','-e',"await import('./backend/index.js')"],{cwd:new URL('../../',import.meta.url),encoding:'utf8',env:{...process.env,NODE_ENV:'production',DATABASE_URL:'',JWT_SECRET:'synthetic-unit-test-only-secret-at-least-thirty-two-characters'}});
 assert.notEqual(result.status,0);assert.match(result.stderr,/Invalid URL|PostgreSQL|DATABASE_URL/);
 const entry=fs.readFileSync(new URL('../index.js',import.meta.url),'utf8');assert.ok(!entry.includes('app.listen('));
});
test('Protected default SQLite access is denied before opening a database',()=>{
 const code="const {db}=await import('./backend/src/db/connection.js');try{db.get('SELECT 1');process.exit(9)}catch(e){if(!e.message.includes('Protected live database'))throw e}";
 const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:new URL('../../',import.meta.url),encoding:'utf8',env:{...process.env,NODE_ENV:'test',DATABASE_PATH:'./data/cares.db',DATABASE_URL:'',ALLOW_PROTECTED_DATABASE:'false'}});
 assert.equal(result.status,0,result.stderr);
});
test('Vercel bundles the Supabase CA and its documented runtime path enables verified TLS',()=>{
 const root=new URL('../../',import.meta.url);
 const deployment=JSON.parse(fs.readFileSync(new URL('vercel.json',root),'utf8'));
 const service=deployment.services.backend;
 const included=[...fs.globSync(service.functions[service.entrypoint].includeFiles,{cwd:new URL(service.root+'/',root)})];
 assert.ok(included.includes('certs/supabase-ca.crt'));
 assert.ok(included.includes('src/ai/carematch-model.json'));
 assert.ok(included.includes('src/ai/corpus/index.json'));
 for(const cwd of [root,new URL('backend/',root)]) {
  const code="const {resolveDatabaseUrl}=await import('"+new URL('../src/config/env.js',import.meta.url).href+"');const {default:parse}=await import('"+new URL('../node_modules/pg-connection-string/index.js',import.meta.url).href+"');const value=parse(resolveDatabaseUrl('postgresql://synthetic@db.example.invalid/postgres?sslmode=verify-full&sslrootcert=certs/supabase-ca.crt'));if(!value.ssl.ca.includes('BEGIN CERTIFICATE')||value.ssl.rejectUnauthorized===false)process.exit(1)";
  const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
 }
});
test('Service routing sends API paths to Express and browser routes to the SPA without stripping the API prefix',()=>{
 const deployment=JSON.parse(fs.readFileSync(new URL('../../vercel.json',import.meta.url),'utf8'));
 for(const key of ['functions','installCommand','buildCommand','devCommand','ignoreCommand','outputDirectory','framework'])assert.equal(key in deployment,false);
 function serviceFor(path){return deployment.rewrites.find(rule=>new RegExp('^'+rule.source+'$').test(path))?.destination.service;}
 for(const path of ['/api','/api/health','/api/doctors','/api/not-found'])assert.equal(serviceFor(path),'backend');
 for(const path of ['/','/doctors/1','/assets/app.js','/apiary'])assert.equal(serviceFor(path),'frontend');
 assert.ok(deployment.rewrites.every(rule=>!rule.destination.path));
 const spaFallback=new RegExp('^'+deployment.services.frontend.rewrites[0].source+'$');
 for(const path of ['/','/doctors/1','/hospital/dashboard'])assert.ok(spaFallback.test(path));
 for(const path of ['/assets/app.js','/images/cares-logo.svg','/src/main.jsx','/@vite/client','/@react-refresh'])assert.equal(spaFallback.test(path),false);
});
test('PostgreSQL certificate resolution supports both service and former repository paths without changing credentials or TLS',()=>{
 const base='postgresql://synthetic:p%40ss%23word@db.example.invalid/postgres?sslmode=verify-full&application_name=cares';
 const service=new URL(resolveDatabaseUrl(base+'&sslrootcert=certs/supabase-ca.crt'));
 const former=new URL(resolveDatabaseUrl(base+'&sslrootcert=backend/certs/supabase-ca.crt'));
 assert.equal(service.searchParams.get('sslrootcert'),former.searchParams.get('sslrootcert'));
 assert.ok(fs.existsSync(service.searchParams.get('sslrootcert')));
 assert.equal(service.password,new URL(base).password);
 assert.equal(service.searchParams.get('sslmode'),'verify-full');
 assert.equal(service.searchParams.get('application_name'),'cares');
 assert.equal(resolveDatabaseUrl(base),base);
 assert.equal(resolveDatabaseUrl(''), '');
 assert.equal(resolveDatabaseUrl('not a URL'), 'not a URL');
});
