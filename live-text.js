/* Small text-only translation: existing server providers, then the documented
   anonymous MyMemory API. No credentials or downloadable speech models. */
(function(root){'use strict';
 const languages=['tr','de','en','ar','fr','es','ru'],fail=code=>Object.assign(Error(code),{featureCode:code});
 const allowed=value=>typeof value==='string'&&value.trim()&&value.length<=4000;
 function segments(text){const result=[];let chunk='';for(const word of text.match(/\S+\s*/gu)||[]){if(new TextEncoder().encode(chunk+word).length>450&&chunk){result.push(chunk.trim());chunk='';}if(new TextEncoder().encode(word).length>450)throw fail('invalid_input');chunk+=word;}if(chunk.trim())result.push(chunk.trim());return result;}
 function plain(text){const field=document.createElement('textarea');field.innerHTML=text;return field.value.replace(/<[^>]*>/gu,'').trim();}
 async function translate(text,source,target,{id,signal,server=true}={}){
  if(!allowed(text)||!languages.includes(source)||!languages.includes(target))throw fail('invalid_input');if(source===target)return text;
  if(signal?.aborted)throw fail('recognizer_replaced');
  if(server&&id)try{const result=await root.LUMIRA_FEATURES.api('liveText',{id,text,source,target},{signal,timeoutMs:9000});if(allowed(result.translated))return result.translated;}catch(error){if(['login_required','live_limit','session_expired','maintenance','usage_unavailable'].includes(error.featureCode)||signal?.aborted)throw error;}
  const result=[];
  for(const part of segments(text)){
   const controller=new AbortController(),stop=()=>controller.abort();signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)controller.abort();const timer=setTimeout(stop,12000);
   try{const url=new URL('https://api.mymemory.translated.net/get');url.searchParams.set('q',part);url.searchParams.set('langpair',source+'|'+target);
    const response=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'}),data=await response.json();
    if(data.quotaFinished||Number(data.responseStatus)===429)throw fail('free_text_limit');
    const value=data.responseData?.translatedText;if(!response.ok||Number(data.responseStatus)!==200||!allowed(value)||/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID LANGUAGE PAIR/iu.test(value))throw fail('text_translation_unavailable');result.push(plain(value));
   }catch(error){throw error.featureCode?error:fail(signal?.aborted?'recognizer_replaced':'text_translation_unavailable');}finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);}
  }return result.join(' ');
 }
 class TextQueue{
  constructor({id,target,onResult,onError,server=true}){Object.assign(this,{id,target,onResult,onError,server});this.items=[];this.abort=new AbortController();}
  // Fast speech is batched instead of ending the lesson: queued phrases of the
  // same language share one request, and only a very old backlog is skipped.
  add(entry){if(this.closed)return;const last=this.items.at(-1);
   if(last&&last.language===entry.language&&(last.original+' '+entry.original).length<=1500){last.original+=' '+entry.original;if(entry.row)(last.rows||=last.row?[last.row]:[]).push(entry.row);return;}
   if(this.items.length>=24)this.onError?.(fail('text_translation_slow'),this.items.shift());
   this.items.push(entry);this.pump();}
  async pump(){if(this.running||this.closed)return;this.running=true;try{while(this.items.length&&!this.closed){const entry=this.items.shift();try{const translated=await translate(entry.original,entry.language,this.target,{id:this.id,signal:this.abort.signal,server:this.server});if(!this.closed)this.onResult?.({...entry,translated});}catch(error){if(!this.closed)this.onError?.(error,entry);}}}finally{this.running=false;}}
  stop(){this.closed=true;this.items=[];this.abort.abort();}
 }
 root.LUMIRA_TEXT={translate,TextQueue,segments};
})(window);
