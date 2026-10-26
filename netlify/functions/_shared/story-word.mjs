import {contextualMeaning,validateWordMeaning} from './story-meaning.mjs';
import {fault} from './feature-core.mjs';
import {atomic} from './paddle-events.mjs';
const idOK=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(id);
// Contextual meaning of one tapped word in a saved story. Shared by the full
// stories endpoint and the small story-word endpoint, which avoids loading the
// 6.8 MB word catalog just to answer a tap.
export async function storyWord(ctx,body,{meaning=contextualMeaning,clock=Date.now}={}){
 if(!idOK(body.id)||!Number.isInteger(body.sentence)||body.sentence<0||body.sentence>99||!Number.isInteger(body.position)||body.position<0||body.position>3000)throw fault('invalid_input',422);
 const story=(await ctx.db.ref('serverStories/'+ctx.uid+'/'+body.id).get()).val(),sentence=story?.sentences?.[body.sentence];if(!story||!sentence)throw fault('story_not_found',404);
 const word=sentence.text.match(/[\p{L}\p{M}]+(?:['’ʼ-][\p{L}\p{M}]+)*|\p{N}+/gu)?.[body.position];if(!word)throw fault('invalid_input',422);
 const input={word,position:body.position,language:story.options.language,native:story.options.native,sentence:sentence.text,translation:sentence.translation},ref=ctx.db.ref('serverStoryWordMeanings/'+ctx.uid+'/'+body.id+'/'+body.sentence+'_'+body.position),cached=(await ref.get()).val();
 if(cached&&validateWordMeaning(cached,input))return{...cached,contextual:true};
 await atomic(ctx.db.ref('serverStoryWordBudget/'+ctx.uid),value=>{const starts=(Array.isArray(value?.starts)?value.starts:[]).filter(time=>Number.isFinite(time)&&time>clock()-60000);if(starts.length>=60)throw fault('story_busy',429);return{starts:[...starts,clock()]};});
 const result=validateWordMeaning(await meaning(input),input);if(result){await ref.set(result);return{...result,contextual:true};}return{word,meaning:'',contextual:false};
}
