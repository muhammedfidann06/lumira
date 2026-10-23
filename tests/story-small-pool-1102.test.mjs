import test from 'node:test';import assert from 'node:assert/strict';
import {generateStory} from '../netlify/functions/_shared/story-providers.mjs';
import {knownStory} from '../netlify/functions/_shared/story-library.mjs';
import {validateNarrative} from '../netlify/functions/_shared/story-narrative.mjs';
import {LANGUAGES} from '../netlify/functions/_shared/story-core.mjs';
import {poolFor,options} from './story-fixtures.mjs';
for(const language of LANGUAGES)for(const native of LANGUAGES.filter(v=>v!==language))for(const genre of['daily','mystery','adventure','fairy','scifi','comedy'])for(let level=0;level<4;level++)test(`50 actual learned cards, free reading ${language}/${native}/${genre}/${level}`,()=>{
 const pool=poolFor(language,native),o=options(language,native,level,genre),story=knownStory(pool,o);assert(story);assert.equal(story.provider,'library');assert.equal(story.questions.length,3);assert(story.focus.length>0);assert(story.wordCount>=120);assert.equal(story.sentences.length,level?16:14);assert.doesNotThrow(()=>validateNarrative(story,pool,o,{reviewed:true}));
 for(const q of story.questions){assert(q.showQuote);if(q.kind==='word')assert(story.focus.some(row=>row.meaning===q.choices[q.answer]));else assert.equal(q.choices[q.answer],story.sentences[q.evidence].translation);assert.equal(q.quote,story.sentences[q.evidence].text);}
});
for(const language of LANGUAGES)test('explicit free mode never makes an API request, even when keys are configured: '+language,async()=>{
 let calls=0;const result=await generateStory(poolFor(language),{...options(language),engine:'reviewed'},{env:{GEMINI_API_KEY:'fixture',GROQ_API_KEY:'fixture'},fetcher:async()=>calls++});assert.equal(calls,0);assert.equal(result.method,'reviewed');assert.equal(result.questions.length,3);
});
