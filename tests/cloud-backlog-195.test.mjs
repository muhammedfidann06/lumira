import test from 'node:test';import assert from'node:assert/strict';import fs from'node:fs';import vm from'node:vm';
function harness(){
 const sockets=[],errors=[];
 class Socket{constructor(){this.readyState=1;this.bufferedAmount=0;sockets.push(this);queueMicrotask(()=>this.onopen?.());}send(text){this.bufferedAmount+=Buffer.byteLength(text);if(JSON.parse(text).setup)queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({setupComplete:{}})}));}close(){this.readyState=3;}}
 const context=vm.createContext({WebSocket:Socket,performance:{now:()=>100},AbortController,Float32Array,Uint8Array,DataView,JSON,Math,Array,Object,Promise,Error,queueMicrotask,setTimeout,clearTimeout,btoa:s=>Buffer.from(s,'binary').toString('base64'),window:{LUMIRA_FEATURES:{audio:async(p,o)=>new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true}))}}});
 vm.runInContext(fs.readFileSync(new URL('../live-cloud.js',import.meta.url),'utf8'),context);
 const create=provider=>new context.window.LUMIRA_CLOUD.CloudSession({provider,credential:{token:'auth_tokens/test-only',model:'gemini-3.5-live-translate-preview',config:{}},target:'ar',id:'test-session',onError:e=>errors.push(e)});
 return{create,sockets,errors};
}
test('Gemini accepts a full 60-second failover replay without a false backpressure failure',async()=>{
 const h=harness(),cloud=h.create('gemini');await cloud.start();const audio=new Float32Array(1600).fill(.02);for(let n=0;n<600;n++)cloud.receive(audio,n/10);assert.equal(h.errors.length,0);assert(h.sockets[0].bufferedAmount>192000);assert(h.sockets[0].bufferedAmount<3*1024*1024);cloud.stop();assert(cloud.closed);
});
test('HTTP provider accepts a 60-second failover replay while its first request is pending',async()=>{
 const h=harness(),cloud=h.create('groq');await cloud.start();const audio=new Float32Array(1600).fill(.02);for(let n=0;n<600;n++)cloud.receive(audio,n/10);assert.equal(h.errors.length,0);assert(cloud.processing);assert(cloud.length<=16000*75);cloud.stop();await Promise.resolve();assert(cloud.closed);
});
test('HTTP backlog remains bounded and falls back if processing cannot keep up',async()=>{
 const h=harness(),cloud=h.create('cloudflare');await cloud.start();const audio=new Float32Array(1600).fill(.02);for(let n=0;n<1000;n++)cloud.receive(audio,n/10);assert.equal(h.errors.length,1);assert.equal(h.errors[0].featureCode,'speech_unavailable');assert(cloud.length<=16000*75+1600);cloud.stop();
});
