// Disposable synthetic demo / production-build browser fixture. No .env database
// choice is used. Existing databases are never opened or overwritten.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { fileURLToPath } from 'node:url';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cares-browser-'));
process.env.NODE_ENV='test';
process.env.LLM_PROVIDER='anthropic';process.env.GEMINI_API_KEY='';process.env.GEMINI_MODEL='';process.env.ANTHROPIC_API_KEY='';process.env.ANTHROPIC_MODEL='';process.env.DATABASE_URL='';process.env.DATABASE_PATH=path.join(directory,'isolated.db');
process.env.ALLOW_PROTECTED_DATABASE='false';
process.env.CLIENT_ORIGIN=`http://127.0.0.1:${Number(process.env.E2E_PORT)||4173}`;
const {seedDatabase}=await import('../db/seed.js');await seedDatabase();
const {default:app}=await import('../app.js');
const {db}=await import('../db/database.js');
const wrapper=express();
wrapper.use((req,res,next)=>req.path.startsWith('/api/')?app(req,res,next):next());
const dist=fileURLToPath(new URL('../../../frontend/dist/',import.meta.url));
wrapper.use(express.static(dist));wrapper.get('*',(req,res)=>res.sendFile(path.join(dist,'index.html')));
const server=wrapper.listen(Number(process.env.E2E_PORT)||4173,'127.0.0.1',()=>console.log('Isolated synthetic CARES browser fixture ready.'));
async function close(){server.close(async()=>{await db.close();fs.rmSync(directory,{recursive:true,force:true});process.exit(0);});}
process.on('SIGTERM',close);process.on('SIGINT',close);
