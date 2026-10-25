import fs from 'node:fs';import vm from 'node:vm';
const base=new URL('../',import.meta.url),ctx=vm.createContext({URL,AbortController,setTimeout,clearTimeout,location:{href:'https://lumira-tr.com/'},fetch:async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL('.'+new URL(url).pathname,base),'utf8'))})});
for(const file of['vocab-core.js',...['de','en','ar','fr','es','ru'].map(l=>'vocab-'+l+'.js'),'phrases-de.js'])vm.runInContext(fs.readFileSync(new URL(file,base),'utf8'),ctx);
for(const language of ['en','ar','fr','es','ru'])await ctx.LUMIRA_PHRASES.ensureLanguage(language);
const rows=vm.runInContext('VOCAB.map(v=>[v.lang,v.level,v.w,v.tr,v.cat,...(v.translations?[v.translations]:[]),...(v.wordForms?[v.wordForms]:[])])',ctx);fs.writeFileSync(new URL('netlify/functions/_shared/story-sources.json',base),JSON.stringify(rows));console.log(rows.length,'public story vocabulary entries');
