// Owner-run, explicitly authorized live evaluation; free-tier eligibility is account-controlled. Never runs as part of npm test/build.
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { navigate } from '../ai/navigator.js';
import { index } from '../ai/retrieval.js';
import '../config/env.js';
import { resolveLLMConfig } from '../ai/llmProvider.js';
if (!process.argv.includes('--authorize-live-evaluation') && !process.argv.includes('--authorize-billable-evaluation')) throw new Error('Owner evaluation authorization required: --authorize-live-evaluation. Paid accounts also require explicit budget approval. No provider call made.');
const settings=resolveLLMConfig();
if (!settings.key || !settings.model) throw new Error('Configure the selected provider key and model privately in backend/.env.');
const cases=JSON.parse(fs.readFileSync(new URL('../../../evaluation/ai-cases.json',import.meta.url),'utf8'));
const rows=[];
for(const c of [...cases.retrieval,...cases.safety]){
 const begin=performance.now();
 try {
  const result=await navigate(c.question);
  rows.push({question:c.question,expectedSource:c.expected || null,expectedSafetyStatus:c.status || null,result,latencyMs:performance.now()-begin,humanReview:{allClaimsSupported:null,allCitationsSupportClaim:null,usefulness1To5:null,appropriateAbstention:null,notes:''}});
 } catch { rows.push({question:c.question,status:'provider_failure',latencyMs:performance.now()-begin}); }
}
const result={measuredAt:new Date().toISOString(),provider:settings.provider,model:settings.model,corpusSha256:index().corpusSha256,scope:'Live provider results on authored synthetic navigation questions. Human claim/citation labels still required. No patient database accessed.',providerFailureRate:rows.filter(r=>r.status==='provider_failure').length/rows.length,usage:rows.reduce((a,r)=>({inputTokens:a.inputTokens+(r.result?.usage?.inputTokens||0),outputTokens:a.outputTokens+(r.result?.usage?.outputTokens||0)}),{inputTokens:0,outputTokens:0}),estimatedCostUSD:null,costNote:'Free-tier eligibility depends on model, account and quotas; it is not inferred from an API key. Verify account tier; use actual rates and reconcile billing for paid accounts. No price is assumed.',rows};
const filename=new URL(`../../../evaluation/live-results-${Date.now()}.json`,import.meta.url);
fs.writeFileSync(filename,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(`Saved ${rows.length} sanitized evaluation cases with usage/timings and unscored human-review fields. No credentials printed.`);
