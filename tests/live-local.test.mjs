import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioBufferQueue, Resampler, languageScores, removeOverlap } from '../live-local-core.mjs';

test('phone sample rates retain exactly one second at 16kHz across irregular callbacks',()=>{
  for(const rate of [16000,44100,48000]){
    const chunks=[],resampler=new Resampler(rate,audio=>chunks.push(audio));
    const input=new Float32Array(rate).fill(0.25);
    for(let i=0;i<input.length;i+=127)resampler.push(input.subarray(i,i+127));
    assert.equal(chunks.reduce((n,x)=>n+x.length,0),16000);
    assert.ok(chunks.every(audio=>audio.every(x=>Math.abs(x-0.25)<1e-6)));
  }
});
test('audio backpressure never drops speech silently or allocates an unlimited recording',()=>{
  const queue=new AudioBufferQueue(8);queue.push(Float32Array.of(1,2,3));queue.push(Float32Array.of(4,5,6,7,8));
  assert.throws(()=>queue.push(Float32Array.of(9)),e=>e.featureCode==='local_too_slow');
  assert.equal(queue.length,8);assert.deepEqual([...queue.take(5)],[1,2,3,4,5]);
  queue.push(Float32Array.of(9,10));assert.deepEqual([...queue.take()],[6,7,8,9,10]);assert.equal(queue.length,0);
});
test('overlap is removed only at adjacent joins, preserving repeated speech elsewhere',()=>{
  assert.equal(removeOverlap('We start the lesson now.','the lesson now, and continue.'),'and continue.');
  assert.equal(removeOverlap('We learned this yesterday.','We learned this today.'),'We learned this today.');

});
test('language labels come from audio-token scores, including unsupported languages; English is not a default',()=>{
  const logits=Float32Array.of(0,2,8,-1,1);
  assert.equal(languageScores(logits,{'<|en|>':1,'<|de|>':2},4).language,'de');
  assert.equal(languageScores(logits,{'<|en|>':1,'<|ja|>':2},4).language,'ja');
});
