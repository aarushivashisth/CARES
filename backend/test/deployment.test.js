import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {buildConfig,validateDeployment,validateJwtSecret} from '../src/config/env.js';
test('Production environment rejects weak placeholders, non-TLS database, invalid origin and blanket proxy trust',()=>{
 const env={NODE_ENV:'production',JWT_SECRET:'synthetic-unit-test-only-secret-at-least-thirty-two-characters',DATABASE_URL:'postgresql://test:synthetic@db.example.invalid/test?sslmode=verify-full',CLIENT_ORIGIN:'https://cares.example.invalid',TRUST_PROXY:'1'};
 assert.equal(validateDeployment(buildConfig(env)),true);
 for(const patch of [{DATABASE_URL:''},{DATABASE_URL:'file:/tmp/x.db'},{DATABASE_URL:'postgresql://db.invalid/test'},{CLIENT_ORIGIN:'http://example.invalid'},{CLIENT_ORIGIN:'https://example.invalid/path'},{TRUST_PROXY:'true'}])assert.throws(()=>validateDeployment(buildConfig({...env,...patch})));
 assert.throws(()=>validateJwtSecret('replace_with_a_secure_random_secret_at_least_32_characters','production'),/Placeholder/);
});
test('Vercel entry refuses missing durable database without starting a listener or opening SQLite',()=>{
 const result=spawnSync(process.execPath,['--input-type=module','-e',"await import('./api/index.js')"],{cwd:new URL('../../',import.meta.url),encoding:'utf8',env:{...process.env,NODE_ENV:'production',DATABASE_URL:'',JWT_SECRET:'synthetic-unit-test-only-secret-at-least-thirty-two-characters'}});
 assert.notEqual(result.status,0);assert.match(result.stderr,/Invalid URL|PostgreSQL|DATABASE_URL/);
 const entry=fs.readFileSync(new URL('../../api/index.js',import.meta.url),'utf8');assert.ok(!entry.includes('app.listen('));
});
test('Protected default SQLite access is denied before opening a database',()=>{
 const code="const {db}=await import('./backend/src/db/connection.js');try{db.get('SELECT 1');process.exit(9)}catch(e){if(!e.message.includes('Protected live database'))throw e}";
 const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:new URL('../../',import.meta.url),encoding:'utf8',env:{...process.env,NODE_ENV:'test',DATABASE_PATH:'./data/cares.db',DATABASE_URL:'',ALLOW_PROTECTED_DATABASE:'false'}});
 assert.equal(result.status,0,result.stderr);
});
