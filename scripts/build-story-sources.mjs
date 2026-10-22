import fs from 'node:fs';import vm from 'node:vm';
const base=new URL('../',import.meta.url),ctx=vm.createContext({});
for(const file of['vocab-core.js',...['de','en','ar','fr','es','ru'].map(l=>'vocab-'+l+'.js'),'phrases-de.js'])vm.runInContext(fs.readFileSync(new URL(file,base),'utf8'),ctx);
const rows=vm.runInContext('VOCAB.map(v=>[v.lang,v.level,v.w,v.tr])',ctx);fs.writeFileSync(new URL('netlify/functions/_shared/story-sources.json',base),JSON.stringify(rows));console.log(rows.length,'public story vocabulary entries');
