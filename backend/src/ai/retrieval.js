import fs from 'node:fs';
import crypto from 'node:crypto';
export const tokenize = text => (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter(word => !new Set(['a','an','the','is','are','can','i','my','to','of','in','for','and','or','do','how','what','does','with','on','at','by','me','it','be','as','this','that','please','about']).has(word));
export function buildIndex(corpus) {
  const chunks=[];
  const ids=new Set();
  for (const source of corpus.sources) {
    if (!/^[a-z0-9-]+$/.test(source.id) || ids.has(source.id) || typeof source.title!=='string' || !Array.isArray(source.paragraphs) || !(source.url.startsWith('https://') || /^\/(?!\/)/.test(source.url))) throw new Error('Invalid or duplicate source metadata.');
    ids.add(source.id);
  }
  for (const source of corpus.sources) for (const [paragraph, text] of source.paragraphs.entries()) {
    // Bounded paragraph chunks with stable IDs; reject oversized corpus additions.
    if (text.length>1600) throw new Error('Split source paragraphs to at most 1600 characters.');
    chunks.push({id:`${source.id}-${paragraph+1}`,sourceId:source.id,title:source.title,url:source.url,version:source.version,retrievedAt:corpus.retrieved_at,text});
  }
  const idf={};
  for (const chunk of chunks) for (const word of new Set(tokenize(chunk.title+' '+chunk.text))) idf[word]=(idf[word]||0)+1;
  for (const word of Object.keys(idf)) idf[word]=Math.log((1+chunks.length)/(1+idf[word]))+1;
  const vector = text => embed(text,idf);
  return {version:corpus.version,corpusSha256:crypto.createHash('sha256').update(JSON.stringify(corpus)).digest('hex'),embedding:'L2-normalized sparse TF-IDF word vectors, lexical not neural',idf,chunks:chunks.map(c=>({...c,vector:vector(c.title+' '+c.text)}))};
}
export function embed(text,idf) {
  const vector={};
  for(const word of tokenize(text)) if(Object.hasOwn(idf,word)) vector[word]=(vector[word]||0)+idf[word];
  const norm=Math.sqrt(Object.values(vector).reduce((s,v)=>s+v*v,0));
  return Object.fromEntries(Object.entries(vector).map(([word,v])=>[word,v/(norm||1)]));
}
let cached;
export function index() { return cached ||= JSON.parse(fs.readFileSync(new URL('./corpus/index.json',import.meta.url),'utf8')); }
export function retrieve(query,store=index(),limit=3) {
  const q=embed(query,store.idf);
  return store.chunks.map(chunk=>({...chunk,score:Object.entries(q).reduce((s,[word,v])=>s+v*(chunk.vector[word]||0),0)})).filter(chunk=>chunk.score>=0.12).sort((a,b)=>b.score-a.score).slice(0,limit).map(({vector,...chunk})=>chunk);
}
