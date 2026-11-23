/* Deutsch Trainer 1.3: spaced repetition logic, reusable and dependency-free. */
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
  function apply(entry,kind,correct,now=new Date()) {
    if(!entry.reviewModes||typeof entry.reviewModes!=='object')entry.reviewModes={};
    const prev=state(entry,kind)||{};
    const streak=correct?(prev.streak||0)+1:0;
    const intervalDays=correct?stages[Math.min(streak-1,stages.length-1)]:0;
    const days=[...(Array.isArray(prev.successDays)?prev.successDays:[])];
    const k=todayKey(now);
    if(correct&&!days.includes(k))days.push(k);
    entry.reviewModes[kind]={
      attempts:(prev.attempts||0)+1,
      correct:(prev.correct||0)+(correct?1:0),
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
    const str=entry.type==='phrase'?entry.de:(entry.exampleDe||'');
    if(!str || str.length>220)return null;
    const matches=[...str.matchAll(/\b[A-Za-zÄÖÜäöüß]{4,}\b/g)].filter(m=>!['diese','dieser','dieses','einen','einem','einer','eines','seine','seinen','meine','meinen','meinem','deine','deinen','nicht','haben','wurde','werden','sowie','jedem','allem'].includes(m[0].toLowerCase()));
    if(!matches.length)return null;
    const token=matches[Math.floor(Math.random()*matches.length)];
    return {kind:'cloze',entryId:entry.id,question:str.slice(0,token.index)+'_____'+str.slice(token.index+token[0].length),answer:token[0],hint:entry.sk};
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
  return {todayKey,state,isNew,isDue,dueAt,apply,mastered,summarize,selectTasks,cloze,makeCandidates};
})();
