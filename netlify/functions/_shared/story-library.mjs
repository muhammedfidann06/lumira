// A free, reviewed reading fallback. It is explicitly labelled as a prepared
// reading, never presented as a fresh AI response. Parallel story beats keep
// translations and comprehension answers aligned without a translation API.
import readings from './story-readings.json' with {type:'json'};
import {normalize,tokens} from './story-core.mjs';
import {validateNarrative} from './story-narrative.mjs';
const key=(value,language)=>tokens(value,language).filter((word,index)=>!(language==='de'&&index===0&&['der','die','das'].includes(word))).join(' ');
export function knownStory(pool,options){
 const language=options.language,native=options.native,genre=readings.stories[options.genre]?options.genre:'daily',level=options.level||0;
 const scene=readings.stories[genre],target=scene[language],translated=scene[native];if(!target||!translated)return null;
 let sentences=target.slice(1).map((text,i)=>({text,translation:translated[i+1]}));
 if(level>0){const frame=readings.frames[language][level-1],translation=readings.frames[native][level-1];sentences=[{text:frame[0],translation:translation[0]},...sentences,{text:frame[1],translation:translation[1]}];}
 const reviewedForms={ar:{'ماء':['الماء'],'بيت':['البيت'],'عائلة':['العائلة','عائلتها'],'أب':['أبيها']},ru:{'мама':['мамы','маму','маме'],'сестра':['сестры','сестре','сестру'],'семья':['семье','семьи'],'хлеб':['хлеба']}};
 const full=' '+tokens(sentences.map(row=>row.text).join(' '),language).join(' ')+' ',focus=[];
 for(const row of pool){
  const base=key(row.w,language),forms=[base,...(reviewedForms[language]?.[base]||[])].filter(form=>form&&full.includes(' '+form+' '));if(!forms.length)continue;
  // Turkish meanings can be reused directly. Other native languages use the
  // aligned public catalog, not a Turkish definition disguised as localization.
  const meaning=row.meaning||lookupMeaning(row.w,language,native);
  if(!meaning)continue;
  focus.push({word:row.w,forms,meaning});if(focus.length===12)break;
 }
 if(!focus.length)return null;
 const offset=level>0?1:0;
 const spec=readings.questions[genre];
 const questions=spec.evidence.map((index,number)=>{
  const evidence=index+offset,correct=sentences[evidence].translation;
  const choices=[correct,sentences[(index+2)%6+offset].translation,sentences[(index+4)%6+offset].translation];
  const answer=number;for(let n=0;n<number;n++)choices.unshift(choices.pop());
  return{question:spec[native][number],choices,answer,evidence};
 });
 try{return{...validateNarrative({title:target[0],sentences,focus,glossary:[],questions},pool,options,{reviewed:true}),provider:'library',method:'reviewed'};}catch{return null;}
}
// Compact, reviewed concepts cover the first lessons, including native UI
// languages whose source pool does not carry a translated definition.
const concepts=[
 ['merhaba','hello','hallo','مرحبا','bonjour','hola','здравствуйте'],
 ['teşekkürler','thank you','danke','شكرا','merci','gracias','спасибо'],
 ['günaydın','good morning','guten morgen','صباح الخير','bonjour','buenos días','доброе утро'],
 ['pazartesi','monday','montag','اثنين','lundi','lunes','понедельник'],
 ['mayıs','may','mai','مايو','mai','mayo','мае'],
 ['aile','family','familie','عائلة','famille','familia','семья'],
 ['anne','mother','mutter','أم','mère','madre','мама'],
 ['baba','father','vater','أب','père','padre','папа'],
 ['kız kardeş','sister','schwester','أخت','sœur','hermana','сестра'],
 ['erkek kardeş','brother','bruder','أخ','frère','hermano','брат'],
 ['ekmek','bread','brot','خبز','pain','pan','хлеб'],
 ['su','water','wasser','ماء','eau','agua','вода'],
 ['elma','apple','apfel','تفاحة','pomme','manzana','яблоко'],
 ['kitap','book','buch','كتاب','livre','libro','книга'],
 ['ağaç','tree','baum','شجرة','arbre','árbol','дерево'],
 ['mavi','blue','blau','أزرق','bleu','azul','синий'],
 ['iki','two','zwei','اثنان','deux','dos','два'],
 ['yirmi','twenty','zwanzig','عشرون','vingt','veinte','двадцать'],
 ['ben','I','ich','أنا','je','yo','я'],
 ['biz','we','wir','نحن','nous','nosotros','мы'],
 ['benim','my','mein','لي','mon','mi','мой'],
 ['bir','one','eins','واحد','un','uno','один'],
 ['bugün','today','heute','اليوم',"aujourd’hui",'hoy','сегодня'],
 ['yakında','soon','bald','قريبا','bientôt','pronto','скоро']
],languages=['tr','en','de','ar','fr','es','ru'];
function lookupMeaning(word,language,native){const position=languages.indexOf(language),row=concepts.find(values=>key(values[position],language)===key(word,language));return row?.[languages.indexOf(native)]||'';}
