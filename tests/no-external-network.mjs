// Test processes use their own fixtures. Never let a forgotten mock contact a
// cloud account or send credentials; local JWKS/emulator servers remain usable.
import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
import net from 'node:net';
import tls from 'node:tls';
import {syncBuiltinESMExports} from 'node:module';
const blocked=()=>Object.assign(new Error('External network is disabled in tests'),{code:'TEST_NETWORK_DISABLED'});
const local=host=>['localhost','127.0.0.1','::1','[::1]'].includes(String(host||'localhost').toLowerCase());
function checkRequest(value){
 if(typeof value==='string'||value instanceof URL){const url=new URL(value);if(!local(url.hostname))throw blocked();return;}
 const host=value?.hostname||value?.host||'localhost';
 if(!local(String(host).replace(/^\[([^\]]+)\](?::\d+)?$/,'$1').replace(/^(localhost|127\.0\.0\.1):\d+$/,'$1')))throw blocked();
}
function socketArgs(args){let values=args;while(Array.isArray(values[0]))values=values[0];const first=values[0];if(typeof first==='string'||first?.path)return;const host=typeof first==='number'?values[1]:first?.host;if(typeof host==='string'&&!local(host))throw blocked();}
for(const module of[http,https])for(const name of['request','get']){const original=module[name];module[name]=function(...args){checkRequest(args[0]);return original.apply(this,args);};}
const connect=http2.connect;http2.connect=function(authority,...args){checkRequest(authority);return connect.call(this,authority,...args);};
for(const[module,name]of[[net,'connect'],[net,'createConnection'],[tls,'connect'],[net.Socket.prototype,'connect']]){const original=module[name];module[name]=function(...args){socketArgs(args);return original.apply(this,args);};}
const nativeFetch=globalThis.fetch;globalThis.fetch=async function(input,...args){checkRequest(typeof input==='string'||input instanceof URL?input:input.url);return nativeFetch.call(this,input,...args);};
for(const key of Object.keys(process.env))if(/SERVICE_ACCOUNT|API_KEY|AZURE_SPEECH_KEY|PADDLE_CLIENT_TOKEN|PADDLE_WEBHOOK_SECRET|CLOUDFLARE_API_TOKEN|GOOGLE_APPLICATION_CREDENTIALS|^(?:https?|all|ws|wss)_proxy$/i.test(key))delete process.env[key];
syncBuiltinESMExports();
