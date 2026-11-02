import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const langs=['tr','en','de','ar','fr','es','ru'];

test('the Live tab opens a chooser in front of the unchanged live translation screen',async()=>{
 const app=await read('app-main.js'),html=await read('index.html'),sw=await read('sw.js');
 assert(app.includes("if(window.LUMIRA_LIVE_MODES) window.LUMIRA_LIVE_MODES.open($('liveTranslateView'));"));
 assert(app.includes("else if(window.LUMIRA_LIVE) window.LUMIRA_LIVE.mount($('liveTranslateView'));"),'falls back to the old screen when the chooser is missing');
 assert(app.includes('window.LUMIRA_LIVE_MODES?.unmount();'),'leaving the tab stops a face-to-face session');
 assert(/<script src="live-translate\.js\?v=[\d.]+"><\/script>\s*<script src="live-conversation\.js\?v=[\d.]+"><\/script>/.test(html));
 assert(/live-conversation\.css\?v=/.test(html)&&sw.includes("'./live-conversation.js'")&&sw.includes("'./live-conversation.css'"));
});
test('face-to-face translation uses the same server session, quota and speech token rules',async()=>{
 const source=await read('live-conversation.js');
 for(const action of["'liveStart',{id,provider:'local'}","'liveRenew',{id,provider:'local'}","'liveStop',{id}","'liveConnect',{id:s.sessionId,provider:'azure'"])assert(source.includes(action),action);
 assert(source.includes("open('live_limit')"),'an exhausted allowance opens the badge screen');
 assert(source.includes('AutoDetectSourceLanguageConfig.fromLanguages([LOCALES[s.pair.top],LOCALES[s.pair.bottom]])'),'automatic mode only listens for the two chosen languages');
 assert(source.includes('config.speechRecognitionLanguage=LOCALES[from];config.addTargetLanguage(azureTarget(to));'),'manual mode translates each side into the other');
 assert(source.includes('s.mutedUntil=Infinity'),'translations read aloud are not re-recognised');
 assert(source.includes("root.LUMIRA_LIVE.mount(host);"),'the chooser opens the existing live screen as it is');
});
test('every interface language has the face-to-face texts',async()=>{
 const source=await read('live-conversation.js'),block=source.slice(source.indexOf('const COPY={'),source.indexOf('};\nconst T='));
 const keys=[...block.slice(block.indexOf('tr:{')+4,block.indexOf('},\n en:')).matchAll(/(\w+):'/g)].map(m=>m[1]);
 assert(keys.length>25);
 for(const lang of langs){const row=block.slice(block.indexOf(' '+lang+':{')).split('},\n')[0];for(const key of keys)assert(row.includes(key+":'"),lang+' '+key);}
});
