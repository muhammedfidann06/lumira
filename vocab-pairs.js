/* Lumira 1.9.5 — sentence-aligned cross-language cards, entirely offline. */
(function(root){
'use strict';
const normalize = value => String(value || '').normalize('NFC').trim()
  .toLocaleLowerCase('tr-TR').replace(/[’‘]/g,"'").replace(/\s+/g,' ');
// Keep articles, negation, numbers and punctuation: dropping these changes meaning.
function part(value){
  const p=normalize(value).split(' (')[0];
  const groups={noun:['nomen','noun','isim','اسم'],verb:['verb','fiil','فعل','phrasal verb','phrasal_verb'],adjective:['adjektiv','adjective','sıfat','صفة'],adverb:['adverb','zarf','ظرف'],number:['zahl','number','sayı','عدد'],pronoun:['pronomen','pronoun','zamir','ضمير']};
  return Object.keys(groups).find(k=>groups[k].includes(p)) || '';
}
function compatible(a,b){ const x=part(a.pos),y=part(b.pos);return !x||!y||x===y; }
function uniqueWord(items){
  const unique=new Map();
  for(const item of items) if(!unique.has(String(item.w).normalize('NFC')))unique.set(String(item.w).normalize('NFC'),item);
  return unique.size===1 ? [...unique.values()][0] : null;
}
function sentenceMap(items){
  const map=new Map();
  for(const item of items){const key=normalize(item.exTr);if(key && item.ex){if(!map.has(key))map.set(key,new Set());map.get(key).add(item.ex);}}
  return map;
}
function parallel(target,native,own,sentences,reviewedMap){
  const key=normalize(target.exTr);
  if(!key || !target.ex)return {text:'',kind:'unavailable'};
  const reviewed=root.LUMIRA_PARALLEL_EXAMPLES;
  if(reviewed){
    const index=reviewed.languages.indexOf(native);
    const sourceIndex=reviewed.languages.indexOf(target.lang);
    const row=reviewedMap.get(key);
    if(row && index>=0 && sourceIndex>=0 && row[index] && normalize(row[sourceIndex])===normalize(target.ex))return {text:row[index],kind:'reviewed'};
  }
  // A word translation is NOT evidence that the two example sentences translate.
  if(own && normalize(own.exTr)===key && own.ex)return {text:own.ex,kind:'same-sentence'};
  const matches=sentences.get(key);
  if(matches && matches.size===1)return {text:[...matches][0],kind:'same-sentence'};
  return {text:'',kind:'unavailable'};
}
function build(vocab,native,target){
  const nativeItems=vocab.filter(v=>v.lang===native),targets=vocab.filter(v=>v.lang===target);
  const direct=targets.filter(v=>v.translations?.[native]).map(v=>({...v,tr:v.translations[native],exTr:v.exampleTranslations?.[native]||'',meaningLang:native,_exampleTranslation:'catalog',_sourceTr:v.tr,_sourceExTr:v.exTr}));
  const nativeMap=new Map(),targetMap=new Map();
  for(const [items,map] of [[nativeItems,nativeMap],[targets,targetMap]])for(const item of items){const k=normalize(item.tr);if(k){if(!map.has(k))map.set(k,[]);map.get(k).push(item);}}
  const sentences=sentenceMap(nativeItems),out=[...direct];
  const reviewedMap=new Map((root.LUMIRA_PARALLEL_EXAMPLES?.rows || []).map(row=>[normalize(row[0]),row]));
  for(const [key,items] of targetMap){
    const targetWord=uniqueWord(items.filter(v=>!v.phraseId)),nativeWords=nativeMap.get(key);
    if(!targetWord || !nativeWords)continue;
    const nativeWord=uniqueWord(nativeWords.filter(n=>compatible(targetWord,n)));
    if(!nativeWord)continue;
    const example=parallel(targetWord,native,nativeWord,sentences,reviewedMap);
    out.push({...targetWord,tr:nativeWord.w,exTr:example.text,meaningLang:native,
      _exampleTranslation:example.kind,_sourceTr:targetWord.tr,_sourceExTr:targetWord.exTr});
  }
  return out;
}
const missing={tr:'Bu örnek cümlenin çevirisi henüz hazır değil.',en:'The translation of this example is not available yet.',de:'Die Übersetzung dieses Beispiels ist noch nicht verfügbar.',ar:'ترجمة هذا المثال غير متوفرة بعد.',fr:"La traduction de cet exemple n’est pas encore disponible.",es:'La traducción de este ejemplo aún no está disponible.',ru:'Перевод этого примера пока недоступен.'};
root.LUMIRA_VOCAB_PAIRS={build,normalize,part,missing};
})(typeof window!=='undefined'?window:globalThis);
