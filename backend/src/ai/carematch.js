import fs from 'node:fs';
import { safetyGate } from './safety.js';
const model = JSON.parse(fs.readFileSync(new URL('./carematch-model.json', import.meta.url), 'utf8'));
export function probabilities(text) {
  const counts = new Map();
  for (const word of text.toLowerCase().match(/\b[a-z][a-z]+\b/g) || []) if (Object.hasOwn(model.vocabulary,word)) counts.set(model.vocabulary[word], (counts.get(model.vocabulary[word]) || 0)+1);
  const weighted = [...counts].map(([i,count]) => [i,count*model.idf[i]]);
  const norm = Math.sqrt(weighted.reduce((s,[,value])=>s+value*value,0));
  const logits = model.weights.map((row,c)=>model.intercept[c]+weighted.reduce((s,[i,value])=>s+row[i]*value/(norm || 1),0));
  const max = Math.max(...logits);
  const exps = logits.map(value => Math.exp(value-max));
  const total = exps.reduce((s,v)=>s+v,0);
  return exps.map(value=>value/total);
}
export function predict(text) {
  const gate = safetyGate(text);
  const meta = { version:model.version, disclosure:model.disclosure };
  if (gate) return {...gate,...meta};
  const probs = probabilities(text);
  const ranked = model.classes.map((specialty,i)=>({specialty,score:probs[i]})).sort((a,b)=>b.score-a.score);
  // Prototype supports explicit service intents, never symptom-to-specialty diagnosis.
  const explicit = /\b(cardiolog\w*|heart (doctor|specialist|clinic)|cardiac|dermatolog\w*|skin (doctor|specialist|clinic)|orthop\w*|bone|joint|pediatric\w*|paediatric\w*|child(ren)?'?s? (doctor|clinic|health)|general (physician|medicine|doctor)|family (doctor|physician|medicine)|primary care|internal medicine)\b/i.test(text);
  if (!explicit || ranked[0].score < model.confidence_threshold || ranked[0].score-ranked[1].score < model.margin_threshold) return { status:'uncertain',message:'Please name a specialty or service. This limited synthetic model cannot safely map symptoms to a specialty. A general physician can help you choose care.',...meta };
  return { status:'matched',specialty:ranked[0].specialty,score:ranked[0].score,message:'Navigation suggestion from a limited synthetic prototype; this is not a diagnosis or calibrated clinical confidence.',...meta };
}
