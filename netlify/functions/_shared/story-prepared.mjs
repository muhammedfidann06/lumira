import corpus from './story-readings-1114.json' with {type:'json'};
import readings from './story-readings.json' with {type:'json'};
import {tokens,normalize} from './story-core.mjs';
import {validateNarrative} from './story-narrative.mjs';
const {scenes,closing,languages,dateScene,plots,simpleScenes,simpleClosing,simplePlots}=corpus;
function splitAligned(paragraph){const rows=Object.fromEntries(languages.map(language=>[language,paragraph[language].split(/(?<=[.!?؟])\s+/u)])),length=rows.en.length;return languages.every(language=>rows[language].length===length)?Array.from({length},(_,index)=>Object.fromEntries(languages.map(language=>[language,rows[language][index]]))):[paragraph];}
// Explicit common surface forms only: never guess an arbitrary stem and then
// attach another word's definition. Exact base forms remain available as well.
const forms={
 en:{be:['am','is','are','was','were','been'],have:['has','had'],go:['goes','went','gone'],come:['comes','came'],see:['sees','saw','seen'],say:['says','said'],find:['finds','found'],make:['makes','made'],take:['takes','took','taken'],give:['gives','gave','given'],know:['knows','knew','known'],think:['thinks','thought'],write:['writes','wrote','written'],read:['reads'],look:['looks','looked'],help:['helps','helped'],ask:['asks','asked'],child:['children'],person:['people'],friend:['friends'],book:['books'],tree:['trees'],flower:['flowers'],door:['doors'],house:['houses'],shoe:['shoes']},
 de:{sein:['bin','bist','ist','sind','seid','war','waren'],haben:['habe','hast','hat','habt','hatte','hatten'],gehen:['gehe','gehst','geht','ging','gingen','gegangen'],kommen:['komme','kommt','kam','kamen','gekommen'],sehen:['sehe','siehst','sieht','sah','gesehen'],sagen:['sage','sagt','sagte','gesagt'],finden:['finde','findet','fand','gefunden'],nehmen:['nehme','nimmt','nahm','genommen'],geben:['gebe','gibt','gab','gegeben'],wissen:['weiß','weißt','wusste','gewusst'],denken:['denke','denkt','dachte','gedacht'],schreiben:['schreibe','schreibt','schrieb','geschrieben'],lesen:['lese','liest','las','gelesen'],helfen:['helfe','hilft','half','geholfen'],fragen:['frage','fragt','fragte','gefragt'],freund:['freunde','freunden'],kind:['kinder','kindern'],buch:['bücher','büchern'],baum:['bäume','bäumen'],blume:['blumen'],haus:['häuser','häusern'],schuh:['schuhe','schuhen'],nachbar:['nachbarn']},
 ar:{'ماء':['الماء'],'بيت':['البيت','بيته','بيتي'],'عائلة':['العائلة','عائلته'],'أب':['أبي','أبيه'],'أم':['أمي','أمه'],'صديق':['صديقي','صديقه','أصدقاء'],'طفل':['الطفل','طفلان','الطفلان','أطفال'],'كتاب':['الكتاب','كتابه','كتابي','كتب','الكتب'],'شجرة':['الشجرة','أشجار','الأشجار'],'زهرة':['الزهرة','زهور','الزهور'],'حقيبة':['الحقيبة','حقيبتي','حقيبته'],'باب':['الباب'],'يوم':['اليوم','أيام'],'ساعة':['الساعة'],'قصة':['القصة','قصة','قصص'],'طريق':['الطريق']},
 ru:{'друг':['друга','другу','другом','друзья','друзей','друзьями'],'мама':['мамы','маме','маму','мамой'],'семья':['семьи','семье','семью','семьёй'],'книга':['книги','книгу','книге','книгой','книг'],'дерево':['дерева','дереву','деревья','деревьев'],'цветок':['цветка','цветку','цветы','цветов'],'дом':['дома','дому','домом','доме'],'ребёнок':['ребёнка','ребёнку','дети','детей','детьми'],'вода':['воды','воду','водой','воде'],'хлеб':['хлеба'],'сумка':['сумки','сумку','сумке','сумкой'],'час':['часа','часы','часов'],'день':['дня','дни','дней'],'письмо':['письма','письме'],'путь':['пути','путём'],'вопрос':['вопросы','вопроса'],'ответ':['ответы','ответа']}
};
function base(word,language){const parts=tokens(word,language);if(language==='de'&&['der','die','das'].includes(parts[0]))parts.shift();if(language==='en'&&parts[0]==='to')parts.shift();if(language==='fr'&&['le','la','les','un','une'].includes(parts[0]))parts.shift();return parts.join(' ');}
export function preparedStory(pool,options,meaningFor=()=> ''){
 const {plan,language,native}=options;if(!plan||!languages.includes(language)||!languages.includes(native))return null;
 const plot=plots[options.genre]?.[plan.plot.id],scene=scenes[plan.setting.id];if(!plot||!scene)return null;
 let aligned=[dateScene,...scene,...plot.start,...plot.endings[plan.ending],...plot.end,...closing];
 if(options.level===0){const simple=simplePlots[options.genre][plan.plot.id];aligned=[dateScene,simpleScenes[plan.setting.id],simple[0],simple[plan.ending+1],simpleClosing].flatMap(splitAligned);}
 if(options.level>0){const target=readings.frames[language][options.level-1],translation=readings.frames[native][options.level-1];aligned=[{[language]:target[0],[native]:translation[0]},...aligned,{[language]:target[1],[native]:translation[1]}];}
 const sentences=aligned.map(row=>({text:row[language],translation:row[native]}));
 const text=' '+tokens(sentences.map(row=>row.text).join(' '),language).join(' ')+' ',focus=[],used=new Set();
 for(const row of pool){const word=base(row.w,language),candidates=[word,...(row.forms||[]).map(value=>base(value,language)),...(forms[language]?.[word]||[])];
  if(language==='ar'&&word&&!word.includes(' ')&&!word.startsWith('ال'))candidates.push('ال'+word);
  const found=[...new Set(candidates)].filter(form=>form&&text.includes(' '+form+' ')&&!used.has(normalize(form,language))).slice(0,6),meaning=row.meaning||meaningFor(row.w,language,native);if(!found.length||!meaning)continue;
  focus.push({word:row.w,forms:found,meaning});for(const form of found)used.add(normalize(form,language));if(focus.length===220)break;
 }
 if(!focus.length)return null;
 try{return{...validateNarrative({title:plan.titles[language],sentences,focus,glossary:[]},pool,options,{reviewed:true}),provider:'library',method:'reviewed'};}catch{return null;}
}
