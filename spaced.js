/* Deutsch Trainer 1.7: guided introduction plus spaced repetition. */
'use strict';
const DeutschSRS = (() => {
  const DAY=86400000;
  const stages=[1,3,7,14,30,60];
  function todayKey(date=new Date()) {
    const d=date instanceof Date?date:new Date(date);
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  }
  function state(entry,kind){return entry.reviewModes&&entry.reviewModes[kind]||null;}
  function dueAt(entry,kind){return state(entry,kind)?.dueAt||null;}
  function isDue(entry,kind,now=new Date()) {
    const s=state(entry,kind);
    return !!s?.dueAt && new Date(s.dueAt).getTime()<=now.getTime();
  }
  function isNew(entry,kind){return !state(entry,kind)?.attempts;}
  function apply(entry,kind,correct,now=new Date(),method='recall') {
    if(!entry.reviewModes||typeof entry.reviewModes!=='object')entry.reviewModes={};
    const prev=state(entry,kind)||{};
    const streak=correct?(prev.streak||0)+1:0;
    const intervalDays=correct?stages[Math.min(streak-1,stages.length-1)]:0;
    const days=[...(Array.isArray(prev.successDays)?prev.successDays:[])];
    const k=todayKey(now);
    if(correct&&!days.includes(k))days.push(k);
    // Legacy responses were typed; retain them as valid recall history.
    const recallDays=[...(Array.isArray(prev.recallSuccessDays)?prev.recallSuccessDays:(prev.successDays||[]))];
    if(correct&&method!=='choices'&&!recallDays.includes(k))recallDays.push(k);
    entry.reviewModes[kind]={
      attempts:(prev.attempts||0)+1,
      correct:(prev.correct||0)+(correct?1:0),
      choiceCorrect:(prev.choiceCorrect||0)+(correct&&method==='choices'?1:0),
      recallSuccessDays:recallDays.slice(-20),
      wrong:(prev.wrong||0)+(correct?0:1),
      streak,
      intervalDays,
      successDays:days.slice(-20),
      lastReviewed:now.toISOString(),
      dueAt:new Date(now.getTime()+(correct?intervalDays*DAY:10*60000)).toISOString()
    };
    return entry.reviewModes[kind];
  }
  function mastered(entry){return Object.values(entry.reviewModes||{}).some(s=>s && s.streak>=3 && s.intervalDays>=7 && (s.successDays||[]).length>=2);}
  function duoMastered(entry){
    const a=state(entry,'de_to_sk')||{}, b=state(entry,'sk_to_de')||{};
    const recalled=s=>Math.max(0,Number(s.correct||0)-Number(s.choiceCorrect||0));
    const recallDays=s=>Array.isArray(s.recallSuccessDays)?s.recallSuccessDays:(s.successDays||[]);
    const days=new Set([...recallDays(a),...recallDays(b)]);
    return recalled(a)>=2 && recalled(b)>=1 && days.size>=2;
  }
  function summarize(attempts,entries,now=new Date()){
    const today=todayKey(now);
    const todayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
    const thisWeekStart=todayStart-6*DAY;
    const sorted=[...(attempts||[])].filter(a=>a?.createdAt&&a?.entryId).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
    const firstSeen=new Map();for(const a of sorted){if(!firstSeen.has(a.entryId))firstSeen.set(a.entryId,todayKey(a.createdAt));}
    const todayAttempts=sorted.filter(a=>todayKey(a.createdAt)===today);
    const weekAttempts=sorted.filter(a=>new Date(a.createdAt).getTime()>=thisWeekStart);
    const days=[];
    const active=new Set(sorted.map(a=>todayKey(a.createdAt)));
    let streak=0;let date=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    if(!active.has(today)){date.setDate(date.getDate()-1);}
    while(active.has(todayKey(date))){streak++;date.setDate(date.getDate()-1);}
    for(let i=6;i>=0;i--){const date=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i);const k=todayKey(date);const current=sorted.filter(a=>todayKey(a.createdAt)===k);days.push({date:k,day:date.toLocaleDateString('sk-SK',{weekday:'short'}).replace('.',''),count:current.length,correct:current.filter(a=>a.correct).length});}
    return {today:todayAttempts.length,week:weekAttempts.length,
      todayCorrect:todayAttempts.filter(a=>a.correct).length,weekCorrect:weekAttempts.filter(a=>a.correct).length,
      newToday:[...firstSeen.values()].filter(d=>d===today).length,
      newWeek:[...firstSeen.values()].filter(d=>d>=todayKey(new Date(thisWeekStart))).length,
      accuracyToday:todayAttempts.length?Math.round(100*todayAttempts.filter(a=>a.correct).length/todayAttempts.length):null,
      accuracyWeek:weekAttempts.length?Math.round(100*weekAttempts.filter(a=>a.correct).length/weekAttempts.length):null,
      mastered:(entries||[]).filter(mastered).length,
      due:(entries||[]).filter(e=>Object.keys(e.reviewModes||{}).some(k=>isDue(e,k,now)) || (!Object.keys(e.reviewModes||{}).length && e.review?.attempts>0 && e.review?.dueAt && new Date(e.review.dueAt)<=now)).length,
      streak,days};
  }
  function shuffle(array){const a=[...array];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function cloze(entry){
    // Cloze requires a complete sentence AND its complete translation.
    if(entry.type!=='phrase')return null;
    const str=entry.de,translation=entry.sk;
    if(!str||!translation || str.length>220 || !/[.!?]$/.test(str.trim()) || !/[.!?]$/.test(translation.trim()))return null;
    const matches=[...str.matchAll(/\b[A-Za-zÄÖÜäöüß]{4,}\b/g)].filter(m=>!['diese','dieser','dieses','einen','einem','einer','eines','seine','seinen','meine','meinen','meinem','deine','deinen','nicht','haben','wurde','werden','sowie','jedem','allem'].includes(m[0].toLowerCase()));
    if(!matches.length)return null;
    const token=matches[Math.floor(Math.random()*matches.length)];
    return {kind:'cloze',entryId:entry.id,question:str.slice(0,token.index)+'_____'+str.slice(token.index+token[0].length),answer:token[0],fullDe:str,fullSk:translation};
  }
  function clozeSk(entry){
    if(entry.type!=='phrase')return null;
    const original=entry.sk,fullDe=entry.de;
    if(!original||!fullDe || original.length>220 || !/[.!?]$/.test(original.trim()) || !/[.!?]$/.test(fullDe.trim()))return null;
    const matches=[...original.matchAll(/[\p{L}]{4,}/gu)];
    if(!matches.length)return null;
    const word=matches[Math.floor(Math.random()*matches.length)];
    return {kind:'cloze_sk',entryId:entry.id,question:original.slice(0,word.index)+'_____'+original.slice(word.index+word[0].length),answer:word[0],fullDe,fullSk:original};
  }
  function makeCandidates(entry){
    const a=[{entryId:entry.id,kind:'de_to_sk'},{entryId:entry.id,kind:'sk_to_de'}];
    if(entry.type==='phrase'||entry.exampleDe){const t=cloze(entry);if(t)a.push(t);}
    if(entry.type==='verb'&&entry.perfect)a.push({entryId:entry.id,kind:'perfect'});
    if(entry.type==='verb'&&entry.preterite)a.push({entryId:entry.id,kind:'preterite'});
    return a;
  }
  function selectTasks(list,count=12){
    if(!list.length||!count)return [];
    const max=Math.min(Math.max(1,Math.round(count)),50);
    const byId=new Map(list.map(e=>[e.id,e]));
    const candidates=list.flatMap(makeCandidates);
    const due=shuffle(candidates.filter(t=>isDue(byId.get(t.entryId),t.kind)));
    const seen=shuffle(candidates.filter(t=>!isNew(byId.get(t.entryId),t.kind)&&!isDue(byId.get(t.entryId),t.kind)));
    const fresh=shuffle(candidates.filter(t=>isNew(byId.get(t.entryId),t.kind)));
    // Prioritize overdue reviews, then reinforce a small active learning pool.
    const chosen=[];const used=new Set();const seenEntries=new Map();
    function take(from,limit,opt={}){
      for(const t of from){
        if(chosen.length>=max||limit<=0)break;
        const key=t.entryId+'::'+t.kind;
        if(used.has(key))continue;
        const count=seenEntries.get(t.entryId)||0;
        if(count>=(opt.maxPerEntry||3))continue;
        if(opt.onlyActive && !seenEntries.has(t.entryId))continue;
        chosen.push(t);used.add(key);seenEntries.set(t.entryId,count+1);limit--;
      }
    }
    take(due,max);
    const newEntriesLimit=Math.min(5,Math.max(2,Math.ceil(max/3)));
    take(seen,Math.ceil(max/4));
    // Limit number of *different* new entries; repeat them in both translation directions.
    const freshPool=[];const ids=new Set();
    for(const t of fresh){if(!ids.has(t.entryId)&&ids.size>=newEntriesLimit)continue;ids.add(t.entryId);freshPool.push(t);}
    take(freshPool,max-chosen.length,{maxPerEntry:2});
    take(seen,max-chosen.length);
    take(due,max-chosen.length);
    take(fresh,max-chosen.length,{maxPerEntry:6});
    take(seen,max-chosen.length,{maxPerEntry:6});
    take(due,max-chosen.length,{maxPerEntry:6});
    // Avoid an immediate repetition of the same entry where possible.
    const ordered=[];const pending=[...chosen];let last='';
    while(pending.length){let idx=pending.findIndex(t=>t.entryId!==last);if(idx<0)idx=0;const [t]=pending.splice(idx,1);ordered.push(t);last=t.entryId;}
    return ordered;
  }
  // A vocabulary item is *introduced* only after it was answered in a quiz.
  // Viewing the introductory card does not create a success or an attempt.
  function hasStudied(entry){
    return Number(entry?.review?.attempts||0)>0 || Object.values(entry?.reviewModes||{}).some(s=>Number(s?.attempts||0)>0);
  }
  function suitableCandidates(entry,opts={}){
    const base=[{entryId:entry.id,kind:'de_to_sk'}];
    if(opts.reverse)base.push({entryId:entry.id,kind:'sk_to_de'});
    const german=entry.reviewModes?.de_to_sk||{};
    const slovak=entry.reviewModes?.sk_to_de||{};
    // All advanced questions are delayed until the learner knows the meaning in BOTH directions,
    // and has recalled the expression correctly on more than one date.
    const confident=duoMastered(entry);
    if(opts.cloze && confident && entry.type==='phrase'){
      const gap=cloze(entry);if(gap && gap.fullSk)base.push(gap);
      const opposite=clozeSk(entry);if(opposite && opts.reverse)base.push(opposite);
    }
    if(opts.grammar && confident){
      if(entry.type==='verb'){
        if(entry.perfect)base.push({entryId:entry.id,kind:'perfect'});
        if(entry.preterite)base.push({entryId:entry.id,kind:'preterite'});
      }
      if(entry.type==='noun'){
        if(entry.article)base.push({entryId:entry.id,kind:'article'});
        if(entry.plural)base.push({entryId:entry.id,kind:'plural'});
      }
    }
    return base;
  }

  function interleaveTypes(items,getType){
    const groups=new Map();
    for(const item of items){const type=getType(item)||'other';if(!groups.has(type))groups.set(type,[]);groups.get(type).push(item);}
    const out=[];const preferred=['noun','verb','phrase','other'];
    const order=[...preferred,...[...groups.keys()].filter(t=>!preferred.includes(t))];
    while([...groups.values()].some(g=>g.length)){
      for(const type of order){const item=groups.get(type)?.shift();if(item)out.push(item);}
    }
    return out;
  }
  // Three plans: never-seen words, reviewed words, or a controlled mixture.
  // A word is introduced at most once in a guided round, then asked in both directions.
  function selectGuidedTasks(list,count=10,plan='new',newWords=5,opts={}){
    const max=Math.min(50,Math.max(0,Math.trunc(Number(count)||0)));
    if(!list?.length||!max)return [];
    const orderEasy=(a,b)=>{
      // Level A1 first, then shorter everyday expressions before long technical phrases.
      const lvl={A1:0,A2:1,B1:2,B2:3};
      return (lvl[a.level]??2)-(lvl[b.level]??2) ||
        a.de.length-b.de.length || String(a.de).localeCompare(String(b.de),'de');
    };
    const fresh=interleaveTypes(opts.easy?list.filter(e=>!hasStudied(e)).sort(orderEasy):shuffle(list.filter(e=>!hasStudied(e))),e=>e.type);
    const old=interleaveTypes(shuffle(list.filter(hasStudied)),e=>e.type);
    const selected=[];const used=new Set();
    const push=t=>{if(selected.length>=max)return false;const key=t.entryId+'::'+t.kind;
      if(used.has(key))return false;selected.push(t);used.add(key);return true;};
    function addOld(onlyDue,limit){
      const tasks=interleaveTypes(old.flatMap(e=>shuffle(suitableCandidates(e,opts))),t=>old.find(e=>e.id===t.entryId)?.type)
        .filter(t=>isDue(old.find(e=>e.id===t.entryId),t.kind)===onlyDue);
      // Distinct entries first, then additional directions.
      const firstPass=tasks.filter((t,i)=>tasks.findIndex(x=>x.entryId===t.entryId)===i);
      for(const t of [...firstPass,...tasks]){if(selected.length>=limit)break;push(t);}
    }
    if(plan!=='new')addOld(true,plan==='mixed'?Math.ceil(max/2):max);
    if(plan!=='review'){
      const cap=Math.max(1,Math.min(20,Math.trunc(Number(newWords)||5)));
      const quota=plan==='mixed'?Math.max(0,max-selected.length):max;
      const kindsPerWord=1;
      const num=Math.min(cap,fresh.length,Math.ceil(quota/kindsPerWord));
      const chosen=fresh.slice(0,num);
      for(const e of chosen)push({entryId:e.id,kind:'de_to_sk'});
      // Opposite direction is introduced on a later review, not before the first translation is learned.
    }
    if(plan!=='new'){addOld(false,max);addOld(true,max);}
    const byId=new Map(list.map(e=>[e.id,e]));
    return interleaveTypes(selected,t=>byId.get(t.entryId)?.type);
  }

  return {todayKey,state,isNew,isDue,dueAt,apply,mastered,duoMastered,summarize,selectTasks,selectGuidedTasks,hasStudied,cloze,clozeSk,makeCandidates};
})();
