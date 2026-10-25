/* Browser-managed recognition is a small fallback for phones: it never loads
   Whisper/Bergamot into the page. Speech service availability remains a browser
   capability; no Web API can promise recognition on every device/offline. */
(function(root){'use strict';
 const fail=code=>Object.assign(Error(code),{featureCode:code});
 class BrowserSession{
  static supported(){return typeof(root.SpeechRecognition||root.webkitSpeechRecognition)==='function'&&!!root.LUMIRA_TEXT;}
  constructor({source,target,id,onResult,onDraft,onError,onReady,server}){Object.assign(this,{source,target,id,onResult,onDraft,onError,onReady});this.attempt=0;this.translations=new root.LUMIRA_TEXT.TextQueue({id,target,server,onResult,onError});}
  start(){if(!BrowserSession.supported())throw fail('browser_speech_unsupported');this.closed=false;const Recognition=root.SpeechRecognition||root.webkitSpeechRecognition,recognizer=this.recognizer=new Recognition();recognizer.lang=root.LUMIRA_SOURCE.locales[this.source];recognizer.continuous=true;recognizer.interimResults=true;recognizer.maxAlternatives=1;
   recognizer.onstart=()=>{if(this.closed)return;this.onReady?.();};
   recognizer.onresult=event=>{if(this.closed)return;const results=event?.results,length=results?.length,start=Number.isSafeInteger(event?.resultIndex)&&event.resultIndex>=0?event.resultIndex:0;if(!Number.isSafeInteger(length)||length<start)return;if(length-start>64){this.stop();this.onError?.(fail('text_translation_slow'));return;}this.attempt=0;let draft='';for(let index=start;index<length&&!this.closed;index++){const row=results[index],text=typeof row?.[0]?.transcript==='string'?row[0].transcript.trim().slice(0,4000):'';if(!text)continue;if(row.isFinal)this.translations.add({original:text,language:this.source});else draft=(draft+text+' ').slice(-4000);}if(!this.closed)this.onDraft?.(draft.trim());};
   recognizer.onerror=event=>{if(this.closed)return;const code=String(event.error||'');if(['not-allowed','service-not-allowed','audio-capture','language-not-supported'].includes(code)){this.stop();this.onError?.(fail(code==='audio-capture'?'microphone_unavailable':code==='language-not-supported'?'browser_speech_unsupported':'microphone_denied'));}else if(!['no-speech','aborted'].includes(code)&&++this.attempt>=3){this.stop();this.onError?.(fail('browser_speech_unavailable'));}};
   recognizer.onend=()=>{if(this.closed)return;clearTimeout(this.timer);this.timer=setTimeout(()=>{if(this.closed)return;try{recognizer.start();}catch{if(++this.attempt>=3){this.stop();this.onError?.(fail('browser_speech_unavailable'));}else recognizer.onend();}},400+this.attempt*300);};
   try{recognizer.start();}catch{this.stop();throw fail('browser_speech_unavailable');}
  }
  stop(){this.closed=true;clearTimeout(this.timer);this.translations.stop();if(this.recognizer){this.recognizer.onresult=this.recognizer.onerror=this.recognizer.onend=this.recognizer.onstart=null;try{this.recognizer.abort();}catch{}this.recognizer=null;}}
 }
 root.LUMIRA_BROWSER={BrowserSession};
})(window);
