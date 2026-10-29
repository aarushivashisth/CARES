import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { predict } from '../ai/carematch.js';
const timings=[];
for(let i=0;i<1000;i++){const begin=performance.now();predict('Find a cardiologist');timings.push(performance.now()-begin);}
timings.sort((a,b)=>a-b);
const cold=[];
const modelUrl=new URL('../ai/carematch.js',import.meta.url).href;
for(let i=0;i<5;i++){
 const begin=performance.now();
 execFileSync(process.execPath,['--input-type=module','-e',`const {predict}=await import(${JSON.stringify(modelUrl)});if(predict('Find a cardiologist').status!=='matched')process.exit(1);`],{stdio:'pipe'});
 cold.push(performance.now()-begin);
}
cold.sort((a,b)=>a-b);
const result={measuredAt:new Date().toISOString(),node:process.version,platform:process.platform,arch:process.arch,syntheticInput:'Find a cardiologist',warm:{iterations:1000,medianMs:timings[500],p95Ms:timings[950]},coldProcess:{iterations:5,medianMs:cold[2],minMs:cold[0],maxMs:cold[4]},memory:process.memoryUsage(),scope:'Local process only. Warm includes guards, vectorization and inference. Cold includes Node process creation/import. No HTTP, PostgreSQL, Vercel or LLM measurements.'};
fs.writeFileSync(new URL('../../../evaluation/inference-benchmark.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({warmMedianMs:result.warm.medianMs,warmP95Ms:result.warm.p95Ms,coldProcessMedianMs:result.coldProcess.medianMs,rssBytes:result.memory.rss}));
