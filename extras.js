/* Deutsch Trainer 1.9.3 – greeting and tiered, lifelong achievements */
'use strict';
function updateGreeting(){
  const hour=new Date().getHours();
  const greet=hour>=5&&hour<11?'Guten Morgen':hour>=11&&hour<18?'Guten Tag':hour>=18&&hour<22?'Guten Abend':'Gute Nacht';
  const el=document.getElementById('dynamicGreeting');if(el)el.textContent=greet;
}
function renderAchievements(){
  const grid=document.getElementById('achievementsGrid');if(!grid)return;
  const valid=attempts.filter(a=>a&&a.entryId&&a.createdAt),total=valid.length;
  const correct=valid.filter(a=>a.correct).length;
  const unique=new Set(valid.map(a=>a.entryId)).size;
  const grammar=valid.filter(a=>['perfect','preterite','case_article','article','plural'].includes(a.kind)&&a.correct).length;
  const perfekt=valid.filter(a=>a.kind==='perfect'&&a.correct).length;
  const praeteritum=valid.filter(a=>a.kind==='preterite'&&a.correct).length;
  const caseForms=valid.filter(a=>['case_article','article','plural'].includes(a.kind)&&a.correct).length;
  const lessons=Object.values(duoState?.lessons||{}),levels=lessons.reduce((n,s)=>n+(s.completed?.length||0),0);
  const exams=lessons.filter(s=>s.finalExam?.passed).length;
  const rounds=lessons.flatMap(s=>s.history||[]);
  const flawless=rounds.filter(r=>r.score===15&&r.total===15).length;
  const toDay=stamp=>{const d=new Date(stamp);if(!Number.isFinite(d.getTime()))return '';return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
  const days=[...new Set(valid.map(a=>toDay(a.createdAt)).filter(Boolean))].sort();
  let maxStreak=0,run=0,last='';
  for(const day of days){
    const date=new Date(day+'T12:00:00'),prev=last?new Date(last+'T12:00:00'):null;
    run=prev&&Math.round((date-prev)/86400000)===1?run+1:1;
    maxStreak=Math.max(maxStreak,run);last=day;
  }
  const badges=[];
  const tier=(name,emoji,metric,thresholds,suffix='')=>{
    for(const [i,threshold] of thresholds.entries()){
      const titles=['Bronz','Striebro','Zlato','Platina','Diamant','Legenda'];
      badges.push({name:`${name} · ${titles[Math.min(i,titles.length-1)]}`,emoji,threshold,value:metric,
        description:`${threshold.toLocaleString('sk-SK')} ${suffix}`,done:metric>=threshold});
    }
  };
  tier('Cvičenia','⚡',total,[50,250,1000,3000,10000],'zodpovedaných otázok');
  tier('Správne odpovede','🎯',correct,[100,500,2000,7000],'správnych odpovedí');
  tier('Rôzne výrazy','🧠',unique,[50,150,500,1000],'precvičených výrazov');
  tier('Pokrok','📚',levels,[5,30,90,180,240],'dokončených levelov');
  tier('Záverečné testy','🏁',exams,[1,4,8],'zvládnutých testov lekcií');
  tier('Bezchybné kolá','💯',flawless,[1,5,20,50],'kôl 15/15');
  tier('Denné série','🔥',maxStreak,[3,7,30,100],'dní učenia za sebou');
  tier('Gramatika','🧩',grammar,[25,100,500,1500],'správnych gramatických odpovedí');
  tier('Perfekt','⏳',perfekt,[10,50,200],'správnych minulých tvarov');
  tier('Präteritum','📖',praeteritum,[10,50,200],'správnych minulých tvarov');
  tier('Členy a pády','📝',caseForms,[20,100,300],'správnych odpovedí');
  const unlocked=badges.filter(b=>b.done),pending=badges.filter(b=>!b.done).sort((a,b)=>b.value/b.threshold-a.value/a.threshold);
  const card=b=>`<div class="achievement${b.done?'':' locked'}"><div class="emoji">${b.emoji}</div><strong>${escapeHtml(b.name)}</strong>
    <small>${escapeHtml(b.description)}</small><div class="achievement-track"><span style="width:${Math.min(100,b.value/b.threshold*100).toFixed(1)}%"></span></div>
    <span class="done">${b.done?'✓ Odomknuté':`${Math.min(b.value,b.threshold).toLocaleString('sk-SK')} / ${b.threshold.toLocaleString('sk-SK')}`}</span></div>`;
  const featured=[...unlocked.slice(-6).reverse(),...pending.slice(0,6)];
  const visible=new Set(featured);
  const remaining=badges.filter(b=>!visible.has(b));
  grid.innerHTML=`<div class="achievement-overview"><strong>${unlocked.length} / ${badges.length} odznakov</strong><small>Ukazujeme posledné získané a najbližšie ciele. Nižšie nájdeš všetky.</small></div>
    <div class="achievement-cards">${featured.map(card).join('')}</div>
    <details class="achievement-expanded"><summary>Všetky úspechy (${badges.length})</summary><div class="achievement-cards">${remaining.map(card).join('')}</div></details>`;
}
