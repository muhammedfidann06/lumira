import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {summarize,createLeaderboardHandler} from '../netlify/functions/leaderboard-top.mjs';
import {createStoryWordHandler} from '../netlify/functions/story-word.mjs';
import {createHandler} from '../netlify/functions/features.mjs';
import {memoryDb} from './memory-db.mjs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('leaderboard summary keeps names only for the top five and bare scores for ranks',()=>{
 const board={};for(let i=0;i<12;i++)board['user'+i]={name:'  Learner '+i+' with a very long display name  ',totalSeconds:i*100,xp:(12-i)*10};board.empty={};board.partial={xp:5};
 const top=summarize(board,123);
 assert.equal(top.updatedAt,123);assert.equal(top.total,13);
 assert.deepEqual(top.time.map(row=>row.uid),['user11','user10','user9','user8','user7']);
 assert.deepEqual(top.level.map(row=>row.uid),['user0','user1','user2','user3','user4']);
 assert(top.time.every(row=>row.name.length<=30&&!row.name.startsWith(' ')));
 assert.equal(top.timeScores.length,13);assert.equal(top.xpScores.length,13);
 for(let i=1;i<top.timeScores.length;i++)assert(top.timeScores[i-1]>=top.timeScores[i]);
 assert(!JSON.stringify({scores:top.timeScores,xp:top.xpScores}).includes('user'));
});
test('the leaderboard endpoint is CDN-cacheable, read-only and never caches a failure',async()=>{
 const f=memoryDb({leaderboard:{alice:{name:'Alice',totalSeconds:60,xp:5}}});
 const handler=createLeaderboardHandler({admin:async()=>({db:f.db})},()=>1);
 const ok=await handler(new Request('https://lumira-tr.com/.netlify/functions/leaderboard-top'));
 assert.equal(ok.status,200);assert.match(ok.headers.get('Netlify-CDN-Cache-Control'),/s-maxage=300/);assert.equal((await ok.json()).time[0].name,'Alice');
 assert.equal((await handler(new Request('https://lumira-tr.com/.netlify/functions/leaderboard-top',{method:'POST',body:'{}'}))).status,405);
 const down=createLeaderboardHandler({admin:async()=>{throw Error('offline');}});const failed=await down(new Request('https://lumira-tr.com/.netlify/functions/leaderboard-top'));
 assert.equal(failed.status,503);assert.equal(failed.headers.get('Netlify-CDN-Cache-Control'),'no-store');
});
test('the light story-word endpoint answers taps without the story catalog',async()=>{
 const f=memoryDb({serverStories:{alice:{'story-fixture-000001':{options:{language:'de',native:'tr'},sentences:[{text:'Der Hund läuft schnell.',translation:'Köpek hızlı koşuyor.'}]}}}});
 let calls=0;const handler=createStoryWordHandler({identity:async()=>({uid:'alice',db:f.db}),assertAvailable:async()=>{},meaning:async input=>{calls++;return{word:input.word,lemma:'laufen',meaning:'koşmak'};}},()=>1000);
 const call=async body=>{const r=await handler(new Request('https://lumira-tr.com/.netlify/functions/story-word',{method:'POST',body:JSON.stringify(body)}));return{status:r.status,...await r.json()};};
 const first=await call({action:'word',id:'story-fixture-000001',sentence:0,position:2});
 assert.equal(first.status,200);assert.equal(first.meaning,'koşmak');assert.equal(first.contextual,true);
 const again=await call({action:'word',id:'story-fixture-000001',sentence:0,position:2});assert.equal(again.meaning,'koşmak');assert.equal(calls,1,'the saved meaning is reused');
 assert.equal((await call({action:'generate'})).status,400);
 assert.equal((await call({action:'word',id:'missing-story-000001',sentence:0,position:0})).status,404);
 assert(!read('netlify/functions/story-word.mjs').includes('story-sources.json'));
});
test('in-lesson requests use the cached tier while a new lesson recomputes it',async()=>{
 const f=memoryDb(),used=[],tier={amount:0,count:10,minutes:20};
 const handler=createHandler({identity:async()=>{used.push('full');return{uid:'alice',tier,db:f.db};},liveIdentity:async()=>{used.push('live');return{uid:'alice',tier,db:f.db};},configuredProviders:()=>[]},()=>Date.now());
 const call=body=>handler(new Request('https://lumira-tr.com/.netlify/functions/features',{method:'POST',body:JSON.stringify(body)}));
 const id='live-identity-session-1113';
 assert.equal((await call({action:'liveStart',id,provider:'local'})).status,200);
 assert.equal((await call({action:'liveRenew',id,provider:'local'})).status,200);
 await call({action:'liveStop',id,provider:'local'});
 assert.deepEqual(used,['full','live','live']);
});
test('internal repository files are not served by the site, while functions keep working',()=>{
 const toml=read('netlify.toml');
 for(const path of['/netlify/*','/tests/*','/scripts/*','/package.json','/env.example','/KURULUM.md','/screenshot-1.jpg.PNG'])assert(toml.includes('from = "'+path+'"'),path);
 assert(!/from = "\/\.netlify/.test(toml),'function routes are never blocked');
 assert(!/from = "\/\.well-known/.test(toml),'Digital Asset Links stay public');
 assert(fs.existsSync(new URL('../404.html',import.meta.url)));
 const backend=read('backend.js');assert(backend.includes("'story-word'"));assert(backend.includes("'leaderboard-top'"));
});
test('the moved application scripts load in their original order and are cached offline',()=>{
 const html=read('index.html'),sw=read('sw.js');
 assert(html.indexOf('app-i18n.js')<html.indexOf('app-main.js'));assert(html.indexOf('leaderboard.js')<html.indexOf('app-i18n.js'));assert(html.indexOf('app-main.js')<html.indexOf('live-local-loader.js'));
 assert(!html.includes('const I18N = {'));assert(read('app-i18n.js').includes('const I18N = {'));assert(read('app-main.js').includes('const LANGS = {'));
 assert(sw.includes("'./app-i18n.js'"));assert(sw.includes("'./app-main.js'"));
});
