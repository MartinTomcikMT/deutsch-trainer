/* Deutsch Trainer 1.9.2 – local time greeting and learning achievements */
'use strict';
const CLOUD_TABLES={entries:'dt_entries',attempts:'dt_attempts',meta:'dt_meta'};
function updateGreeting(){
  const hour=new Date().getHours();
  const greet=hour>=5&&hour<11?'Guten Morgen':hour>=11&&hour<18?'Guten Tag':hour>=18&&hour<22?'Guten Abend':'Gute Nacht';
  const el=$('dynamicGreeting');if(el)el.textContent=greet;
}
function renderAchievements(){
  const grid=$('achievementsGrid');if(!grid)return;
  const today=new Date();
  const byDay=new Set(attempts.map(x=>new Date(x.createdAt).toLocaleDateString('sv-SE')).filter(Boolean));
  const dayKey=d=>d.toLocaleDateString('sv-SE');
  let streak=0,cur=new Date(today.getFullYear(),today.getMonth(),today.getDate());
  if(!byDay.has(dayKey(cur)))cur.setDate(cur.getDate()-1);
  for(let i=0;i<366&&byDay.has(dayKey(cur));i++){streak++;cur.setDate(cur.getDate()-1);}
  const total=attempts.length,correct=attempts.filter(x=>x.correct).length;
  const unique=new Set(attempts.map(x=>x.entryId)).size;
  const completed=Object.values(duoState.lessons||{}).reduce((n,x)=>n+(x.completed?.length||0),0);
  const fullLessons=Object.keys(duoState.lessons||{}).filter(k=>duoLessonProgress(k).done).length;
  const rounds=Object.values(duoState.lessons||{}).flatMap(x=>x.history||[]);
  const badges=[
    ['🌱','Prvý krok','Prvá zodpovedaná otázka',total>=1],
    ['⚡','Rozbeh','50 zodpovedaných otázok',total>=50],
    ['🏅','Vytrvalec','250 zodpovedaných otázok',total>=250],
    ['🧠','Znalec','100 rôznych preberaných výrazov',unique>=100],
    ['🎯','Presný zásah','100 správnych odpovedí',correct>=100],
    ['📚','Postupujem','Prvý dokončený level',completed>=1],
    ['🎓','Majster lekcie','Všetky dokončené levely jednej lekcie',fullLessons>=1],
    ['💯','Bez chyby','Jedno kolo Duolinga s výsledkom 15/15',rounds.some(r=>r.score===15&&r.total===15)],
    ['🔥','3 dni za sebou','Tri po sebe idúce dni s otázkami',streak>=3],
    ['🌟','7 dní za sebou','Sedem po sebe idúcich dní s otázkami',streak>=7]
  ];
  grid.innerHTML=badges.map(([emoji,name,goal,done])=>`<div class="achievement${done?'':' locked'}"><div class="emoji">${emoji}</div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(goal)}</small><span class="done">${done?'✓ Odomknuté':'🔒 Zatiaľ zamknuté'}</span></div>`).join('');
}
