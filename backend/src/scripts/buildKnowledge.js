import fs from 'node:fs';
import { buildIndex } from '../ai/retrieval.js';
const corpus=JSON.parse(fs.readFileSync(new URL('../ai/corpus/sources.json',import.meta.url),'utf8'));
const index=buildIndex(corpus);
fs.writeFileSync(new URL('../ai/corpus/index.json',import.meta.url),JSON.stringify(index,null,2)+'\n');
console.log(`Indexed ${index.chunks.length} traceable paragraph chunks using ${Object.keys(index.idf).length} dimensions.`);
