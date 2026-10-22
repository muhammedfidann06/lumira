/* ================================================================
   VOCAB-CORE.JS — Ortak çekirdek (renk paleti, VOCAB dizisi, add() fonksiyonu)
   YÜKLEME SIRASI ÖNEMLİ: Bu dosya, vocab-de.js / vocab-en.js / vocab-ar.js
   dosyalarından ÖNCE yüklenmelidir, çünkü add() fonksiyonunu bu dosya tanımlar.

   index.html içinde script sırası şöyle olmalı:
   <script src="vocab-core.js"></script>
   <script src="vocab-de.js"></script>
   <script src="vocab-en.js"></script>
   <script src="vocab-ar.js"></script>
================================================================ */

const COLORS = ["#3dffa0","#4fe8ff","#ff5fb8","#c9ff3e","#9b7bff","#ffd23b"];
function pair(i){ return [COLORS[i%COLORS.length], COLORS[(i+2)%COLORS.length]]; }

const VOCAB = [];
let _i = 0;
function add(lang, level, cat, w, tr, pos, ex, exTr){
  const c = pair(_i++);
  VOCAB.push({lang,level,cat:String(cat||'Genel').normalize('NFC').trim()||'Genel',w,tr,pos,ex,exTr,c1:c[0],c2:c[1]});
}

globalThis.LUMIRA_CATALOG={categoryCounts(rows){const counts=new Map();for(const v of rows){const c=String(v.cat||'Genel').normalize('NFC').trim()||'Genel';counts.set(c,(counts.get(c)||0)+1);}return counts;}};
