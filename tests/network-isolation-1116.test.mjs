import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import './no-external-network.mjs';
test('test fetch cannot reach an external host',async()=>{
 await assert.rejects(fetch('https://example.invalid/'),error=>error.code==='TEST_NETWORK_DISABLED');
});
test('HTTP and raw socket clients cannot bypass test network isolation',()=>{
 for(const action of[()=>http.get('http://example.invalid/'),()=>https.request('https://example.invalid/'),()=>net.createConnection({host:'example.invalid',port:443}),()=>tls.connect({host:'example.invalid',port:443})])assert.throws(action,error=>error.code==='TEST_NETWORK_DISABLED');
});
test('local fixture servers remain available without cloud credentials',async()=>{
 const server=http.createServer((_,response)=>response.end('local fixture'));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const result=await new Promise((resolve,reject)=>http.get('http://127.0.0.1:'+server.address().port,response=>{let body='';response.on('data',chunk=>body+=chunk);response.on('end',()=>resolve(body));}).on('error',reject));assert.equal(result,'local fixture');}
 finally{await new Promise(resolve=>server.close(resolve));}
});
