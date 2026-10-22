/* Small browser transports. Permanent provider keys remain in Netlify. */
(function () {
  'use strict';
  const fail = code => Object.assign(new Error(code), { featureCode:code });
  const code = name => ({turkish:'tr',german:'de',english:'en',arabic:'ar',french:'fr',spanish:'es',russian:'ru'}[String(name||'').toLowerCase()] || String(name||'').split('-')[0]);
  function base64(bytes) {
    let text=''; for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return btoa(text);
  }
  function pcm(audio) {
    const bytes=new Uint8Array(audio.length*2), view=new DataView(bytes.buffer);
    for(let i=0;i<audio.length;i++){const n=Math.max(-1,Math.min(1,audio[i]));view.setInt16(i*2,n<0?n*32768:n*32767,true);}
    return bytes;
  }
  function wave(audio) {
    const body=pcm(audio), out=new Uint8Array(44+body.length),v=new DataView(out.buffer);
    const word=(offset,text)=>{for(let i=0;i<text.length;i++)out[offset+i]=text.charCodeAt(i);};
    word(0,'RIFF');v.setUint32(4,36+body.length,true);word(8,'WAVE');word(12,'fmt ');v.setUint32(16,16,true);
    v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,body.length,true);out.set(body,44);
    return base64(out);
  }
  class CloudSession {
    constructor({provider,credential,target,source='auto',id,entryId,onResult,onError,onCommit,onReady}) {
      Object.assign(this,{provider,credential,target,source,id,entryId,onResult,onError,onCommit,onReady});
      this.closed=false;this.original='';this.translated='';this.parts=[];this.length=0;this.position=0;this.quiet=0;this.lastReply=performance.now();this.speechSince=0;
      this.abort=new AbortController();
    }
    async start() {
      if(this.provider!=='gemini'){this.ready=true;this.onReady?.();return;}
      const url='wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?access_token='+encodeURIComponent(this.credential.token);
      this.socket=new WebSocket(url);
      await new Promise((resolve,reject)=>{
        let done=false;
        const finish=error=>{if(done)return;done=true;clearTimeout(timer);this.cancelStart=null;error?reject(error):resolve();};
        this.cancelStart=()=>finish(fail('recognizer_replaced'));
        const timer=setTimeout(()=>finish(fail('speech_unavailable')),6000);
        this.socket.onopen=()=>{
          if(this.closed)return;
          const {inputAudioTranscription,outputAudioTranscription,...generationConfig}=this.credential.config;
          this.socket.send(JSON.stringify({setup:{model:'models/'+this.credential.model,generationConfig,inputAudioTranscription,outputAudioTranscription}}));
        };
        this.socket.onerror=()=>{finish(fail('speech_unavailable'));if(this.ready)this.fault();};
        this.socket.onclose=()=>{finish(fail('speech_unavailable'));if(!this.closed && this.ready)this.fault();};
        this.socket.onmessage=async({data})=>{
          if(this.closed)return;
          try {
            const event=JSON.parse(typeof data==='string'?data:await data.text());
            if(this.closed)return;
            if(event.error){finish(fail('speech_unavailable'));this.fault();return;}
            if(event.setupComplete || event.setup_complete){this.ready=true;finish();this.onReady?.();}
            const content=event.serverContent || event.server_content;
            if(content){
              const input=content.inputTranscription || content.input_transcription;
              const output=content.outputTranscription || content.output_transcription;
              if(input?.text)this.original+=input.text;
              if(output?.text){this.translated+=output.text;this.lastReply=performance.now();this.speechSince=0;}
              this.language=code(input?.languageCode || input?.language_code || this.language);
              if(input?.text || output?.text || content.turnComplete || content.turn_complete)this.onResult?.({id:this.entryId || this.id+'-gemini',original:this.original,translated:this.translated,language:this.language,partial:!(input?.finished || output?.finished || content.turnComplete || content.turn_complete)});
              if(output?.finished || content.turnComplete || content.turn_complete)this.onCommit?.(Math.max(0,this.position-2));
            }
            // A planned provider session boundary rotates a fresh credential;
            // quotas/errors instead move to the next provider.
            if(event.goAway || event.go_away){this.onError?.(fail('cloud_rotate'));}
          } catch { finish(fail('speech_unavailable'));this.fault(); }
        };
      });
      if(this.closed)throw fail('recognizer_replaced');
      this.rotate=setTimeout(()=>{if(!this.closed)this.onError?.(fail('cloud_rotate'));},8*60000);
    }
    receive(audio,position) {
      if(this.closed || !this.ready)return;
      this.position=position;
      let sum=0;for(const n of audio)sum+=n*n;
      const speech=Math.sqrt(sum/Math.max(1,audio.length))>0.008;
      if(this.provider==='gemini') {
        if(this.socket?.readyState!==1){this.fault();return;}
        // A failover replays up to 60 seconds of uncommitted PCM. Its encoded
        // burst must fit without falsely rejecting a healthy next provider.
        if(this.socket.bufferedAmount>3*1024*1024){this.fault();return;}
        if(speech && !this.speechSince)this.speechSince=performance.now();
        if(this.speechSince && performance.now()-this.speechSince>15000 && performance.now()-this.lastReply>15000){this.fault();return;}
        try{this.socket.send(JSON.stringify({realtimeInput:{audio:{data:base64(pcm(audio)),mimeType:'audio/pcm;rate=16000'}}}));}catch{this.fault();}
        return;
      }
      this.parts.push(audio.slice());this.length+=audio.length;this.quiet=speech?0:this.quiet+audio.length;
      if(this.length>16000*75){this.fault();return;}
      if(this.length>=16000*6 || (this.length>=16000*4 && this.quiet>=9600))this.pump();
    }
    async pump() {
      if(this.closed || this.processing || this.length<64000)return;
      this.processing=true;
      const take=Math.min(96000,this.length), audio=new Float32Array(take+(this.tail?.length || 0));
      if(this.tail)audio.set(this.tail);
      let cursor=this.tail?.length || 0, remaining=take;
      while(remaining){const p=this.parts.shift(),n=Math.min(remaining,p.length);audio.set(p.subarray(0,n),cursor);cursor+=n;remaining-=n;if(n<p.length)this.parts.unshift(p.subarray(n));}
      this.length-=take;this.tail=audio.slice(-5600);
      const end=this.position-this.length/16000;
      let sum=0;for(const n of audio)sum+=n*n;
      try {
        if(Math.sqrt(sum/audio.length)<0.006){this.onCommit?.(end);return;}
        const result=await window.LUMIRA_FEATURES.audio({id:this.id,provider:this.provider,target:this.target,source:this.source,audio:wave(audio)},{signal:this.abort.signal,timeoutMs:11500});
        if(this.closed)return;
        this.lastReply=performance.now();
        if(!result.empty)this.onResult?.(result);
        this.onCommit?.(end);
      } catch(error) {if(!this.closed)this.onError?.(error.featureCode==='session_expired'?fail('speech_unavailable'):error);}
      finally{this.processing=false;if(!this.closed && this.length>=96000)queueMicrotask(()=>this.pump());}
    }
    fault() {if(!this.closed){this.ready=false;this.onError?.(fail('speech_unavailable'));}}
    stop() {this.closed=true;this.ready=false;clearTimeout(this.rotate);this.abort.abort();this.cancelStart?.();this.cancelStart=null;this.socket?.close();this.parts=[];this.length=0;}
  }
  window.LUMIRA_CLOUD={CloudSession,wave};
})();
