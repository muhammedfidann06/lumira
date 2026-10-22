// Run after editing dictionary examples. Only public, repository-owned sentences
// belong in this whitelist; personal notebooks are never part of the input.
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),context=vm.createContext({});
for(const file of ['vocab-core.js',...['de','en','ar','fr','es','ru'].map(l=>'vocab-'+l+'.js'),'phrases-de.js'])vm.runInContext(fs.readFileSync(new URL(file,root),'utf8'),context,{filename:file});
const words=vm.runInContext('VOCAB',context),sources=Object.fromEntries(['tr','de','en','ar','fr','es','ru'].map(l=>[l,new Set()]));
for(const word of words){sources[word.lang].add(word.ex);sources.tr.add(word.exTr);}
const out=Object.fromEntries(Object.entries(sources).map(([lang,set])=>[lang,[...set].sort()]));
fs.writeFileSync(new URL('netlify/functions/_shared/example-sources.json',root),JSON.stringify(out));
console.log('Public example source counts:',Object.fromEntries(Object.entries(out).map(([lang,texts])=>[lang,texts.length])));
