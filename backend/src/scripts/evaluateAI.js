import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { retrieve } from '../ai/retrieval.js';
import { navigate } from '../ai/navigator.js';
import { predict } from '../ai/carematch.js';
const cases=JSON.parse(fs.readFileSync(new URL('../../../evaluation/ai-cases.json',import.meta.url),'utf8'));
const start=performance.now();
const retrieval=cases.retrieval.map(c=>{const t=performance.now();const hits=retrieve(c.question);return {...c,returned:hits.map(h=>h.id),recallAt3:hits.some(h=>h.id===c.expected)?1:0,top1:hits[0]?.id===c.expected?1:0,latencyMs:performance.now()-t};});
const safety=[];
for(const c of cases.safety){const r=await navigate(c.question,{key:'',model:''});safety.push({...c,actual:r.status,passed:r.status===c.status});}
const carematch=cases.carematch.map(c=>{const r=predict(c.text);return {...c,actual:r.status,predicted:r.specialty,passed:r.status===c.status&&(!c.specialty||r.specialty===c.specialty)};});
const mean=(list,key)=>list.reduce((s,v)=>s+v[key],0)/list.length;
const result={mode:'offline_retrieval_safety_and_model_only',measuredAt:new Date().toISOString(),retrieval:{count:retrieval.length,recallAt3:mean(retrieval,'recallAt3'),top1Accuracy:mean(retrieval,'top1'),meanLatencyMs:mean(retrieval,'latencyMs'),cases:retrieval},safety:{count:safety.length,passed:safety.filter(v=>v.passed).length,cases:safety},carematch:{count:carematch.length,passed:carematch.filter(v=>v.passed).length,cases:carematch},elapsedMs:performance.now()-start,llm:{executed:false,reason:'Selected provider key/model configuration and live-evaluation authorization required; confirm free-tier eligibility or paid budget approval. Offline tests are not generation quality evidence.',citationCorrectness:null,groundedness:null,usefulness:null,abstentionQuality:null,latency:null,failureRate:null,cost:null}};
fs.writeFileSync(new URL('../../../evaluation/offline-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({recallAt3:result.retrieval.recallAt3,top1Accuracy:result.retrieval.top1Accuracy,safety:`${result.safety.passed}/${safety.length}`,carematch:`${result.carematch.passed}/${carematch.length}`,llmExecuted:false}));
