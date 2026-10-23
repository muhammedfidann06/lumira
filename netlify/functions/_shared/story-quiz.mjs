import{tokens,normalize}from'./story-core.mjs';
// Answer keys are derived from the final saved text/lexicon. A provider's
// unverified numeric answer never determines the grade.
const copy={tr:['Bu bölüm ne anlatıyor?','Hikâyedeki “{word}” burada hangi anlama geliyor?'],en:['What does this passage say?','What does “{word}” mean here in the story?'],de:['Was steht in diesem Abschnitt?','Was bedeutet „{word}“ hier in der Geschichte?'],ar:['ماذا يقول هذا المقطع؟','ما معنى «{word}» هنا في القصة؟'],fr:['Que dit ce passage ?','Que signifie « {word} » ici dans l’histoire ?'],es:['¿Qué dice este pasaje?','¿Qué significa «{word}» aquí en la historia?'],ru:['О чём говорится в этом отрывке?','Что означает «{word}» в этом месте рассказа?']};
export function buildComprehension(story,options,{reviewed=false}={}){
 const {sentences,focus}=story,native=options.native,labels=copy[native]||copy.en,questions=[];
 const choicesFor=(correct,others,answer)=>{const distinct=[...new Set(others)].filter(value=>normalize(value,native)!==normalize(correct,native)).slice(0,2);if(distinct.length!==2)return null;const choices=[correct,...distinct];for(let n=0;n<answer;n++)choices.unshift(choices.pop());return choices;};
 const core=reviewed?(options.level>0?5:4):0;
 const evidenceRows=reviewed?[core+2,core+3]:[Math.floor(sentences.length*.35),Math.floor(sentences.length*.7)];
 for(const evidence of evidenceRows){
  const choices=choicesFor(sentences[evidence].translation,sentences.filter((_,i)=>i!==evidence).map(row=>row.translation).reverse(),questions.length);
  if(choices)questions.push({kind:'passage',question:labels[0],choices,answer:questions.length,evidence,quote:sentences[evidence].text,showQuote:true});
 }
 const inPassage=(row,text)=>row.forms.some(form=>(' '+tokens(text,options.language).join(' ')+' ').includes(' '+tokens(form,options.language).join(' ')+' '));
 const passage=(reviewed?sentences.slice(core,core+6):sentences).map(row=>row.text).join(' ');
 const entry=focus.find(row=>row.forms.some(form=>tokens(form,options.language).some(word=>word.length>=4))&&inPassage(row,passage))||focus.find(row=>row.meaning),evidence=entry?sentences.findIndex(row=>entry.forms.some(form=>(' '+tokens(row.text,options.language).join(' ')+' ').includes(' '+tokens(form,options.language).join(' ')+' '))):-1;
 if(entry&&evidence>=0){const answer=questions.length,choices=choicesFor(entry.meaning,focus.filter(row=>row!==entry).map(row=>row.meaning),answer);if(choices)questions.push({kind:'word',question:labels[1].replace('{word}',entry.word),choices,answer,evidence,quote:sentences[evidence].text,showQuote:true});}
 if(questions.length<3){const evidence=Math.floor(sentences.length/2),answer=2,choices=choicesFor(sentences[evidence].translation,sentences.filter((_,i)=>i!==evidence).map(row=>row.translation),answer);if(choices)questions.push({kind:'passage',question:labels[0],choices,answer,evidence,quote:sentences[evidence].text,showQuote:true});}
 return questions.slice(0,3);
}
