/* Stable Firebase keys. Arabic/Cyrillic letters must never collapse to '_'. */
(function(root){
'use strict';
function legacy(v){return (v.lang+'_'+v.level+'_'+v.w).toLowerCase().replace(/[.#$\[\]\/\s]+/g,'_').replace(/[^a-z0-9_aoubcdefghijklmnopqrstuvwxyz]/gi,'_').slice(0,120);}
function key(v){
  const raw=v.lang+'_'+v.level+'_'+String(v.w).normalize('NFC');
  return 'u_'+encodeURIComponent(raw).replace(/\./g,'%2E');
}
let source=null,size=-1,counts=new Map();
function unambiguous(v,vocab){
  if(source!==vocab||size>vocab.length){source=vocab;size=0;counts=new Map();}
  // Dictionaries append new rows as languages load. Index only that tail;
  // rebuilding all previously loaded languages caused repeated long tasks.
  for(;size<vocab.length;size++){const item=vocab[size],k=legacy(item);if(!counts.has(k))counts.set(k,new Set());counts.get(k).add(key(item));}
  return counts.get(legacy(v))?.size===1;
}
root.LUMIRA_VOCAB_ID={key,legacy,unambiguous};
})(typeof window!=='undefined'?window:globalThis);
