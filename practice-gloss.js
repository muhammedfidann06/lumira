/* Offline word/phrase meanings. Reviewed chunks take priority over dictionary
   senses; absent or ambiguous translations are never invented. */
(function(root){'use strict';
const languages=['tr','de','en','ar','fr','es','ru'];
const fold=(text,lang)=>String(text||'').normalize('NFKC').replace(/[’ʼ]/gu,"'").toLocaleLowerCase(lang).replace(lang==='ar'?/[\u0640\u064b-\u065f\u0670\u06d6-\u06ed]/gu:/$^/gu,'').replace(/\s+/gu,' ').trim();
const words=(text,lang)=>String(text||'').normalize('NFKC').replace(/[’ʼ]/gu,"'").match(/[\p{L}\p{M}\p{N}]+(?:['-][\p{L}\p{M}\p{N}]+)*/gu)||[];
const missing={tr:'Cümledeki anlamı için yukarıdaki çeviriye bak.',de:'Die Bedeutung im Satz steht in der Übersetzung oben.',en:'See the translation above for its meaning in this sentence.',ar:'راجع الترجمة أعلاه لمعناه في الجملة.',fr:'Consulte la traduction ci-dessus pour son sens dans la phrase.',es:'Consulta la traducción anterior para ver su sentido en la frase.',ru:'Значение в предложении смотри в переводе выше.'};
// Each row is a reviewed lexical sense, not a claimed word-by-word alignment.
// Inflected verbs and function words below need explicit forms, rather than
// guessing a lemma by deleting suffixes (which can change a word's meaning).
const entries=[
 [{de:['ich'],en:['I'],ar:['أنا'],fr:['je'],es:['yo'],ru:['я']},['ben','ich','I','أنا','je','yo','я']],
 [{de:['du'],ar:['أنت'],fr:['tu'],es:['tú'],ru:['ты']},['sen','du','you','أنت','tu','tú','ты']],
 [{de:['wir'],en:['we'],ar:['نحن'],fr:['nous'],es:['nosotros','nosotras'],ru:['мы']},['biz','wir','we','نحن','nous','nosotros / nosotras','мы']],
 [{de:['und'],en:['and'],ar:['و'],fr:['et'],es:['y'],ru:['и']},['ve','und','and','و','et','y','и']],
 [{de:['oder'],en:['or'],ar:['أو'],fr:['ou'],es:['o'],ru:['или']},['veya','oder','or','أو','ou','o','или']],
 [{de:['aber'],en:['but'],ar:['لكن'],fr:['mais'],es:['pero'],ru:['но']},['ama','aber','but','لكن','mais','pero','но']],
 [{de:['nicht'],en:['not'],ar:['ليس','لا'],fr:['ne','pas'],es:['no'],ru:['не']},['değil / olumsuzluk','Verneinung','not / negation','نفي','négation','negación','отрицание']],
 [{de:['den']},['belirli artikel (belirtme hâli; çoğulda yönelme hâli)','bestimmter Artikel (Akkusativ; Dativ Plural)','definite article (accusative; plural dative)','أداة تعريف في النصب، أو الجر مع الجمع','article défini à l’accusatif ou au datif pluriel','artículo definido en acusativo o dativo plural','определённый артикль: винительный падеж или дательный множественного числа']],
 [{de:['der','die','das'],en:['the'],ar:['الـ'],fr:['le','la','les'],es:['el','la','los','las']},['belirli artikel','bestimmter Artikel','definite article','أداة تعريف','article défini','artículo definido','определённый артикль']],
 [{de:['ein','eine'],en:['a','an'],fr:['un','une'],es:['un','una']},['bir / belirsiz artikel','ein / eine','a / an','واحد / أداة تنكير','un / une','un / una','один / неопределённый артикль']],
 [{de:['dem']},['belirli artikel (yönelme hâli)','bestimmter Artikel (Dativ)','definite article (dative)','أداة تعريف في حالة الجر','article défini au datif','artículo definido en dativo','определённый артикль в дательном падеже']],
 [{de:['des']},['belirli artikel (tamlayan hâli)','bestimmter Artikel (Genitiv)','definite article (genitive)','أداة تعريف في حالة الإضافة','article défini au génitif','artículo definido en genitivo','определённый артикль в родительном падеже']],
 [{de:['finde']},['buluyorum','finden (ich)','find (I)','أجد','trouve (je)','encuentro','нахожу']],
 [{de:['findest']},['buluyorsun','finden (du)','find (you)','تجد','trouves (tu)','encuentras','находишь']],
 [{de:['findet']},['buluyor / buluyorsunuz','finden (er/sie/es/ihr)','finds / find','يجد / تجدون','trouve / trouvez','encuentra / encontráis','находит / находите']],
 [{de:['gut'],en:['good'],ar:['جيد'],fr:['bon','bonne'],es:['bueno','buena'],ru:['хороший','хорошая']},['iyi','gut','good','جيد','bon / bonne','bueno / buena','хороший / хорошая']],
 [{de:['sehr'],en:['very'],ar:['جدا'],fr:['très'],es:['muy'],ru:['очень']},['çok','sehr','very','جدا','très','muy','очень']],
 [{de:['bitte'],en:['please'],ar:['من فضلك'],fr:["s'il vous plaît","s'il te plaît"],es:['por favor'],ru:['пожалуйста']},['lütfen','bitte','please','من فضلك',"s’il vous plaît",'por favor','пожалуйста']],
 [{de:['danke'],en:['thanks','thank you'],ar:['شكرا'],fr:['merci'],es:['gracias'],ru:['спасибо']},['teşekkürler','danke','thank you','شكرا','merci','gracias','спасибо']],
 [{de:['hallo'],en:['hello','hi'],ar:['مرحبا'],fr:['bonjour','salut'],es:['hola'],ru:['здравствуйте','привет']},['merhaba','hallo','hello','مرحبا','bonjour','hola','здравствуйте']],
 [{de:['Kurs'],en:['course'],ar:['دورة'],fr:['cours'],es:['curso'],ru:['курс']},['kurs','Kurs','course','دورة','cours','curso','курс']],
 [{de:['bin'],en:['am']},['olmak (ben)','sein (ich)','be (I)','أكون','être (je)','ser / estar (yo)','быть (я)']],
 [{de:['bist']},['olmak (sen)','sein (du)','be (you)','تكون','être (tu)','ser / estar (tú)','быть (ты)']],
 [{de:['ist'],en:['is']},['olmak (o)','sein (er/sie/es)','be (he/she/it)','يكون','être (il/elle)','ser / estar (él/ella)','быть (он/она/оно)']],
 [{de:['sind']},['olmak (biz/onlar/siz)','sein (wir/sie/Sie)','be (we/they/you)','نكون / يكونون / تكونون','être (nous/ils/vous)','ser / estar (nosotros/ellos/usted)','быть (мы/они/Вы)']],
 [{de:['habe']},['sahibim / var','haben (ich)','have (I)','لدي','avoir (je)','tener (yo)','иметь (я)']],
 [{de:['hast']},['sahipsin / var','haben (du)','have (you)','لديك','avoir (tu)','tener (tú)','иметь (ты)']],
 [{de:['hat'],en:['has']},['sahip / var','haben (er/sie/es)','has','لديه / لديها','avoir (il/elle)','tener (él/ella)','иметь (он/она)']],
 [{de:['möchte']},['isterim / ister','möchten (ich/er/sie/es)','would like','أود / يود','voudrais / voudrait','quisiera','хотел(а) бы']],
 [{de:['kann']},['yapabilirim / yapabilir','können (ich/er/sie/es)','can','أستطيع / يستطيع','pouvoir (je/il/elle)','poder (yo/él/ella)','мочь (я/он/она)']],
 [{de:['muss']},['zorundayım / zorunda','müssen (ich/er/sie/es)','must / have to','يجب','devoir (je/il/elle)','deber (yo/él/ella)','должен / должна']],
 [{de:['würde']},['-erdim / -erdi (koşul)','würde (Konjunktiv II)','would','كان سيفعل (صيغة شرطية)','conditionnel','condicional','бы (условное наклонение)']],
 [{en:['you']},['sen / siz','du / Sie / ihr','you','أنت / أنتم','tu / vous','tú / usted / ustedes','ты / вы']],
 [{de:['heute'],en:['today'],ar:['اليوم'],fr:["aujourd'hui"],es:['hoy'],ru:['сегодня']},['bugün','heute','today','اليوم',"aujourd’hui",'hoy','сегодня']],
 [{en:['tomorrow'],ar:['غدا'],fr:['demain'],es:['mañana'],ru:['завтра']},['yarın','morgen','tomorrow','غدا','demain','mañana','завтра']],
 [{de:['morgen']},['yarın / sabah','morgen / der Morgen','tomorrow / morning','غدا / الصباح','demain / matin','mañana','завтра / утро']],
 [{de:['gestern'],en:['yesterday'],ar:['أمس'],fr:['hier'],es:['ayer'],ru:['вчера']},['dün','gestern','yesterday','أمس','hier','ayer','вчера']],
 [{de:['weil'],en:['because'],ar:['لأن'],fr:['parce que'],es:['porque'],ru:['потому что']},['çünkü','weil','because','لأن','parce que','porque','потому что']],
 [{de:['wenn'],en:['if'],ar:['إذا'],fr:['si'],es:['si'],ru:['если']},['eğer / -dığında','wenn','if / when','إذا','si / quand','si / cuando','если / когда']],
 [{de:['dass']},['-dığını / ki (bağlaç)','dass (Konjunktion)','that (conjunction)','أنّ','que (conjonction)','que (conjunción)','что (союз)']],
 [{de:['zu Hause'],en:['at home'],ar:['في المنزل'],fr:['à la maison'],es:['en casa'],ru:['дома']},['evde','zu Hause','at home','في المنزل','à la maison','en casa','дома']],
 [{de:['zum Beispiel'],en:['for example'],ar:['على سبيل المثال'],fr:['par exemple'],es:['por ejemplo'],ru:['например']},['örneğin','zum Beispiel','for example','على سبيل المثال','par exemple','por ejemplo','например']],
 [{de:['im Voraus'],en:['in advance'],ar:['مقدما'],fr:["à l'avance"],es:['de antemano'],ru:['заранее']},['önceden / şimdiden','im Voraus','in advance','مقدما',"à l’avance",'de antemano','заранее']],
 [{en:['are']},['olmak (sen/siz/biz/onlar)','sein (du/ihr/wir/sie)','are','تكون / تكونون / نكون / يكونون','être (tu/vous/nous/ils)','ser / estar','быть']],
 [{en:['have']},['sahip olmak / var','haben','have','لديه','avoir','tener','иметь']],
 [{en:['do','does']},['yapmak / soru yardımcı fiili','tun / Fragehilfsverb','do / question auxiliary','يفعل / فعل مساعد للسؤال','faire / auxiliaire interrogatif','hacer / auxiliar interrogativo','делать / вспомогательный глагол вопроса']],
 [{en:['to']},['-e / -a / mastar işareti','zu / Infinitivmarker','to / infinitive marker','إلى / علامة المصدر','à / marqueur infinitif','a / marcador de infinitivo','к / показатель инфинитива']],
 [{en:['of']},['-in / -ın / aitlik','von / Zugehörigkeit','of','من / إضافة','de','de','родительный падеж / принадлежность']],
 [{en:['in']},['içinde / -de','in','in','في','dans / en','en','в']],
 [{en:['for']},['için','für','for','لـ / من أجل','pour','para','для']],
 [{fr:["j'ai"]},['bende var','ich habe','I have','لدي',"j’ai",'tengo','у меня есть']],
 [{fr:['suis']},['olmak (ben)','sein (ich)','am','أكون','être (je)','ser / estar (yo)','быть (я)']],
 [{fr:['est']},['olmak (o)','sein (er/sie/es)','is','يكون','être (il/elle)','ser / estar (él/ella)','быть (он/она)']],
 [{es:['soy']},['olmak (ben; kimlik)','sein (ich; Identität)','am (identity)','أكون (هوية)','être (je; identité)','ser (yo)','быть (я; личность)']],
 [{es:['estoy']},['olmak (ben; durum/yer)','sein (ich; Zustand/Ort)','am (state/location)','أكون (حال أو مكان)','être (je; état/lieu)','estar (yo)','быть (я; состояние/место)']],
 [{es:['tengo']},['bende var','ich habe','I have','لدي',"j’ai",'tener (yo)','у меня есть']]
];
const caches=new Map();
function add(map,key,value,priority=0){if(!key||!value)return;const old=map.get(key);if(!old||priority>old.priority)map.set(key,{value,priority});else if(priority===old.priority&&old.value!==value)map.set(key,{value:null,priority});}
function index(language,native){
 const vocab=typeof VOCAB==='undefined'?[]:VOCAB,revision=root.LUMIRA_PHRASES?.revision||0,key=language+'|'+native+'|'+vocab.length+'|'+revision;
 if(caches.has(key))return caches.get(key);const map=new Map(),nativeMeanings=new Map();
 for(const v of vocab)if(v.lang===native&&!v.phraseId){const k=fold(v.tr,'tr');if(!nativeMeanings.has(k))nativeMeanings.set(k,new Set());nativeMeanings.get(k).add(v.w);}
 for(const v of vocab){
  if(language==='tr'&&v.lang===native&&!v.phraseId){const form=String(v.tr).replace(/\s*\([^)]*\)/gu,'').trim();if(words(form,language).length<=5)add(map,fold(form,language),v.w);for(const shape of v.wordForms?.tr||[])add(map,fold(shape,language),v.w);continue;}
  if(v.lang!==language||v.phraseId)continue;let meaning=native==='tr'?v.tr:v.translations?.[native];
  if(!meaning){const matches=nativeMeanings.get(fold(v.tr,'tr'));if(matches?.size===1)meaning=[...matches][0];}
  if(!meaning)continue;const form=String(v.w).replace(/\s*\([^)]*\)/gu,'').trim();if(words(form,language).length<=5)add(map,fold(form,language),meaning);
  if(language==='de')add(map,fold(form.replace(/^(?:der|die|das)\s+/iu,''),language),meaning);
  for(const shape of v.wordForms?.[language]||v.forms||[])if(words(shape,language).length<=5)add(map,fold(shape,language),meaning);
 }
 // Human-reviewed German chunks already have meanings in all seven UI languages.
 if(language==='de')for(const row of root.LUMIRA_PHRASES?.rows||[])if(row.chunks?.length)for(const[part,meaning]of root.LUMIRA_PHRASES.gloss(row,native,'de'))add(map,fold(part,language),meaning,1);
 for(const[forms,meanings]of entries)for(const form of forms[language]||[])add(map,fold(form,language),meanings[languages.indexOf(native)],2);
 caches.set(key,map);while(caches.size>3)caches.delete(caches.keys().next().value);return map;
}
function breakdown(text,language,native,phrase){
 if(language==='de'&&phrase?.chunks?.length){const dictionary=index(language,native);return root.LUMIRA_PHRASES.gloss(phrase,native,'de').map(([word,meaning])=>({word,meaning:dictionary.get(fold(word,language))?.priority===2?dictionary.get(fold(word,language)).value||meaning:meaning,available:true}));}
 const source=words(text,language),dictionary=index(language,native),result=[];
 for(let i=0;i<source.length;){let match;
  for(let size=Math.min(5,source.length-i);size>=1;size--){if(size===source.length&&source.length>3)continue;const word=source.slice(i,i+size).join(' '),entry=dictionary.get(fold(word,language));if(entry?.value){match={word,meaning:entry.value,available:true,size};break;}}
  if(match){result.push(match);i+=match.size;}else{const word=source[i++];result.push({word,meaning:/^\p{N}+$/u.test(word)?word:(missing[native]||missing.en),available:/^\p{N}+$/u.test(word)});}
 }
 return result;
}
root.LUMIRA_GLOSS={breakdown,words,fold};
})(typeof window!=='undefined'?window:globalThis);
