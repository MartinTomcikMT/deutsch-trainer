/* Deutsch Trainer 1.9.41 – vocabulary mastery milestones and lifelong achievements */
'use strict';
function updateGreeting(){
  const hour=new Date().getHours();
  const greet=hour>=5&&hour<11?'Guten Morgen':hour>=11&&hour<18?'Guten Tag':hour>=18&&hour<22?'Guten Abend':'Gute Nacht';
  const el=document.getElementById('dynamicGreeting');if(el)el.textContent=greet;
}
// All achievements are derived from existing IndexedDB records. No new store,
// migration or additional client tracking is needed: exported backups also
// preserve streaks, record dates and the completed daily missions.
function achievementDateKey(date){
  const d=date instanceof Date?date:new Date(date);
  if(!Number.isFinite(d.getTime()))return '';
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
function achievementDayIndex(key){
  const a=String(key).split('-').map(Number);
  return Math.floor(Date.UTC(a[0],a[1]-1,a[2])/86400000);
}
function achievementData(){
  const records=(typeof attempts!=='undefined'&&Array.isArray(attempts)?attempts:[])
    .filter(a=>a&&a.entryId&&achievementDateKey(a.createdAt));
  const buckets=new Map(),byEntry=new Map();
  for(const a of records){
    const day=achievementDateKey(a.createdAt);
    if(!buckets.has(day))buckets.set(day,{count:0,correct:0,unique:new Set(),grammar:0,verbs:0});
    const b=buckets.get(day);b.count++;if(a.correct)b.correct++;
    b.unique.add(a.entryId);
    if(a.correct&&['perfect','preterite','case_article','article','plural'].includes(a.kind))b.grammar++;
    if(!byEntry.has(a.entryId))byEntry.set(a.entryId,[]);
    byEntry.get(a.entryId).push(a);
  }
  const days=[...buckets.keys()].sort();
  const sequences=[];
  for(const key of days){
    const prev=sequences[sequences.length-1];
    if(prev&&achievementDayIndex(key)-achievementDayIndex(prev.end)===1){prev.end=key;prev.days++;}
    else sequences.push({start:key,end:key,days:1});
  }
  const today=achievementDateKey(new Date());
  const y=new Date();y.setDate(y.getDate()-1);
  const yesterday=achievementDateKey(y);
  const latest=sequences[sequences.length-1];
  const current=latest&&(latest.end===today||latest.end===yesterday)?latest.days:0;
  const record=Math.max(0,...sequences.map(x=>x.days));
  const todayData=buckets.get(today)||{count:0,correct:0,unique:new Set(),grammar:0,verbs:0};
  const questDays=[...buckets.values()].filter(b=>b.count>=15&&b.correct>=10&&b.unique.size>=5).length;
  const completedToday=Number(todayData.count>=15)+Number(todayData.correct>=10)+Number(todayData.unique.size>=5);
  return {records,buckets,byEntry,days,sequences,current,record,today,todayData,questDays,completedToday};
}
function renderDailyMissions(data=achievementData()){
  const plans=[
    {icon:'🎯',title:'Denný tréning',value:data.todayData.count,target:15,unit:'odpovedí'},
    {icon:'✅',title:'Presnosť',value:data.todayData.correct,target:10,unit:'správnych odpovedí'},
    {icon:'🧠',title:'Pestré učenie',value:data.todayData.unique.size,target:5,unit:'rôznych výrazov'}
  ];
  // Grammar bonus is not required for completing the three daily missions.
  const lessonUnlocked=typeof duoLessonProgress==='function'&&typeof duoLessonUnlocked==='function'&&
    Array.from({length:8},(_,i)=>'lesson-'+(i+1)).some(k=>duoLessonUnlocked(k)&&duoLessonProgress(k).current>=3);
  if(lessonUnlocked)plans.push({icon:'🧩',title:'Gramatický bonus',value:data.todayData.grammar,target:3,unit:'správnych tvarov',bonus:true});
  const body=`<div class="daily-mission-summary"><strong>${data.completedToday}/3 splnených denných úloh</strong><small>Nové úlohy každý deň o polnoci podľa miestneho času. Pokrok sa ukladá z odpovedí.</small></div><div class="daily-mission-list">`+
    plans.map(t=>`<div class="daily-mission${t.value>=t.target?' completed':''}"><span class="mission-icon">${t.icon}</span><div class="mission-main"><strong>${escapeHtml(t.title)}${t.bonus?' · bonus':''}</strong><small>${Math.min(t.value,t.target)} / ${t.target} ${escapeHtml(t.unit)}</small><div class="achievement-track"><span style="width:${Math.min(100,t.value/t.target*100)}%"></span></div></div><span class="mission-state">${t.value>=t.target?'✓':'○'}</span></div>`).join('')+'</div>';
  for(const id of ['dailyMissions','dailyMissionsHome']){
    const el=document.getElementById(id);if(el)el.innerHTML=body;
  }
  const streakText=`${data.current} dní`;const recordText=`${data.record} dní`;
  const cur=document.getElementById('achievementCurrentStreak'),best=document.getElementById('achievementBestStreak');
  if(cur)cur.textContent=streakText;
  if(best)best.textContent=recordText;
  const history=document.getElementById('achievementStreakHistory');
  if(history){
    const pretty=key=>new Date(key+'T12:00:00').toLocaleDateString('sk-SK',{day:'numeric',month:'short',year:'numeric'});
    const finished=data.sequences.filter(s=>s.end!==data.today&&s!==data.sequences[data.sequences.length-1] || s.end!==data.today&&data.current===0).slice(-5).reverse();
    history.innerHTML=finished.length?`Predchádzajúce série: ${finished.map(s=>`<b>${s.days} dní</b> (${pretty(s.start)} – ${pretty(s.end)})`).join(' · ')}`:
      'Zatiaľ nemáš uzavretú sériu. Tvoj rekord zostane zachovaný aj po prestávke.';
  }
}
function renderAchievements(){
  const grid=document.getElementById('achievementsGrid');if(!grid)return;
  const data=achievementData();renderDailyMissions(data);
  const records=data.records,correct=records.filter(a=>a.correct).length;
  const unique=new Set(records.map(a=>a.entryId)).size;
  // Counting a distinct answer is NOT the same as truly mastering a word.
  // This is the same strict, cross-day, two-way recall standard as the
  // category mastery badges; all entries in the dictionary can contribute.
  const masteredVocabulary=(typeof entries!=='undefined'&&Array.isArray(entries)?entries:[])
    .filter(e=>DeutschSRS.duoMastered(e)).length;
  const dictionaryCount=(typeof entries!=='undefined'&&Array.isArray(entries)?entries:[]).length;
  const grammar=records.filter(a=>['perfect','preterite','case_article','article','plural'].includes(a.kind)&&a.correct).length;
  const perfekt=records.filter(a=>a.kind==='perfect'&&a.correct).length;
  const praeteritum=records.filter(a=>a.kind==='preterite'&&a.correct).length;
  const lessons=Object.values(duoState?.lessons||{}),levels=lessons.reduce((n,s)=>n+new Set(s.completed||[]).size,0);
  const exams=lessons.filter(s=>s.finalExam?.passed).length;
  const rounds=lessons.flatMap(s=>s.history||[]);
  const flawless=rounds.filter(r=>r.score===15&&r.total===15).length;
  const misses=new Set(records.filter(a=>!a.correct).map(a=>a.entryId));
  const recovered=[...misses].filter(id=>{const rs=data.byEntry.get(id)||[];return rs.some((a,i)=>a.correct&&rs.slice(0,i).some(b=>!b.correct));}).length;
  const dayComebacks=data.sequences.filter((s,i)=>i>0&&achievementDayIndex(s.start)-achievementDayIndex(data.sequences[i-1].end)>=3).length;
  const badges=[],titles=['Bronz','Striebro','Zlato','Platina','Diamant','Legenda','Mýtus','Nesmrteľný'];
  const add=(name,emoji,value,threshold,description,group='Dlhodobé ciele')=>badges.push({name,emoji,value,threshold,description,group,done:value>=threshold});
  const tier=(name,emoji,value,thresholds,suffix,group)=>thresholds.forEach((threshold,i)=>add(`${name} · ${titles[Math.min(i,titles.length-1)]}`,emoji,value,threshold,`${threshold.toLocaleString('sk-SK')} ${suffix}`,group));
  tier('Odpovede','⚡',records.length,[100,250,500,1000,2500,5000,10000,25000],'zodpovedaných otázok','Míľniky');
  tier('Správne odpovede','🎯',correct,[100,250,500,1000,2500,5000,10000],'správnych odpovedí','Míľniky');
  // Dedicated VOCABULARY milestone track; Gold and Diamond reflect the full
  // 2500-entry dictionary, not an arbitrary number of quiz answers.
  const vocabularyLevels=[
    [100,'Prvý míľnik','🌱'],
    [250,'Bronz','🥉'],
    [500,'Bronz+','🥉'],
    [1000,'Striebro','🥈'],
    [1500,'Striebro+','🥈'],
    [2000,'Zlato','🥇'],
    [2500,'Diamant','💎']
  ];
  for(const [count,name,emoji] of vocabularyLevels){
    add(`Slovník · ${name}`,emoji,masteredVocabulary,count,
      `${count.toLocaleString('sk-SK')} skutočne osvojených výrazov · písanie z nemčiny aj do nemčiny vo viacerých dňoch`,
      'Osvojená slovná zásoba');
  }
  // A separate introductory milestone only counts encountered expressions,
  // so it cannot be confused with actual learning or the Diamond award.
  add('Spoznal som 500 výrazov','👀',unique,500,
    '500 rozličných precvičených výrazov (nie nevyhnutne osvojených)','Míľniky');
  tier('Úrovne','📚',levels,[10,30,60,120,180,240],'dokončených levelov','Míľniky');
  tier('Záverečné skúšky','🏁',exams,[1,2,4,8],'úspešných testov lekcií','Míľniky');
  tier('Bezchybné kolá','💯',flawless,[1,5,15,30,75,150],'kôl 15/15','Špeciálne úspechy');
  tier('Nepretržité učenie','🔥',data.record,[3,7,14,30,60,100,180,365],'dní za sebou (osobný rekord)','Vytrvalosť');
  tier('Splnené denné výzvy','📅',data.questDays,[7,30,90,180,365],'dní so všetkými tromi úlohami','Vytrvalosť');
  tier('Gramatika','🧩',grammar,[50,150,500,1000],'správnych gramatických odpovedí','Gramatika');
  tier('Perfekt','⏳',perfekt,[25,100,300,700],'správnych tvarov','Gramatika');
  tier('Präteritum','📖',praeteritum,[25,100,300,700],'správnych tvarov','Gramatika');
  tier('Opravil som chybu','🔧',recovered,[10,50,150,300],'výrazov opravených po chybe','Špeciálne úspechy');
  tier('Vrátil som sa','🌤️',dayComebacks,[1,3,8,20],'návratov po aspoň dvojdňovej pauze','Špeciálne úspechy');
  // Only PRIORITIZED items count. One known word in several lessons may count
  // as mastered in each, while unprioritized 2500-word extras remain optional.
  const types=[['verb','Slovesá','🔤'],['phrase','Frázy a vety','💬'],['noun','Podstatné mená','📘'],['other','Ostatné výrazy','✨']];
  const allByType={verb:new Map(),phrase:new Map(),noun:new Map(),other:new Map()};
  let completedTypes=0;
  for(let n=1;n<=8;n++){
    const lesson=duoCoreForLesson('lesson-'+n);if(!lesson.length)continue;
    for(const [type,name,emoji] of types){
      const pool=lesson.filter(e=>e.type===type);if(!pool.length)continue;
      const learned=pool.filter(e=>DeutschSRS.duoMastered(e)).length;
      add(`Lekcia ${n}: všetky ${name.toLowerCase()}`,emoji,learned,pool.length,
        `${learned} / ${pool.length} skutočne osvojených · opakované písanie oboma smermi počas viacerých dní`,'Majster kategórie');
      if(learned===pool.length)completedTypes++;
      for(const e of pool)allByType[type].set(e.id,e);
    }
  }
  for(const [type,name,emoji] of types){
    const pool=[...allByType[type].values()];if(!pool.length)continue;
    const learned=pool.filter(e=>DeutschSRS.duoMastered(e)).length;
    add(`Celý kurz: všetky ${name.toLowerCase()}`,emoji,learned,pool.length,
      `${learned} / ${pool.length} zvládnutých prioritných výrazov`,'Majster kategórie');
  }
  tier('Kompletné kategórie','🏆',completedTypes,[1,4,12,24,32],'zvládnutých kategórií lekcií','Špeciálne úspechy');
  const card=b=>`<div class="achievement${b.done?'':' locked'}" data-badge-group="${escapeHtml(b.group)}"><div class="emoji">${b.emoji}</div><strong>${escapeHtml(b.name)}</strong><small>${escapeHtml(b.description)}</small><div class="achievement-track"><span style="width:${Math.min(100,b.value/b.threshold*100).toFixed(1)}%"></span></div><span class="done">${b.done?'✓ Odomknuté':`${Math.min(b.value,b.threshold).toLocaleString('sk-SK')} / ${b.threshold.toLocaleString('sk-SK')}`}</span></div>`;
  const unlocked=badges.filter(b=>b.done);
  const pending=badges.filter(b=>!b.done).sort((a,b)=>b.value/b.threshold-a.value/a.threshold);
  const featured=[...unlocked.slice(-5).reverse(),...pending.slice(0,7)];
  const selected=new Set(featured);
  const other=badges.filter(b=>!selected.has(b));
  const groups=[...new Set(other.map(b=>b.group))];
  const nextVocabulary=vocabularyLevels.find(level=>masteredVocabulary<level[0]);
  const vocabProgress=Math.min(100,masteredVocabulary/2500*100);
  const vocabularyInfo=dictionaryCount<2500
    ?`Aktuálny slovník má ${dictionaryCount.toLocaleString('sk-SK')} záznamov. Na diamant potrebuješ importovať aspoň 2 500 a skutočne si ich osvojiť.`
    :'Do úspechu sa rátajú všetky osvojené výrazy vrátane rozširujúcej slovnej zásoby, nielen 150 prioritných na lekciu.';
  const vocabOverview=`<div class="vocab-achievement-summary"><div class="vocab-achievement-head"><span><strong>📚 Osvojená slovná zásoba</strong><small>${masteredVocabulary.toLocaleString('sk-SK')} / 2 500 výrazov · ${dictionaryCount.toLocaleString('sk-SK')} v slovníku</small></span><span class="vocab-achievement-next">${nextVocabulary?`Ďalší: ${escapeHtml(nextVocabulary[1])} (${nextVocabulary[0].toLocaleString('sk-SK')})`:'💎 Diamant získaný!'}</span></div><div class="achievement-track"><span style="width:${vocabProgress.toFixed(1)}%"></span></div><p>${escapeHtml(vocabularyInfo)}</p><p>Výraz sa započíta až po opakovanom samostatnom správnom preklade oboma smermi aspoň v dvoch rôznych dňoch; výber z možností nestačí.</p></div>`;
  grid.innerHTML=`${vocabOverview}<div class="achievement-overview"><strong>${unlocked.length} / ${badges.length} úspechov</strong><small>Míľniky, rekordy, skutočne osvojené kategórie a špeciálne výzvy.</small></div>
    <div class="achievement-cards">${featured.map(card).join('')}</div>
    <details class="achievement-expanded"><summary>Všetky úspechy (${badges.length})</summary>${groups.map(g=>`<h3 class="badge-group-title">${escapeHtml(g)}</h3><div class="achievement-cards">${other.filter(b=>b.group===g).map(card).join('')}</div>`).join('')}</details>`;
}
