/* Public dictionary parsing runs away from the UI thread. No account or
   microphone data enters this worker. Acknowledged batches bound clone work. */
(function(){'use strict';
 let ready=false,rows=[],offset=0;
 const fail=()=>{self.postMessage({type:'error'});};
 function next(){if(!ready)return;if(offset>=rows.length){self.postMessage({type:'done',total:rows.length});return;}const start=offset;offset=Math.min(rows.length,offset+256);self.postMessage({type:'batch',offset:start,rows:rows.slice(start,offset)});}
 self.onmessage=function(event){const data=event.data||{};
  if(data.type==='next'){next();return;}
  if(data.type!=='load'||ready)return;
  if(!['de','en','ar','fr','es','ru'].includes(data.language)||!/^\d+\.\d+\.\d+$/.test(data.version||'')){fail();return;}
  try{
   importScripts(new URL('./vocab-core.js?v='+data.version,self.location.href).href,new URL('./vocab-'+data.language+'.js?v='+data.version,self.location.href).href);
   rows=VOCAB.filter(row=>row.lang===data.language);if(!rows.length||rows.length>100000)throw Error('dictionary_size');
   ready=true;self.postMessage({type:'meta',total:rows.length});next();
  }catch{fail();}
 };
})();

