import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {accountMemberships} from '../netlify/functions/_shared/memberships.mjs';

const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const langs=['tr','en','de','ar','fr','es','ru'];
const plain=value=>JSON.parse(JSON.stringify(value));

test('an old administrative marker shows no badge row, locks nothing and does not hide a later gift',()=>{
 const stale=accountMemberships({},{5:false,10:false},{},{},Date.now(),{},{5:{admin:'revoke:old'}}).tier;
 assert.deepEqual(stale.memberships,[]);assert.deepEqual(stale.revokedSupport,[]);assert.deepEqual(stale.supportAmounts,[]);
 const gifted=accountMemberships({5:true},{5:false},{},{},Date.now(),{},{}).tier;
 assert.deepEqual(gifted.supportAmounts,[5]);assert.equal(gifted.memberships[0].revoked,false);
});
test('a badge the buyer hid stays listed as hidden, so "show again" keeps working',()=>{
 const hidden=accountMemberships({},{5:true},{},{5:true},Date.now(),{},{}).tier;
 assert.deepEqual(hidden.revokedSupport,[5]);assert.equal(hidden.memberships[0].removed,true);
});
test('a running paid subscription removed by an administrator keeps its row so it can still be managed',()=>{
 const now=Date.now(),play={subscriptions:{one:{id:'play_x',provider:'google_play',amount:10,status:'active',lifetime:false,endsAt:now+86400000,renewsAt:now+86400000}}};
 const tier=accountMemberships({},{10:false},{},{},now,play,{}).tier;
 assert.equal(tier.memberships.length,1);assert.equal(tier.memberships[0].revoked,true);assert.deepEqual(tier.supportAmounts,[]);assert.deepEqual(tier.revokedSupport,[]);
});

test('the admin panel has no lock-lifting operation and reports how many people actually lost the badge',async()=>{
 const source=await read('admin-badges.js');
 assert(!source.includes('data-admin-badge-operation')&&!source.includes("adminBadges('allow',{id:id"));
 assert(source.includes('result?.changed'));
 for(const lang of langs)assert.match(source,new RegExp(lang+":\\{note:'[^']+',done:'[^']*\\{c\\}"));
});
test('the support sheet never blocks a purchase because of a removal marker',async()=>{
 const source=await read('support-badges.js');
 assert(!source.includes("blocked('badge_revoked')"));assert(!source.includes("notice('locked')"));
});

// Writing practice helpers are sliced out of progress.js and run in isolation.
async function writingHelpers(native='tr'){
 const source=await read('progress.js');
 const slice=(from,to)=>{const a=source.indexOf(from),b=source.indexOf(to,a);assert(a>=0&&b>a,from);return source.slice(a,b);};
 const code=[slice('  function escapeHtml(','\n  }\n')+'\n  }',slice('  const WP_EXTRA = {','  // Drafts are'),slice('  const wpMessageCache','  async function wpLocalizeMessages'),slice('  function wpBuildViews(','  /* Sonucu ayrı')].join('\n');
 return vm.runInNewContext(code+';({wpX,wpWordCount,wpCounterText,wpCategory,wpBuildViews,WP_EXTRA})',{window:{NATIVE_LANG:native},Map,String,Object});
}
test('writing practice: every language has the same tools, categories and four prompts per level',async()=>{
 const {WP_EXTRA}=await writingHelpers(),keys=Object.keys(WP_EXTRA.tr).sort();
 for(const lang of langs){
  assert.deepEqual(Object.keys(WP_EXTRA[lang]).sort(),keys,lang);
  assert.deepEqual(Object.keys(WP_EXTRA[lang].cats).sort(),['casing','grammar','other','punctuation','spelling','style'],lang);
  for(const level of['A1','A2','B1','B2'])assert.equal(WP_EXTRA[lang].prompts[level].length,4,lang+' '+level);
 }
});
test('writing practice: word counter, issue categories and choosing another suggestion',async()=>{
 const w=await writingHelpers('en');
 assert.equal(w.wpWordCount("Ich heiße Anna, ich bin's."),5);assert.equal(w.wpCounterText('Hallo Welt'),'2 words · 10 / 4000');
 assert.equal(w.wpCategory({rule:{category:{id:'TYPOS'}}}),'spelling');assert.equal(w.wpCategory({rule:{category:{id:'CASING'}}}),'casing');assert.equal(w.wpCategory({rule:{category:{id:'GRAMMAR'}}}),'grammar');assert.equal(w.wpCategory({rule:{issueType:'style'}}),'style');assert.equal(w.wpCategory({}),'other');
 const text='Ich habe ein Hund.',matches=[{offset:9,length:3,message:'Article',replacements:[{value:'einen'},{value:'den'}],rule:{category:{id:'GRAMMAR'}}}];
 let views=w.wpBuildViews(text,matches);assert.equal(views.corrected,'Ich habe einen Hund.');assert.equal(views.count,1);assert.match(views.issuesHtml,/wp-cat grammar/);assert.match(views.issuesHtml,/data-wp-alt="1"/);assert.match(views.origHtml,/data-wp-ref="1"/);
 views.items[0]._choice='den';views=w.wpBuildViews(text,views.matches);assert.equal(views.corrected,'Ich habe den Hund.');assert.match(views.issuesHtml,/aria-pressed="true">den</);
});
test('writing practice keeps a per-language draft and checks with Ctrl+Enter',async()=>{
 const source=await read('progress.js');
 assert(source.includes("'lumira_wp_draft_v1_'")&&source.includes('ta.value = wpReadDraft();')&&source.includes("(e.ctrlKey || e.metaKey)"));
});

test('typing practice and the typed quiz offer listening without revealing a quiz answer',async()=>{
 const source=await read('learning.js'),copy=await read('learning-i18n.js');
 assert(source.includes('panel.append(paper,meaning,listen(s,item.w)'));assert(source.includes('if(!reverse)panel.append(listen(s,item.w));'));assert(source.includes('...(reverse?[listen(s,item.w)]:[])'));
 const window={};vm.runInNewContext(copy,{window});for(const lang of langs){window.NATIVE_LANG=lang;assert.notEqual(window.LUMIRA_LEARNING_COPY.text('listen'),'listen',lang);}
});

test('story copy: every language defines the new reader texts',async()=>{
 const window={};vm.runInNewContext(await read('story-i18n.js'),{window});const copy=window.LUMIRA_STORY_COPY;
 for(const lang of langs){assert.equal(copy.lines[lang].length,copy.keys.length,lang);window.NATIVE_LANG=lang;for(const key of['textSize','speed','focusHint','smaller','larger'])assert.notEqual(copy.text(key),undefined,lang+' '+key);assert.match(copy.text('xpEarned',{n:15}),/15/);}
});
async function storyHelpers(storage){
 const source=await read('stories.js'),slice=(from,to)=>{const a=source.indexOf(from),b=source.indexOf(to,a);assert(a>=0&&b>a,from);return source.slice(a,b);};
 const xp=[];const ctx={localStorage:storage,root:{PR_addXp:(n,reason)=>{xp.push([n,reason]);return 100+n;}},t:key=>key,JSON,Array,Number,String};
 vm.runInNewContext(slice(' const SCALES=',' function speak(')+slice(' function quizReward(',' // A learned word')+';this.api={quizReward,pref,SCALES,RATES,get scaleIndex(){return scaleIndex},get rateIndex(){return rateIndex}};',ctx);
 return{...ctx.api,xp};
}
test('story quiz XP is awarded once per story and account, never without storage',async()=>{
 const values=new Map(),storage={getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,String(v))};
 const h=await storyHelpers(storage),s={uid:'alice',story:{id:'story-1'}};
 assert.equal(h.quizReward(s,3),15);assert.equal(h.quizReward(s,3),0);assert.equal(h.quizReward({...s,uid:'bob'},2),10);assert.equal(h.quizReward({...s,story:{id:'story-2'}},0),0);
 assert.deepEqual(plain(h.xp),[[15,'quizTitle'],[10,'quizTitle']]);
 const broken=await storyHelpers({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
 assert.equal(broken.quizReward(s,3),0);assert.equal(broken.xp.length,0);assert.equal(broken.scaleIndex,1);assert.equal(broken.rateIndex,1);
});
test('story reader preferences fall back to the default when nothing was saved',async()=>{
 const h=await storyHelpers({getItem:()=>null,setItem(){}});assert.equal(h.scaleIndex,1);assert.equal(h.rateIndex,1);assert.equal(h.SCALES[h.scaleIndex],1);assert.equal(h.RATES[h.rateIndex],1);
 const saved=await storyHelpers({getItem:k=>k==='lumira_story_scale_v1'?'3':k==='lumira_story_rate_v1'?'9':null,setItem(){}});assert.equal(saved.scaleIndex,3);assert.equal(saved.rateIndex,1);
});
test('the Realtime Database rules file is valid, keeps the public leaderboard and is never served by the site',async()=>{
 const rules=JSON.parse(await read('firebase-security-rules.json')).rules,toml=await read('netlify.toml');
 assert.equal(rules['.read'],false);assert.equal(rules['.write'],false);assert.equal(rules.leaderboard['.read'],true);assert.equal(rules.admins['.read'],undefined);
 assert.deepEqual(rules.serverAnnouncements.broadcast['.indexOn'],['createdAt']);
 assert.match(toml,/from = "\/firebase-security-rules\.json"\s+to = "\/404\.html"\s+status = 404\s+force = true/);
});
test('story reader: chips jump to the word, text size and speed controls exist, and the CSS scales the text',async()=>{
 const source=await read('stories.js'),css=await read('stories.css');
 assert(source.includes("btn(entry.word,'story-focus-chip',()=>locate(s,entry.word))"));assert(source.includes("'--story-scale'"));assert(source.includes('rate:profile[0]*RATES[rateIndex]'));
 assert(css.includes('font-size:calc(18px*var(--story-scale,1))')&&css.includes('font-size:calc(20px*var(--story-scale,1))'));
});
