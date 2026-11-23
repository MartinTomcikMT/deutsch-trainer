/* Deutsch Trainer 1.8: fixed 15-step, level-based guided learning. */
'use strict';
const DeutschGame = (()=>{
  const SIZE=5, STEPS=15, OPENING=10, PASS=12;
  const sortWeak = (a,b) => {
    const sa=a.review||{},sb=b.review||{};
    const weak=x=>Number(x.wrong||0)*4-Number(x.correct||0)+((x.dueAt&&new Date(x.dueAt)<=new Date())?5:0);
    return weak(sb)-weak(sa);
  };
  function shuffled(arr){const x=[...arr];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;}
  function translation(e,reverse=false,method){return {kind:reverse?'sk_to_de':'de_to_sk',entryId:e.id,modeHint:method||'type'};}
  function match5(pool){
    const unique=[...new Map(pool.map(e=>[e.id,e])).values()];
    const chosen=unique.filter(e=>!!e.sk&&!!e.de).slice(0,5);
    if(chosen.length<5)return null;
    const primary=e=>{
      if(e.type==='phrase'){const m=e.sk.split(/(?<=[?])\s+(?=[\p{Lu}])/u).filter(Boolean);if(m.length>1&&m.every(x=>x.endsWith('?')))return m[0];}
      return e.sk.split(/\s*[,;]\s*/)[0].trim();
    };
    const vals=chosen.map(primary);
    if(new Set(vals.map(x=>x.toLowerCase())).size!==5)return null;
    return {kind:'match5',entryId:chosen[0].id,pairs:chosen.map((e,i)=>({entryId:e.id,de:(e.article?e.article+' ':'')+e.de,sk:vals[i]}))};
  }
  const tokenRx=/[A-Za-zÄÖÜäöüß]{3,}/g;
  function clozeChoice(e,pool){
    if(e.type!=='phrase'||!e.de||!e.sk||e.de.length>170||!/[.!?]$/.test(e.de.trim())||!/[.!?]$/.test(e.sk.trim())||e.de.trim().split(/\s+/).length<3)return null;
    const tokens=[...e.de.matchAll(tokenRx)].filter(m=>m[0].length>=4 && !['nicht','einen','einer','einem','diese','dieses','haben','sowie','unser','meine'].includes(m[0].toLowerCase()));
    if(!tokens.length)return null;
    const token=tokens[Math.floor(tokens.length/2)],answer=token[0];
    const others=[];
    const source=pool.filter(x=>x.id!==e.id).flatMap(x=>[...(x.de||'').matchAll(tokenRx)].map(m=>m[0]));
    for(const word of shuffled(source)){
      if(word.toLowerCase()===answer.toLowerCase()||e.de.toLowerCase().includes(word.toLowerCase())||others.some(x=>x.toLowerCase()===word.toLowerCase()))continue;
      if(Math.abs(word.length-answer.length)>5)continue;
      others.push(word);if(others.length===2)break;
    }
    if(others.length!==2)return null;
    return {kind:'clozeChoice',entryId:e.id,question:e.de.slice(0,token.index)+'_____'+e.de.slice(token.index+answer.length),answer,fullDe:e.de,fullSk:e.sk,choices:shuffled([{label:answer,correct:true},...others.map(label=>({label,correct:false}))])};
  }
  function buildSentence(e,pool){
    if(e.type!=='phrase'||!e.de||!e.sk||e.de.length>140||!/[.!?]$/.test(e.de.trim())||!/[.!?]$/.test(e.sk.trim()))return null;
    const toks=e.de.replace(/[.!?]+$/,'').split(/\s+/).filter(Boolean);
    if(toks.length<3||toks.length>11||new Set(toks.map(x=>x.toLowerCase())).size!==toks.length)return null;
    let distractors=[];
    const elsewhere=pool.filter(x=>x.id!==e.id).flatMap(x=>String(x.de).replace(/[.!?]+$/,'').split(/\s+/));
    for(const w of shuffled(elsewhere)){
      if(!w||!/^[\p{L}]{3,}$/u.test(w)||toks.some(t=>t.toLowerCase()===w.toLowerCase())||distractors.includes(w))continue;
      distractors.push(w);if(distractors.length===2)break;
    }
    if(distractors.length<2)return null;
    const bank=shuffled([...toks.map((word,i)=>({id:'c'+i,word,correct:true})),...distractors.map((word,i)=>({id:'d'+i,word,correct:false}))]);
    return {kind:'buildSentence',entryId:e.id,answer:e.de,fullSk:e.sk,fullDe:e.de,correctTokens:toks,bank};
  }
  function buildOpening(focus,review,source){
    if(!focus.length)return [];
    const tasks=focus.map(e=>translation(e,false,'choices'));
    const all=[...focus,...review];
    const pairs=match5([...focus,...review]);
    if(pairs)tasks.push(pairs);
    const phrases=[...focus,...review].filter(x=>x.type==='phrase');
    const fill=phrases.map(e=>clozeChoice(e,source)).find(Boolean);
    if(fill)tasks.push(fill);
    const build=phrases.map(e=>buildSentence(e,source)).find(Boolean);
    if(build)tasks.push(build);
    const repeats=shuffled([...review].sort(sortWeak));
    if(repeats.length)tasks.push(translation(repeats[0],repeats[0].type!=='phrase','type'));
    let i=0;
    while(tasks.length<OPENING){
      const e=(i%3===2&&review.length?review[i%review.length]:focus[i%focus.length]);
      tasks.push(translation(e,i%2===1,i%3===0?'choices':'type'));
      i++;
    }
    return tasks.slice(0,OPENING).map((t,i)=>({...t,stage:'new',step:i+1}));
  }
  function buildRecap(focus,review,misses){
    const byId=new Map([...focus,...review].map(e=>[e.id,e]));
    const wrong=[...new Set(misses.filter(id=>byId.has(id)))].map(id=>byId.get(id));
    const prioritized=[...wrong,...[...focus,...review].sort(sortWeak).filter(e=>!wrong.some(x=>x.id===e.id))];
    if(!prioritized.length)return [];
    const result=[];
    for(let i=0;i<STEPS-OPENING;i++){
      const e=prioritized[i%prioritized.length];
      result.push({...translation(e,i%2===0,'type'),stage:'recap',step:OPENING+i+1});
    }
    return result;
  }
  return {SIZE,STEPS,OPENING,PASS,match5,clozeChoice,buildSentence,buildOpening,buildRecap,sortWeak};
})();
