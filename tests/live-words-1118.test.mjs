import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
async function modes(native='tr',target='de'){
 const source=await read('live-conversation.js'),window={addEventListener(){},NATIVE_LANG:native,TARGET_LANG:target};
 vm.runInNewContext(source,{window,document:{addEventListener(){},removeEventListener(){}},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},Intl,URL,Map,Set,Promise,setTimeout,clearTimeout,AbortController});
 return window.LUMIRA_LIVE_MODES;
}
const row=(from,to,o,t)=>({from,to,o,t,at:1});
const plain=v=>JSON.parse(JSON.stringify(v));

test('words come from the learned language on both sides of the conversation',async()=>{
 const M=await modes();
 const record={rows:[
  row('de','tr','Ich suche den Bahnhof.','Tren istasyonunu arıyorum.'),
  row('tr','de','Bahnhof buradan uzak mı?','Ist der Bahnhof weit von hier?'),
  row('de','tr','Morgen fahre ich nach Hamburg. Der Zug ist schnell.','Yarın Hamburg’a gidiyorum. Tren hızlı.')
 ]};
 const words=M._words(record,'de'),keys=words.map(w=>w.key);
 assert(keys.includes('bahnhof')&&keys.includes('suche')&&keys.includes('weit')&&keys.includes('hamburg'));
 assert(!keys.includes('der')&&!keys.includes('ich')&&!keys.includes('ist'),'function words are left out');
 assert(!keys.includes('buradan'),'Turkish source text is not offered as German words');
 const bahnhof=words.find(w=>w.key==='bahnhof');
 assert.equal(bahnhof.count,2);assert.equal(bahnhof.w,'Bahnhof','German nouns keep their capital letter');
 assert.equal(bahnhof.ex,'Ich suche den Bahnhof.');assert.equal(bahnhof.exTr,'Tren istasyonunu arıyorum.','a one-sentence line keeps its translation');
 const zug=words.find(w=>w.key==='zug');
 assert.equal(zug.ex,'Der Zug ist schnell.');assert.equal(zug.exTr,'','a translation of several sentences is not paired with one of them');
 const en=M._words({rows:[row('en','tr','Travel is fun. Travel broadens the mind.','')]},'en');
 assert.equal(en.find(w=>w.key==='travel').w,'travel','English words seen only at sentence start are lower-cased');
});

test('only languages that My Notes supports are offered, the target language first',async()=>{
 let M=await modes('tr','de');
 assert.deepEqual(plain(M._learn({rows:[row('en','de','Hello','Hallo')]})),['de','en']);
 assert.deepEqual(plain(M._learn({rows:[row('uk','tr','Привіт','Merhaba')]})),[],'Ukrainian and the native language are not notebook languages');
 M=await modes('de','en');
 assert.deepEqual(plain(M._learn({rows:[row('de','fr','Guten Tag','Bonjour')]})),['fr'],'the interface language is never offered');
});

test('words are saved through the existing My Notes function only',async()=>{
 const source=await read('live-conversation.js');
 assert(source.includes('root.NB_saveFavorite({lang:st.learn,meaningLang:native,w,tr:r.meaning.value.trim(),ex:r.item.ex||\'\',exTr:r.item.exTr||\'\''),'saves word, meaning and the example sentence');
 assert(!/firebase[^\n]*\.ref\(/.test(source)&&!source.includes("db.ref('progress/"),'no direct database writes');
 assert(source.includes("code==='nb_fav_login_required'?T('wordsLogin')"),'signed-out users are asked to sign in');
 assert(source.includes("root.LUMIRA_LIMITS?.ERRORS.includes(code)"),'a notebook limit is explained instead of a generic failure');
 assert(source.includes('const WORDS_MAX=20'),'at most 20 words per save');
 const app=await read('app-main.js');
 assert(app.includes('window.NB_saveFavorite=word=>nbSetFavorite(word,true);'),'My Notes still exposes the save function');
});
