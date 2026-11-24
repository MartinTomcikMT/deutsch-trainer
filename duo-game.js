/* Deutsch Trainer 1.9.41 – guaranteed sentence mix, spaced balanced review, A2+ grammar and final exam. */
'use strict';
const DeutschGame = (()=>{
  const SIZE=5,STEPS=15,OPENING=10,PASS=12,EXAM_STEPS=50,EXAM_PASS=40;
  function shuffled(arr){const x=[...arr];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;}
  function weakScore(e){
    const s=e.review||{},total=Math.max(1,Number(s.attempts)||0);
    const rate=(Number(s.wrong)||0)/total;
    const stale=s.lastReviewed?(Date.now()-new Date(s.lastReviewed).getTime())/86400000:0;
    const overdue=s.dueAt&&new Date(s.dueAt).getTime()<=Date.now()?1:0;
    return 5*rate+Math.min(1.5,Math.max(0,stale)/10)+overdue+(s.streak===0&&total>0?0.5:0);
  }
  const sortWeak=(a,b)=>weakScore(b)-weakScore(a);
  const translation=(e,reverse=false,method='type')=>({kind:reverse?'sk_to_de':'de_to_sk',entryId:e.id,modeHint:method});
  function selectReviews(review,count=12){
    const unique=[...new Map(review.map(e=>[e.id,e])).values()],selected=[],used=new Set();
    const take=(list,n)=>{for(const e of list){if(selected.length>=count||n<=0)break;if(!used.has(e.id)){selected.push(e);used.add(e.id);n--;}}};
    const weak=shuffled(unique.filter(e=>Number(e.review?.wrong||0)>0)).sort(sortWeak);
    const solid=shuffled(unique.filter(e=>Number(e.review?.correct||0)>=2&&Number(e.review?.streak||0)>=1));
    const due=shuffled(unique.filter(e=>e.review?.dueAt&&new Date(e.review.dueAt).getTime()<=Date.now()));
    take(weak,Math.ceil(count*.4));take(solid,Math.ceil(count*.3));take(due,Math.ceil(count*.2));take(shuffled(unique),count);
    return selected;
  }
  function match5(pool){
    const unique=[...new Map(pool.map(e=>[e.id,e])).values()];
    const primary=e=>e.type==='phrase'?String(e.sk).split(/(?<=[?])\s+(?=[\p{Lu}])/u)[0].split(/\s*;\s*/)[0].trim():String(e.sk).split(/\s*[,;]\s*/)[0].trim();
    const chosen=[],answers=new Set();
    for(const e of shuffled(unique)){const sk=primary(e),key=sk.toLocaleLowerCase('sk');if(!e.de||!sk||answers.has(key))continue;chosen.push(e);answers.add(key);if(chosen.length===5)break;}
    if(chosen.length<5)return null;
    return {kind:'match5',entryId:chosen[0].id,pairs:chosen.map(e=>({entryId:e.id,de:(e.article?e.article+' ':'')+e.de,sk:primary(e)}))};
  }
  const tokenRx=/[A-Za-zÄÖÜäöüß]{3,}/g;
  function clozeChoice(e,pool){
    if(e.type!=='phrase'||!e.de||!e.sk||e.de.length>170||!/[.!?]$/.test(e.de.trim())||!/[.!?]$/.test(e.sk.trim())||e.de.trim().split(/\s+/).length<3)return null;
    const tokens=[...e.de.matchAll(tokenRx)].filter(m=>m[0].length>=4&&!['nicht','einen','einer','einem','diese','dieses','haben','sowie','unser','meine'].includes(m[0].toLowerCase()));
    if(!tokens.length)return null;
    const token=tokens[Math.floor(Math.random()*tokens.length)],answer=token[0];const others=[];
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
    const distractors=[],elsewhere=pool.filter(x=>x.id!==e.id).flatMap(x=>String(x.de).replace(/[.!?]+$/,'').split(/\s+/));
    for(const w of shuffled(elsewhere)){
      if(!w||!/^[\p{L}]{3,}$/u.test(w)||toks.some(t=>t.toLowerCase()===w.toLowerCase())||distractors.some(x=>x.toLowerCase()===w.toLowerCase()))continue;
      distractors.push(w);if(distractors.length===2)break;
    }
    if(distractors.length<2)return null;
    const bank=shuffled([...toks.map((word,i)=>({id:'c'+i,word,correct:true})),...distractors.map((word,i)=>({id:'d'+i,word,correct:false}))]);
    return {kind:'buildSentence',entryId:e.id,answer:e.de,fullSk:e.sk,fullDe:e.de,correctTokens:toks,bank};
  }
  const articles={der:{Akkusativ:'den',Dativ:'dem'},die:{Akkusativ:'die',Dativ:'der'},das:{Akkusativ:'das',Dativ:'dem'}};
  function caseArticle(e,caseName){
    if(e.type!=='noun'||!articles[e.article])return null;
    return {kind:'case_article',entryId:e.id,caseName,answer:articles[e.article][caseName]};
  }
  function grammarTasks(pool,count,level){
    if(level<3)return [];
    const seen=pool.filter(e=>Number(e.review?.attempts||0)>0);
    const verbs=shuffled(seen.filter(e=>e.type==='verb'&&e.perfect&&e.preterite));
    const nouns=shuffled(seen.filter(e=>e.type==='noun'&&e.article));
    const used=new Set(),chosen=[];
    // Rotate across tense practice, case declension and noun plurals.
    const primary=level%3===0?['perfect','case_article']:level%3===1?['preterite','plural']:['perfect','preterite'];
    const desired=[...primary,'case_article','plural','article','perfect','preterite'];
    for(const kind of desired){
      if(chosen.length>=count)break;
      const from=(kind==='perfect'||kind==='preterite')?verbs:nouns;
      const candidates=from.filter(e=>!used.has(e.id)&&(kind!=='plural'||e.plural));
      // First train forms not previously asked, then retry incorrect forms, then known forms.
      candidates.sort((a,b)=>{
        const modeA=a.reviewModes?.[kind]||{},modeB=b.reviewModes?.[kind]||{};
        return (Number(modeA.attempts||0)-Number(modeB.attempts||0))||(Number(modeB.wrong||0)-Number(modeA.wrong||0));
      });
      const e=candidates[0];if(!e)continue;
      used.add(e.id);
      chosen.push(kind==='case_article'?caseArticle(e,level%2?'Dativ':'Akkusativ'):{kind,entryId:e.id,modeHint:'type'});
    }
    return chosen.filter(Boolean);
  }
  // The older routine appended grammar last and popped off the last tasks to
  // stay within ten questions. This inadvertently removed sentence building.
  // Explicitly reserve slots for different task families BEFORE filling with
  // translations; later grammar tasks must never displace a built sentence.
  function buildOpening(focus,review,source,level=1){
    if(!focus.length)return [];
    const picked=selectReviews(review,10);
    const already=[...new Map([...focus,...picked].map(e=>[e.id,e])).values()];
    const knownSentences=shuffled(already.filter(e=>e.type==='phrase'));
    const seenInLesson=shuffled(source.filter(e=>e.type==='phrase'&&Number(e.review?.attempts||0)>0));
    const futureSentences=shuffled(source.filter(e=>e.type==='phrase'));
    const sentencePool=[...new Map([...knownSentences,...seenInLesson,...futureSentences].map(e=>[e.id,e])).values()];
    const findTask=make=>sentencePool.map(e=>make(e,source)).find(Boolean);
    const build=findTask(buildSentence);
    const cloze=findTask(clozeChoice);
    const pairs=match5([...focus,...picked]);
    const grammar=grammarTasks([...picked,...focus],level>=3?2:0,level);
    const tasks=[];
    // Introduce the five level words before adding any mixed exercises.
    for(const e of focus)tasks.push(translation(e,false,'choices'));
    // A sentence and a fill-in-the-blank now have protected positions.
    if(build)tasks.push(build);
    if(cloze)tasks.push(cloze);
    if(pairs)tasks.push(pairs);
    tasks.push(...grammar);
    let idx=0;
    while(tasks.length<OPENING){
      const e=picked.length&&idx%2===0?picked[Math.floor(idx/2)%picked.length]:focus[idx%focus.length];
      tasks.push(translation(e,idx%3===0,'type'));idx++;
    }
    return tasks.slice(0,OPENING).map((t,i)=>({...t,stage:'new',step:i+1}));
  }
  function buildRecap(focus,review,misses,level=1){
    const byId=new Map([...focus,...review].map(e=>[e.id,e]));
    const wrong=shuffled([...new Set(misses.filter(id=>byId.has(id)))].map(id=>byId.get(id))).sort(sortWeak);
    const strong=shuffled(review.filter(e=>(e.review?.correct||0)>=2&&(e.review?.streak||0)>0));
    const weak=shuffled(review.filter(e=>(e.review?.wrong||0)>0)).sort(sortWeak);
    const mixed=selectReviews(review,10);
    const choices=[];
    const add=e=>{if(e&&choices.length<5&&!choices.some(x=>x?.id===e.id))choices.push(e);};
    wrong.slice(0,2).forEach(add);add(weak.find(x=>!choices.includes(x)));add(strong.find(x=>!choices.includes(x)));add(mixed.find(x=>!choices.includes(x)));add(shuffled(focus)[0]);
    for(const e of [...mixed,...focus,...review])add(e);
    const result=choices.slice(0,5).map((e,i)=>translation(e,i%2===0,'type'));
    const grammar=grammarTasks(review,1,level);
    if(grammar.length&&result.length>=5&&!wrong.length)result[4]=grammar[0];
    while(result.length<5&&focus.length){const e=focus[result.length%focus.length];result.push(translation(e,result.length%2===0,'type'));}
    return result.map((t,i)=>({...t,stage:'recap',step:OPENING+i+1}));
  }
  function buildExam(core,source=core){
    const pool=shuffled([...new Map(core.map(e=>[e.id,e])).values()]);
    const nouns=shuffled(pool.filter(e=>e.type==='noun'&&e.article)),verbs=shuffled(pool.filter(e=>e.type==='verb'));
    const phrases=shuffled(pool.filter(e=>e.type==='phrase'));
    const chosen=[],usage=new Map();
    const add=t=>{if(!t)return;chosen.push(t);usage.set(t.entryId,(usage.get(t.entryId)||0)+1);};
    // Grammar is always included; the test does not depend on previous spacing dates.
    for(const [kind,count] of [['perfect',4],['preterite',4],['case_article',2],['plural',2],['article',1]]){
      let candidates=kind==='perfect'||kind==='preterite'?verbs:nouns;
      candidates=candidates.filter(e=>kind==='perfect'?!!e.perfect:kind==='preterite'?!!e.preterite:kind==='plural'?!!e.plural:true);
      candidates.sort((a,b)=>(usage.get(a.id)||0)-(usage.get(b.id)||0));
      for(const e of candidates.slice(0,count))add(kind==='case_article'?caseArticle(e,chosen.length%2?'Dativ':'Akkusativ'):{kind,entryId:e.id,modeHint:'type'});
    }
    for(const e of phrases){if(chosen.filter(t=>t.kind==='clozeChoice').length>=3)break;add(clozeChoice(e,source));}
    for(const e of phrases){if(chosen.filter(t=>t.kind==='buildSentence').length>=3)break;add(buildSentence(e,source));}
    const pair=match5(pool);if(pair)add(pair);
    const transPool=shuffled(pool).sort((a,b)=>(usage.get(a.id)||0)-(usage.get(b.id)||0));
    let i=0;while(chosen.length<EXAM_STEPS){const e=transPool[i%transPool.length];add(translation(e,i%2===1,i%4===0?'choices':'type'));i++;}
    return shuffled(chosen.slice(0,EXAM_STEPS)).map((t,i)=>({...t,stage:'exam',step:i+1}));
  }
  return {SIZE,STEPS,OPENING,PASS,EXAM_STEPS,EXAM_PASS,match5,clozeChoice,buildSentence,caseArticle,grammarTasks,buildOpening,buildRecap,buildExam,sortWeak,selectReviews};
})();
