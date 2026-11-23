/* Deutsch Trainer 1.9.2 – local edition, A2+ Duolingo, achievements, safe reset. */
'use strict';

const DB_NAME = 'deutsch-trainer-v1';
const DB_VERSION = 3;
const DATA_FORMAT = 'deutsch-trainer';
const APP_VERSION = '1.9.2';
const DATA_VERSION = 1;
const entryFields = ['type','de','sk','article','plural','preterite','perfect','auxiliary','exampleDe','exampleSk','level','lesson','notes'];
const typeLabels = {verb:'Sloveso',noun:'Podstatné meno',phrase:'Fráza / veta',other:'Slovíčko'};
const allEntryTypes = Object.keys(typeLabels);
const $ = id => document.getElementById(id);
let db;
let entries = [];
let attempts = [];
let importPending = null;
let quiz = null;
let noticeTimeout;
let studyLastPage='ucenie';
let duoState={id:'duo-progress-v2',lessons:{}};
const LIBRARY_PAGE_SIZE=45;
let libraryVisible=LIBRARY_PAGE_SIZE;


function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function uid() { return (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function notify(message, error = false) {
  const target = $('notice');
  target.textContent = message;
  target.className = `notice${error ? ' error' : ''}`;
  clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => target.classList.add('hidden'), 5400);
}
function idbOpen() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const handle = request.result;
      if (!handle.objectStoreNames.contains('entries')) handle.createObjectStore('entries',{keyPath:'id'});
      if (!handle.objectStoreNames.contains('attempts')) handle.createObjectStore('attempts',{keyPath:'id'});
      if (!handle.objectStoreNames.contains('meta')) handle.createObjectStore('meta',{keyPath:'id'});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Databáza je otvorená v inom okne.'));
  });
}
function dbGetAll(store) {
  return new Promise((resolve,reject) => {
    const request = db.transaction(store,'readonly').objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function dbPut(store,data) {
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(store,'readwrite');
    transaction.objectStore(store).put(data);
    transaction.oncomplete=()=>resolve();
    transaction.onerror=()=>reject(transaction.error);
    transaction.onabort=()=>reject(transaction.error);
  });
}
function dbDelete(store,id) {
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(store,'readwrite');
    transaction.objectStore(store).delete(id);
    transaction.oncomplete=()=>resolve();
    transaction.onerror=()=>reject(transaction.error);
    transaction.onabort=()=>reject(transaction.error);
  });
}
async function reloadData() {
  [entries,attempts] = await Promise.all([dbGetAll('entries'),dbGetAll('attempts')]);
  const metadata=await dbGetAll('meta');
  duoState=metadata.find(x=>x.id==='duo-progress-v2')||{id:'duo-progress-v2',lessons:{}};
  entries.sort((a,b) => String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  renderStats(); renderAchievements(); renderLessonOptions(); renderLibraryTopics(); renderLibrary(); renderCategories(); renderQuizAvailability(); updateDuolingoPreview();
}
function newReview() { return {attempts:0,correct:0,wrong:0,streak:0,lastReviewed:null,dueAt:null}; }
function val(v,max=350) {return typeof v === 'string' ? v.trim().slice(0,max) : '';}
function cleanTags(tags) {
  const list = Array.isArray(tags) ? tags : typeof tags==='string' ? tags.split(',') : [];
  return [...new Set(list.map(t=>val(t,55)).filter(Boolean))].slice(0,20);
}
function normalizeEntry(raw,keepProgress=false) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Neplatný záznam.');
  const type = val(raw.type,20) || 'other';
  if(!allEntryTypes.includes(type)) throw new Error('Neznámy typ záznamu: '+type);
  let de=val(raw.de,250),article=val(raw.article,10);
  if(type==='noun' && !article && /^(der|die|das)\s+/i.test(de)) {
    const match=de.match(/^(der|die|das)\s+(.*)$/i);
    article=match[1].toLowerCase(); de=match[2];
  }
  const sk=val(raw.sk,350);
  if(!de || !sk) throw new Error('Každý záznam musí obsahovať „de“ aj „sk“.');
  const now = new Date().toISOString();
  const item={id:keepProgress && typeof raw.id==='string' && raw.id ? raw.id : uid(),type,de,sk,
    article: ['der','die','das'].includes(article)?article:'', plural:val(raw.plural),
    preterite:val(raw.preterite), perfect:val(raw.perfect),auxiliary:val(raw.auxiliary,20),
    exampleDe:val(raw.exampleDe,750),exampleSk:val(raw.exampleSk,750),
    level:['A1','A2','B1','B2'].includes(raw.level)?raw.level:'A1',
    lesson:val(raw.lesson,100),
    lessons:[...new Set([val(raw.lesson,100),...(Array.isArray(raw.lessons)?raw.lessons.map(x=>val(x,100)):[])].filter(Boolean))].slice(0,30),
    notes:val(raw.notes,1500),tags:cleanTags(raw.tags),
    alternatives:Array.isArray(raw.alternatives)?raw.alternatives.map(t=>val(t,250)).filter(Boolean).slice(0,20):[],
    createdAt:keepProgress && typeof raw.createdAt==='string' ? raw.createdAt : now,
    updatedAt:now,review:newReview(),reviewModes:{}
  };
  if(keepProgress && raw.review && typeof raw.review==='object') {
    const r=raw.review;
    item.review={attempts:Math.max(0,Number(r.attempts)||0),correct:Math.max(0,Number(r.correct)||0),
      wrong:Math.max(0,Number(r.wrong)||0),streak:Math.max(0,Number(r.streak)||0),
      lastReviewed:typeof r.lastReviewed==='string'?r.lastReviewed:null,
      dueAt:typeof r.dueAt==='string'?r.dueAt:null};
  }
  if(keepProgress && raw.reviewModes && typeof raw.reviewModes==='object') {
    for(const [kind,state] of Object.entries(raw.reviewModes)){
      if(!['de_to_sk','sk_to_de','cloze','cloze_sk','perfect','preterite','article','plural'].includes(kind))continue;
      if(!state||typeof state!=='object')continue;
      item.reviewModes[kind]={attempts:Math.max(0,Number(state.attempts)||0),correct:Math.max(0,Number(state.correct)||0),
        wrong:Math.max(0,Number(state.wrong)||0),streak:Math.max(0,Number(state.streak)||0),
        intervalDays:Math.max(0,Number(state.intervalDays)||0),
        successDays:Array.isArray(state.successDays)?state.successDays.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).slice(-20):[],
        choiceCorrect:Math.max(0,Number(state.choiceCorrect)||0),
        recallSuccessDays:Array.isArray(state.recallSuccessDays)?state.recallSuccessDays.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).slice(-20):undefined,
        lastReviewed:typeof state.lastReviewed==='string'?state.lastReviewed:null,
        dueAt:typeof state.dueAt==='string'?state.dueAt:null};
    }
  }
  return item;
}
function entryKey(e){return `${e.type}::${String(e.de).trim().toLocaleLowerCase('de-DE').replace(/\s+/g,' ')}`;}
function mergeEntries(oldEntry,newEntry){
  const merged={...oldEntry}; let changed=false;
  for(const field of entryFields) {
    if(field==='type' || field==='de' || field==='level') continue;
    if(!merged[field] && newEntry[field]){merged[field]=newEntry[field];changed=true;}
  }
  if((!merged.level || merged.level==='A1') && newEntry.level && newEntry.level!=='A1') {merged.level=newEntry.level;changed=true;}
  const tags=[...new Set([...(oldEntry.tags||[]),...(newEntry.tags||[])])];
  if(tags.length!==(oldEntry.tags||[]).length){merged.tags=tags;changed=true;}
  const alts=[...new Set([...(oldEntry.alternatives||[]),...(newEntry.alternatives||[])])];
  if(alts.length!==(oldEntry.alternatives||[]).length){merged.alternatives=alts;changed=true;}
  // A familiar word can occur in several lessons. Link it to all of them without duplicating the record.
  const oldLessons=[oldEntry.lesson,...(oldEntry.lessons||[])].filter(Boolean);
  const newLessons=[newEntry.lesson,...(newEntry.lessons||[])].filter(Boolean);
  const lessons=[...new Set([...oldLessons,...newLessons])].slice(0,30);
  if(lessons.length!==(oldEntry.lessons||[]).length||lessons.some((t,i)=>t!==(oldEntry.lessons||[])[i])){
    merged.lessons=lessons;changed=true;
  }
  if(!merged.reviewModes)merged.reviewModes=oldEntry.reviewModes||{};
  if(changed)merged.updatedAt=new Date().toISOString();
  return {merged,changed};
}
function switchPage(page,updateHash=true){
  if(!['domov','slovnik','ucenie','trening','statistiky','import'].includes(page))page='domov';
  document.querySelectorAll('.page').forEach(e=>e.classList.toggle('active',e.id==='page-'+page));
  document.querySelectorAll('.nav-link').forEach(e=>e.classList.toggle('active',e.dataset.page===page));
  $('breadcrumb').innerHTML=`Osobná učebnica <span>/</span> ${escapeHtml({domov:'Prehľad',slovnik:'Môj slovník',ucenie:'Duolingo režim',trening:'Vlastný tréning',statistiky:'Štatistiky',import:'Import a zálohy'}[page])}`;
  if(updateHash && location.hash!==`#${page}`)history.replaceState(null,'',`#${page}`);
  window.scrollTo({top:0,behavior:'auto'});
}

// Normalize human-written lesson labels so both “Lekcia 1” and “Begegnungen A2+ – Lekcia 1” belong together.
// All the current imported material comes from Begegnungen A2+. Unknown custom names remain distinct.
function lessonKey(raw){
  const s=String(raw||'').trim();
  if(!s)return 'unassigned';
  const match=s.match(/(?:lekcia|lektion|kapitel|lesson)\s*0*(\d+)/i);
  if(match)return `lesson-${Number(match[1])}`;
  return 'custom:'+s;
}
const lessonNames={1:'Ausbildung und Tätigkeiten',2:'Hobbys und Freizeit',3:'Geld und Konsum',4:'Arbeit und Beruf',5:'Urlaub und Reisen',6:'Tiere und Menschen',7:'Wohnen und Essen',8:'Politik und Technik'};
function lessonLabel(key){
  if(key==='unassigned')return 'Bez priradenej lekcie';
  if(key.startsWith('lesson-')){const n=Number(key.slice(7));return `Lekcia ${n}${lessonNames[n]?' · '+lessonNames[n]:''}`;}
  return key.startsWith('custom:')?key.slice(7):key;
}
function entryLessonKeys(e){
  const raw=[e.lesson,...(e.lessons||[]),...(e.tags||[]).filter(t=>/^(?:lekcia|lektion|kapitel)\s*\d+$/i.test(t))];
  const keys=[...new Set(raw.filter(Boolean).map(lessonKey))];
  return keys.length?keys:['unassigned'];
}
function lessonOptions(){
  const counts=new Map();for(const e of entries)for(const k of entryLessonKeys(e)){counts.set(k,(counts.get(k)||0)+1);}
  return [...counts].sort(([a],[b])=>{
    const na=a.startsWith('lesson-')?Number(a.slice(7)):Infinity;
    const nb=b.startsWith('lesson-')?Number(b.slice(7)):Infinity;
    return na-nb||lessonLabel(a).localeCompare(lessonLabel(b),'sk');
  });
}
function replaceOptions(el,options,defaultValue='all'){
  const previous=el.value;el.replaceChildren();
  for(const [value,label] of options){const op=document.createElement('option');op.value=value;op.textContent=label;el.add(op);}
  el.value=options.some(([v])=>v===previous)?previous:defaultValue;
  if(el.selectedIndex<0)el.selectedIndex=0;
}
function lessonMatches(e,choice){return choice==='all'||entryLessonKeys(e).includes(choice);}
function sectionMatches(e,section){return section==='all'||(e.tags||[]).some(t=>t===`Časť ${section}`||t.startsWith(`Časť ${section} `));}
function isUsefulTopic(tag){
  return !(/^(?:Begegnungen A2\+|Lekcia \d+|Časť [ABCD]|Slovesá [–-]|Podstatné mená [–-]|Užitočné frázy a spojenia$|Modelové vety k lekcii$|Gramatické prehľady$)/i.test(tag));
}
function getTopics(list){
  const counts=new Map();for(const e of list)for(const t of e.tags||[]){if(isUsefulTopic(t))counts.set(t,(counts.get(t)||0)+1);}
  return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'sk'));
}
const DUO_CORE_SIZE=150;
const DUO_TYPE_QUOTAS={noun:50,verb:45,phrase:35,other:20};
function duoLessonState(key){
  if(!duoState.lessons)duoState.lessons={};
  return duoState.lessons[key]||{completed:[],best:{},history:[],coreIds:[]};
}
async function saveDuoState(){duoState.updatedAt=new Date().toISOString();await dbPut('meta',duoState);}
// Use the ACTUAL A2+ core tagged in the new source-based JSON, never a random
// first 40 A1 words. If only an older import exists, gracefully fall back to its core.
function duoCoreForLesson(key){
  const all=entries.filter(e=>lessonMatches(e,key));
  const n=Number(String(key).replace('lesson-',''));
  const newTag='Jadro A2+ L'+n,oldTag='Základné L'+n;
  // A record may have a Part B tag from another lesson: never drop explicitly selected core words.
  const eligible=all.filter(e=>(e.tags||[]).includes(newTag)||(e.tags||[]).includes(oldTag)||!(e.tags||[]).some(t=>/^Časť B\b/i.test(t)));
  const pool=eligible.length?eligible:all;
  const authoritative=pool.filter(e=>(e.tags||[]).includes(newTag));
  const legacy=pool.filter(e=>(e.tags||[]).includes(oldTag));
  const preferred=authoritative.length?authoritative:legacy.length?legacy:pool;
  const priority=e=>preferred.includes(e)?0:1;
  const sectionRank=e=>(e.tags||[]).some(x=>x==='Časť A')?0:1;
  const levelRank={A2:0,A1:1,B1:2,B2:3};
  // With the complete A2+ import, learn ALL tagged 150 core items.
  // Category quotas are only a fallback for older imports without a full curated core.
  const strictCore=authoritative.length>=DUO_CORE_SIZE;
  const sorted=[...(strictCore?authoritative:pool)].sort((a,b)=>priority(a)-priority(b)||sectionRank(a)-sectionRank(b)||
    (levelRank[a.level]??3)-(levelRank[b.level]??3)||a.de.localeCompare(b.de,'de'));
  const groups={};
  for(const [type,max] of Object.entries(DUO_TYPE_QUOTAS)){
    const candidates=sorted.filter(e=>e.type===type);
    if(type==='phrase')candidates.sort((a,b)=>{
      const full=e=>/[.!?]$/.test(e.de.trim())&&/[.!?]$/.test(e.sk.trim())&&e.de.split(/\s+/).length>=3;
      return priority(a)-priority(b)||Number(full(b))-Number(full(a))||a.de.localeCompare(b.de,'de');
    });
    groups[type]=strictCore?candidates:candidates.slice(0,max);
  }
  const selected=[],used=new Set();
  // Keep verbs present from the first level onward; do not put them after hundreds of nouns.
  while(selected.length<DUO_CORE_SIZE&&Object.values(groups).some(g=>g.length)){
    for(const type of ['verb','noun','phrase','other']){
      const e=groups[type].shift();if(e&&!used.has(e.id)){selected.push(e);used.add(e.id);}
    }
  }
  for(const e of sorted){if(selected.length>=DUO_CORE_SIZE)break;if(!used.has(e.id)){selected.push(e);used.add(e.id);}}
  // If a user already completed levels under v1.8/v1.9 (old 40-item path),
  // retain the words of those PASSED levels and append every authoritative A2+ word.
  // This can result in 151–160 items during migration; nothing already learnt is lost.
  const state=duoLessonState(key),snapshot=state.coreIds||[];
  if(snapshot.length){
    const byId=new Map(all.map(e=>[e.id,e]));
    const fixed=snapshot.map(id=>byId.get(id)).filter(Boolean);
    if(snapshot.length<DUO_CORE_SIZE){
      let contiguous=0;const done=new Set(state.completed||[]);
      while(done.has(contiguous+1))contiguous++;
      const keep=fixed.slice(0,contiguous*DeutschGame.SIZE);
      const ids=new Set(keep.map(x=>x.id));
      const rest=selected.filter(e=>!ids.has(e.id));
      // Include all expressly selected A2+ material even if old levels contained extras.
      const missing=authoritative.filter(e=>!ids.has(e.id)&&!rest.some(x=>x.id===e.id));
      return [...keep,...rest,...missing];
    }
    const ids=new Set(fixed.map(e=>e.id));
    return [...fixed,...selected.filter(e=>!ids.has(e.id))].slice(0,Math.max(DUO_CORE_SIZE,fixed.length));
  }
  return selected;
}
function duoLessonProgress(key){
  const pool=duoCoreForLesson(key),levels=Math.ceil(pool.length/DeutschGame.SIZE);
  const d=duoLessonState(key);
  const passed=[...new Set(d.completed||[])].filter(n=>n>=1&&n<=levels);
  let current=1;while(passed.includes(current))current++;
  return {total:pool.length,levels,passed:passed.length,current:Math.min(current,Math.max(1,levels)),done:levels>0&&passed.length===levels,mastered:pool.filter(DeutschSRS.duoMastered).length,introduced:pool.filter(DeutschSRS.hasStudied).length};
}
function duoLessonUnlocked(key){
  if(!/^lesson-\d+$/.test(key))return false;
  const n=Number(key.slice(7));if(n<1)return false;
  for(let i=1;i<n;i++)if(!duoLessonProgress('lesson-'+i).done)return false;
  return true;
}
function renderDuoLessonOptions(){
  const select=$('studyLesson');const previous=select.value;
  select.replaceChildren();
  for(let i=1;i<=8;i++){
    const key='lesson-'+i;const status=duoLessonProgress(key);const enabled=duoLessonUnlocked(key)&&status.total>0;
    const opt=document.createElement('option');opt.value=key;opt.disabled=!enabled;
    opt.textContent=lessonLabel(key)+(status.total?` (${status.passed}/${status.levels} úrovní)`:' (zatiaľ nenahraté)')+(enabled?'':' 🔒');
    select.add(opt);
  }
  const prevOpt=[...select.options].find(x=>x.value===previous&&!x.disabled);
  const first=[...select.options].find(x=>!x.disabled);
  select.value=prevOpt?.value||first?.value||'lesson-1';
}
function renderLessonOptions(){
  const opts=[['all','Všetky lekcie'],...lessonOptions().map(([k,n])=>[k,`${lessonLabel(k)} (${n})`])];
  const first=opts.find(([v])=>v.startsWith('lesson-'))?.[0]||'all';
  const hadLessons=[...$('practiceLesson').options].some(x=>x.value.startsWith('lesson-'));
  const previous=$('practiceLesson').value;
  replaceOptions($('filterLesson'),opts,'all');
  replaceOptions($('practiceLesson'),opts,first);
  renderDuoLessonOptions();
  if(!hadLessons && previous==='all' && first!=='all')$('practiceLesson').value=first;
  const list=$('knownLessons');list.replaceChildren();
  for(const [k] of lessonOptions())if(k!=='unassigned'){
    const e=entries.find(e=>entryLessonKeys(e).includes(k));
    const v=[e?.lesson,...(e?.lessons||[])].find(x=>lessonKey(x)===k)||lessonLabel(k);
    const el=document.createElement('option');el.value=v;list.append(el);
  }
}
function renderLibraryTopics(){
  const base=entries.filter(e=>lessonMatches(e,$('filterLesson').value));
  const opts=[['all','Všetky témy'],...getTopics(base).map(([k,n])=>[k,`${k} (${n})`])];
  replaceOptions($('filterTopic'),opts,'all');
}
function chosenTypes(){
  const v=document.querySelector('input[name="studyCategory"]:checked')?.value||'words';
  return v==='words'?new Set(['noun','other']):v==='all'?new Set(allEntryTypes):new Set([v]);
}
function practiceBaseEntries(){
  const types=chosenTypes();
  return entries.filter(e=>types.has(e.type)&&lessonMatches(e,$('practiceLesson').value)&&sectionMatches(e,$('practiceSection').value));
}
function practiceSelectedEntries(applyScope=true){
  let source=practiceBaseEntries();
  const topic=$('practiceTopic').value;if(topic!=='all')source=source.filter(e=>(e.tags||[]).includes(topic));
  if(applyScope){const scope=$('practiceScope').value;
    if(scope==='due')source=source.filter(due);
    else if(scope==='wrong')source=source.filter(e=>e.review?.wrong>0).sort((a,b)=>(b.review?.wrong||0)-(a.review?.wrong||0));
  }
  return source;
}
function renderPracticeTopics(){
  const base=practiceBaseEntries();
  const opts=[['all','Všetky témy'],...getTopics(base).map(([k,n])=>[k,`${k} (${n})`])];
  replaceOptions($('practiceTopic'),opts,'all');
}
function renderTypeCounts(){
  const source=entries.filter(e=>lessonMatches(e,$('practiceLesson').value)&&sectionMatches(e,$('practiceSection').value));
  const counters={noun:'countNoun',verb:'countVerb',other:'countOther',phrase:'countPhrase'};
  for(const [type,id] of Object.entries(counters))$(id).textContent=source.filter(e=>e.type===type).length;
  $('countWords').textContent=source.filter(e=>e.type==='noun'||e.type==='other').length;
  $('countAll').textContent=source.length;
}
function renderQuizAvailability(){
  renderTypeCounts();renderPracticeTopics();updatePracticeSummary();
}
function countLabel(n,one,few,many){return `${n} ${n===1?one:n>=2&&n<=4?few:many}`;}
function requestedQuestionCount(max){
  if($('practiceAll').checked)return max;
  const value=Number($('practiceCount').value);
  if(!Number.isInteger(value)||value<1||value>10000)return 0;
  return Math.min(value,max);
}
function syncPracticeKind(){
  const selected=document.querySelector('input[name="studyCategory"]:checked')?.value||'words';
  const allowGrammar=$('practiceAdvanced').checked;
  const kind=$('practiceKind');
  for(const option of kind.options){
    const grammar=option.dataset.grammar==='true';
    const compatible=(!['preterite','perfect'].includes(option.value)||selected==='verb'||selected==='all') &&
      (!['article','plural'].includes(option.value)||selected==='noun'||selected==='words'||selected==='all');
    option.disabled=grammar&&(!allowGrammar||!compatible);
    option.hidden=grammar&&!allowGrammar;
  }
  if(kind.selectedOptions[0]?.disabled)kind.value='de_to_sk';
}
function updatePracticeSummary(){
  syncPracticeKind();
  const source=practiceSelectedEntries();
  const kind=$('practiceKind').value;
  const tasks=buildTasks(source,kind);
  const requested=requestedQuestionCount(tasks.length);
  $('quizAvailable').textContent=`Dostupných otázok po filtrovaní: ${tasks.length}`;
  $('practiceCount').disabled=$('practiceAll').checked;
  const examples={de_to_sk:'der Beruf → [napíšeš po slovensky: povolanie]',
    sk_to_de:'povolanie → [napíšeš po nemecky: der Beruf]',
    both:'der Beruf ↔ povolanie (náhodný smer)',
    preterite:'gehen → [napíšeš: ging]',perfect:'gehen → [napíšeš: ist gegangen]',
    article:'Beruf → [napíšeš: der]',plural:'der Beruf → [napíšeš: die Berufe]',
    grammar_mix:'Zmiešané otázky na členy, časy a množné číslo'};
  $('practicePreviewExample').textContent=examples[kind]||'';
  const invalid=!$('practiceAll').checked && !requested;
  $('practiceSelectionInfo').innerHTML=`<strong>${countLabel(source.length,'vybraný záznam','vybrané záznamy','vybraných záznamov')}</strong> · ${countLabel(tasks.length,'dostupná otázka','dostupné otázky','dostupných otázok')}.<br>${invalid?'Zadaj platný počet otázok (1 až 10 000).':tasks.length?`Spustí sa ${countLabel(requested,'otázka','otázky','otázok')}.`:'Pre túto kombináciu nie sú otázky. Zmeň typ učiva alebo smer precvičovania.'}`;
  $('practiceSelectionInfo').classList.toggle('selection-empty',!tasks.length||invalid);
  $('beginPracticeBtn').disabled=!tasks.length||invalid;
}

function due(entry){return Object.keys(entry.reviewModes||{}).some(k=>DeutschSRS.isDue(entry,k)) || (!Object.keys(entry.reviewModes||{}).length && entry.review?.attempts>0 && entry.review?.dueAt && new Date(entry.review.dueAt).getTime()<=Date.now());}
function renderStats(){
  $('statEntries').textContent=entries.length;
  $('statDue').textContent=entries.filter(due).length;
  $('statAccuracy').textContent=attempts.length ? `${Math.round(attempts.filter(a=>a.correct).length/attempts.length*100)} %` : '—';
  $('homeEmpty').hidden=entries.length>0;
  renderLearningStats();
  renderAchievements();
}
function renderCategories(){
  const kinds=[['verb','↝','Slovesá'],['noun','▥','Podstatné mená'],['phrase','❞','Frázy a vety'],['other','✳','Ostatné']];
  $('homeCategories').innerHTML=kinds.map(([key,icon,label])=>`<div class="category-box"><span class="category-symbol">${icon}</span><strong>${entries.filter(x=>x.type===key).length}</strong><p>${label}</p></div>`).join('');
}
function displayName(e){return e.type==='noun' && e.article?`${e.article} ${e.de}`:e.de;}
function renderLibrary(){
  const term=$('searchEntries').value.toLocaleLowerCase('de-DE').trim();
  const type=$('filterType').value, level=$('filterLevel').value, topic=$('filterTopic').value;
  const list=entries.filter(e=>lessonMatches(e,$('filterLesson').value)&&(type==='all'||type===e.type)&&(topic==='all'||(e.tags||[]).includes(topic))&&(level==='all'||level===e.level)&&(!term||[displayName(e),e.sk,e.preterite,e.perfect,...(e.tags||[])].join(' ').toLocaleLowerCase('de-DE').includes(term)));
  const visible=list.slice(0,libraryVisible);
  $('loadMoreEntriesBtn').classList.toggle('hidden',list.length<=libraryVisible);
  $('loadMoreEntriesBtn').textContent=`Zobraziť ďalšie (${Math.min(LIBRARY_PAGE_SIZE,Math.max(0,list.length-libraryVisible))} z ${list.length-libraryVisible} zostávajúcich)`;
  $('libraryCount').textContent=`Zodpovedá ${list.length} z ${entries.length} záznamov · zobrazených ${visible.length}`;
  $('entryList').innerHTML=list.length?visible.map(e=>`<article class="entry-card"><div class="entry-main"><div class="entry-top"><span class="type-label">${escapeHtml(typeLabels[e.type])}</span><span class="level-label">${escapeHtml(e.level)}</span>${entryLessonKeys(e).filter(k=>k!=='unassigned').slice(0,2).map(k=>`<span class="level-label">${escapeHtml(lessonLabel(k))}</span>`).join('')}${(e.tags||[]).filter(isUsefulTopic).slice(0,1).map(t=>`<span class="level-label">${escapeHtml(t)}</span>`).join('')}</div><div class="entry-name">${escapeHtml(displayName(e))}</div><div class="entry-translation">${escapeHtml(e.sk)}</div>${e.type==='verb'&&(e.preterite||e.perfect)?`<div class="entry-extra">Präteritum: ${escapeHtml(e.preterite||'—')} &nbsp; · &nbsp; Perfekt: ${escapeHtml(e.perfect||'—')}</div>`:''}${e.type==='noun'&&e.plural?`<div class="entry-extra">Množné číslo: ${escapeHtml(e.plural)}</div>`:''}${e.exampleDe?`<div class="entry-extra">${escapeHtml(e.exampleDe)}</div>`:''}</div><div class="entry-actions"><button class="icon-button" data-edit="${escapeHtml(e.id)}">Upraviť</button><button class="icon-button danger" data-delete="${escapeHtml(e.id)}">Zmazať</button></div></article>`).join('') : `<div class="empty-state"><div class="empty-illustration">▤</div><strong>Žiadne záznamy</strong><p>${entries.length?'Skús upraviť filtre alebo vyhľadávanie.':'Zatiaľ tu nič nie je. Pridaj prvé slovo alebo načítaj ukážky.'}</p></div>`;
}
function showDialog(id){
  const e=id?entries.find(x=>x.id===id):null;
  $('entryForm').reset();$('entryId').value=e?.id||'';
  $('dialogHeading').textContent=e?'Upraviť záznam':'Nový záznam';
  const mapping={fieldType:'type',fieldDe:'de',fieldSk:'sk',fieldArticle:'article',fieldPlural:'plural',fieldPreterite:'preterite',fieldPerfect:'perfect',fieldAux:'auxiliary',fieldLevel:'level',fieldLesson:'lesson',fieldTags:'tags',fieldExampleDe:'exampleDe',fieldExampleSk:'exampleSk',fieldNotes:'notes'};
  Object.entries(mapping).forEach(([id,key])=>{if(e)$(id).value=key==='tags'?(e.tags||[]).join(', '):e[key]||((key==='level')?'A1':'');});
  if(!e){$('fieldType').value='verb';$('fieldLevel').value='A1';
    const key=$('practiceLesson').value;
    if(key!=='all'&&key!=='unassigned'){$('fieldLesson').value=entries.flatMap(x=>[x.lesson,...(x.lessons||[])]).find(t=>lessonKey(t)===key)||lessonLabel(key);}
  }
  toggleFormFields();$('entryDialog').showModal();
  setTimeout(()=>$('fieldDe').focus(),30);
}
function toggleFormFields(){const t=$('fieldType').value;$('nounFields').classList.toggle('hidden',t!=='noun');$('verbFields').classList.toggle('hidden',t!=='verb');}
async function handleEntrySave(event){
  event.preventDefault();
  const id=$('entryId').value;
  const record={type:$('fieldType').value,de:$('fieldDe').value,sk:$('fieldSk').value,article:$('fieldArticle').value,plural:$('fieldPlural').value,
    preterite:$('fieldPreterite').value,perfect:$('fieldPerfect').value,auxiliary:$('fieldAux').value,level:$('fieldLevel').value,
    tags:$('fieldTags').value,lesson:$('fieldLesson').value,exampleDe:$('fieldExampleDe').value,exampleSk:$('fieldExampleSk').value,notes:$('fieldNotes').value};
  try {
    const old=entries.find(e=>e.id===id);
    const e=normalizeEntry(record);
    const duplicate=entries.find(x=>entryKey(x)===entryKey(e)&&x.id!==id);
    if(duplicate){notify('Takýto záznam už v slovníku existuje.',true);return;}
    if(old){e.id=old.id;e.createdAt=old.createdAt;e.review=old.review;e.reviewModes=old.reviewModes||{};e.alternatives=old.alternatives||[];e.lessons=[...new Set([...(old.lessons||[]),old.lesson,e.lesson].filter(Boolean))];}
    await dbPut('entries',e);$('entryDialog').close();await reloadData();notify(old?'Záznam bol upravený.':'Záznam bol uložený.');
  }catch(error){notify(error.message||'Záznam sa nepodarilo uložiť.',true);}
}
async function deleteEntry(id){
  const e=entries.find(x=>x.id===id);if(!e)return;
  if(!confirm(`Naozaj zmazať „${displayName(e)}“? Túto akciu nemožno vrátiť späť.`))return;
  try{await dbDelete('entries',id);await reloadData();notify('Záznam bol zmazaný.');}catch(err){notify('Mazanie zlyhalo: '+err.message,true);}
}
function correctAnswer(e,kind,task=null){
  switch(kind){
    case 'clozeChoice':return task?.answer||'';
    case 'buildSentence':return task?.fullDe||e.de;
    case 'match5':return 'Všetkých päť správnych dvojíc';
    case 'cloze':return task?.answer||'';
    case 'cloze_sk':return task?.answer||'';
    case 'article':return e.article;
    case 'plural':return e.plural;
    case 'preterite':return e.preterite;
    case 'perfect':return e.perfect;
    case 'de_to_sk':return e.sk;
    default:return displayName(e);
  }
}
function buildTasks(list,kind){
  const tasks=[];
  for(const e of list){
    if(['de_to_sk','sk_to_de','both'].includes(kind)){
      // Exactly one question for each word, even with two-direction mode.
      tasks.push({entryId:e.id,kind:kind==='both'?'both':kind});
    }
    if(e.type==='noun' && e.article && (kind==='grammar_mix'||kind==='article'))tasks.push({entryId:e.id,kind:'article'});
    if(e.type==='noun' && e.plural && (kind==='grammar_mix'||kind==='plural'))tasks.push({entryId:e.id,kind:'plural'});
    if(e.type==='verb' && e.preterite && (kind==='grammar_mix'||kind==='preterite'))tasks.push({entryId:e.id,kind:'preterite'});
    if(e.type==='verb' && e.perfect && (kind==='grammar_mix'||kind==='perfect'))tasks.push({entryId:e.id,kind:'perfect'});
  }
  return tasks;
}
function shuffle(a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;}
function startPractice(){
  document.querySelector('#page-trening h1').textContent='Vlastný tréning';
  syncPracticeKind();
  const kind=$('practiceKind').value,scope=$('practiceScope').value;
  const source=practiceSelectedEntries();
  let tasks=buildTasks(source,kind);
  if(scope!=='wrong')tasks=shuffle(tasks);
  const count=requestedQuestionCount(tasks.length);
  if(!count){notify('Vyber platný počet otázok a dostupné učivo.',true);return;}
  tasks=tasks.slice(0,count).map(t=>t.kind==='both'?{...t,kind:Math.random()<.5?'de_to_sk':'sk_to_de'}:t);
  quiz={tasks,index:0,good:0,answered:0,mode:$('practiceMode').value,resolved:false,style:'custom',introEnabled:false};
  $('duoActiveHint').classList.add('hidden');
  $('practiceSetup').classList.add('hidden');$('practiceFinished').classList.add('hidden');$('practiceActive').classList.remove('hidden');
  window.scrollTo({top:0,behavior:'auto'});
  renderQuestion();
}
function currentTask(){return quiz.tasks[quiz.index];}
function currentEntry(){return entries.find(e=>e.id===currentTask().entryId);}
function promptFor(e,kind,task=null){
  switch(kind){
    case 'match5':return {label:'SPOJ 5 DVOJÍC',q:'Nájdi päť správnych prekladov',context:'Spoj nemecké výrazy s ich slovenským významom.'};
    case 'buildSentence':return {label:'POSKLADAJ VETU',q:'Zostav vetu po nemecky',context:`Celá slovenská veta: ${task.fullSk}`};
    case 'clozeChoice':return {label:'DOPLŇ SLOVO Z MOŽNOSTÍ',q:task.question,context:`Celá veta po slovensky: ${task.fullSk}\nVyber chýbajúce nemecké slovo.`};
    case 'cloze': {
      const fullSk=task?.fullSk||e.exampleSk||e.sk;
      return {label:'DOPLŇ CHÝBAJÚCE NEMECKÉ SLOVO',q:task?.question||e.de,
        context:`Celá veta po slovensky: ${fullSk}\nDoplň jedno slovo do nemeckej vety (${task?.answer?.length||'?'} písmen).`};
    }
    case 'cloze_sk':return {label:'DOPLŇ CHÝBAJÚCE SLOVENSKÉ SLOVO',q:task?.question||e.sk,
      context:`Celá veta po nemecky: ${task?.fullDe||e.de}\nDoplň jedno slovo do slovenskej vety.`};
    case 'article':return {label:'SPRÁVNY ČLEN',q:`Aký člen má slovo „${e.de}“?`,context:'Napíš der, die alebo das.'};
    case 'plural':return {label:'MNOŽNÉ ČÍSLO',q:`Aké je množné číslo slova „${displayName(e)}“?`,context:'Napíš množné číslo aj s členom, napríklad die Bücher.'};
    case 'preterite':return {label:'PRÄTERITUM',q:`er/sie/es ______ · ${e.de}`,context:`Doplň tvar Präteritum slovesa „${e.de}“ (${e.sk}).`};
    case 'perfect':return {label:'PERFEKT',q:`er/sie/es ______ · ${e.de}`,context:`Napíš pomocné sloveso a Partizip II (${e.sk}). Príklad: ist gegangen.`};
    case 'de_to_sk':return {label:'PREKLAD DO SLOVENČINY',q:displayName(e),context:'Napíš slovenský význam. Člen je už súčasťou nemeckého slova.'};
    default:return {label:'PREKLAD DO NEMČINY',q:primaryTranslation(e,'de_to_sk'),context:e.type==='noun'?'Napíš nemecké slovo aj s členom.':'Napíš nemecký preklad.'};
  }
}
function renderQuestion(){
  if(!quiz)return;
  quiz.resolved=false;
  const e=currentEntry(),task=currentTask();const q=promptFor(e,task.kind,task);
  const all=quiz.style==='duo'?DeutschGame.STEPS:quiz.tasks.length;
  const label=quiz.style==='duo'?` · ${quiz.index<DeutschGame.OPENING?'prvé precvičenie':'záverečné opakovanie'}`:'';
  $('practiceProgressLabel').textContent=`Otázka ${quiz.index+1} / ${all}${label}`;
  $('progressBar').style.width=`${(quiz.index)/all*100}%`;
  $('questionType').textContent=q.label;$('questionPrompt').textContent=q.q;
  $('questionContext').textContent=q.context;$('questionContext').className='question-context';
  quiz.activeInputMode=activeAnswerMode(e,task);
  quiz.choiceOptions=quiz.activeInputMode==='choices'?(task.kind==='clozeChoice'?task.choices:choiceCandidates(e,task.kind)):[];
  if(quiz.activeInputMode==='choices'&&quiz.choiceOptions.length!==3)quiz.activeInputMode='type';
  for(const [id,mode] of [['typedAnswerBox','type'],['choiceAnswerBox','choices'],['flashcardAnswerBox','card'],['matchAnswerBox','match'],['builderAnswerBox','build']]){
    $(id).classList.toggle('hidden',quiz.activeInputMode!==mode);
  }
  $('choiceAnswers').replaceChildren();
  if(quiz.activeInputMode==='choices')quiz.choiceOptions.forEach((o,i)=>{
    const button=document.createElement('button');button.type='button';button.className='choice-option';button.dataset.choiceIndex=String(i);
    button.innerHTML=`<span class="choice-letter">${'ABC'[i]}</span><span>${escapeHtml(o.label)}</span>`;$('choiceAnswers').append(button);
  });
  if(quiz.activeInputMode==='match')renderMatchQuestion(task);
  if(quiz.activeInputMode==='build')renderBuilderQuestion(task);
  $('answerResult').className='answer-result hidden';
  $('nextQuestionBtn').classList.add('hidden');$('gradeButtons').classList.add('hidden');$('revealAnswerBtn').classList.remove('hidden');
  $('answerInput').value='';
  const firstGrammar=quiz.style==='duo'&&['perfect','preterite','article','plural'].includes(task.kind)&&DeutschSRS.isNew(e,task.kind)&&!quiz.previewedIds.has(e.id+'::'+task.kind);
  const intro=quiz.style==='duo' && quiz.introEnabled && ((quiz.newAtStart?.has(e.id)&&!quiz.previewedIds.has(e.id))||firstGrammar);
  $('introPreview').classList.toggle('hidden',!intro);$('questionCard').classList.toggle('hidden',intro);
  if(intro){
    if(firstGrammar){quiz.previewedIds.add(e.id+'::'+task.kind);
      $('introGerman').textContent=displayName(e)+' · '+q.label;
      $('introSlovak').textContent=correctAnswer(e,task.kind,task);
      $('introExtra').textContent='Nový gramatický tvar. Najprv si ho pozri, potom ho skúsiš napísať.';
      $('introExtra').classList.remove('hidden');
    }else{
      quiz.previewedIds.add(e.id);
      $('introGerman').textContent=displayName(e);$('introSlovak').textContent=e.sk;
      $('introExtra').textContent=e.type==='verb'?'Zatiaľ si zapamätaj význam slovesa. Minulé časy sa pridajú neskôr.':'';
      $('introExtra').classList.toggle('hidden',e.type!=='verb');
    }
    $('introExample').replaceChildren();
    for(const t of [e.exampleDe,e.exampleSk])if(t){const x=document.createElement('p');x.textContent=t;$('introExample').append(x);}
    $('introExample').classList.toggle('hidden',!e.exampleDe&&!e.exampleSk);
    $('practiceProgressLabel').textContent=`Zoznám sa so slovom · otázka ${quiz.index+1} / ${all}`;
  } else if(quiz.activeInputMode==='type')setTimeout(()=>$('answerInput').focus(),50);
}
function renderMatchQuestion(task){
  quiz.matchState={selectedLeft:null,selectedRight:null,matched:new Set(),mistakes:new Set()};
  $('matchLeft').replaceChildren();$('matchRight').replaceChildren();$('matchFeedback').textContent='';
  const pairs=task.pairs.map((p,i)=>({...p,index:i}));
  const right=shuffle(pairs);
  for(const item of pairs){const b=document.createElement('button');b.type='button';b.className='match-button';b.dataset.matchLeft=String(item.index);b.textContent=item.de;$('matchLeft').append(b);}
  for(const item of right){const b=document.createElement('button');b.type='button';b.className='match-button';b.dataset.matchRight=String(item.index);b.textContent=item.sk;$('matchRight').append(b);}
}
async function chooseMatch(side,index){
  if(!quiz||quiz.resolved||quiz.activeInputMode!=='match')return;
  const st=quiz.matchState;if(st.matched.has(index))return;
  if(side==='left')st.selectedLeft=index;else st.selectedRight=index;
  [...$('matchLeft').children].forEach(b=>b.classList.toggle('selected',Number(b.dataset.matchLeft)===st.selectedLeft));
  [...$('matchRight').children].forEach(b=>b.classList.toggle('selected',Number(b.dataset.matchRight)===st.selectedRight));
  if(st.selectedLeft===null||st.selectedRight===null)return;
  const left=st.selectedLeft,right=st.selectedRight;st.selectedLeft=null;st.selectedRight=null;
  if(left===right){st.matched.add(left);$('matchFeedback').textContent=`Správne páry: ${st.matched.size} / 5`;
    [...$('matchLeft').children].forEach(b=>{if(Number(b.dataset.matchLeft)===left){b.classList.add('matched');b.disabled=true;}b.classList.remove('selected');});
    [...$('matchRight').children].forEach(b=>{if(Number(b.dataset.matchRight)===right){b.classList.add('matched');b.disabled=true;}b.classList.remove('selected');});
  }else{st.mistakes.add(left);$('matchFeedback').textContent='Tento pár nesedí. Skús iný slovenský význam.';
    [...$('matchLeft').children,...$('matchRight').children].forEach(b=>b.classList.remove('selected'));}
  if(st.matched.size===5){const correct=st.mistakes.size===0;await recordAttempt(correct);showAnswerResult(correct);}
}
function renderBuilderQuestion(task){
  quiz.builderSelected=[];$('builderChosen').replaceChildren();$('builderBank').replaceChildren();
  for(const item of task.bank){const b=document.createElement('button');b.type='button';b.className='builder-token';b.dataset.tokenId=item.id;b.textContent=item.word;$('builderBank').append(b);}
  renderBuilderSelected();
}
function renderBuilderSelected(){
  const task=currentTask(),used=new Set(quiz.builderSelected);$('builderChosen').replaceChildren();
  for(const id of quiz.builderSelected){const item=task.bank.find(x=>x.id===id);if(!item)continue;
    const b=document.createElement('button');b.type='button';b.className='builder-token';b.dataset.undoToken=id;b.textContent=item.word;$('builderChosen').append(b);}
  [...$('builderBank').children].forEach(b=>{b.disabled=used.has(b.dataset.tokenId);b.classList.toggle('used',b.disabled);});
  if(!quiz.builderSelected.length)$('builderChosen').textContent='Tu sa bude skladať tvoja veta…';
}
async function checkBuilder(){
  if(!quiz||quiz.resolved||quiz.activeInputMode!=='build')return;
  if(!quiz.builderSelected.length){notify('Najprv poskladaj vetu.',true);return;}
  const task=currentTask(),given=quiz.builderSelected.map(id=>task.bank.find(x=>x.id===id)?.word).join(' ');
  const correct=normalizeAnswer(given,'sk_to_de')===normalizeAnswer(task.correctTokens.join(' '),'sk_to_de');
  await recordAttempt(correct);showAnswerResult(correct);
}
function completeIntroduction(){
  if(!quiz||$('introPreview').classList.contains('hidden'))return;
  $('introPreview').classList.add('hidden');$('questionCard').classList.remove('hidden');
  if(quiz.activeInputMode==='type')$('answerInput').focus();
  $('practiceProgressLabel').textContent=`Otázka ${quiz.index+1} / ${quiz.tasks.length} · ${quiz.activeInputMode==='choices'?'vyber odpoveď':'skús odpovedať'}`;
}
// Study mode is forgiving about spelling details. We still show the correct
// German spelling after checking the answer, including capitals and umlauts.
function normalizeAnswer(a,kind='sk_to_de'){
  return String(a||'').trim().toLocaleLowerCase(kind==='de_to_sk'||kind==='cloze_sk'?'sk-SK':'de-DE')
    .replace(/[.!?]+$/g,'').replace(/[„“”"']/g,'').replace(/\s+/g,' ')
    .replace(/ß/g,'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
}
// Accept either dropping umlauts (schuler) or typing them as ae/oe/ue
// (schueler), but don't strip ordinary ae/oe/ue from unrelated words.
function answerSpellings(answer,kind){
  if(kind==='de_to_sk'||kind==='cloze_sk')return [answer];
  const standard=String(answer||'');
  const transliterated=standard.replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue')
    .replace(/Ä/g,'Ae').replace(/Ö/g,'Oe').replace(/Ü/g,'Ue').replace(/ß/g,'ss');
  return [standard,transliterated];
}
// One record may carry SEVERAL correct meanings; the learner needs only one.
// For phrases, two separate questions ("Aké...? Čím...?") are treated as alternatives,
// but a normal two-sentence story is NOT split into incorrectly-short answers.
// Translator data sometimes includes explanations instead of an actual answer,
// e.g. "od (minulosti až doteraz); s datívom". Those notes must never be
// required or shown as a multiple-choice answer. Preserve the full original
// text as a backward-compatible accepted answer.
function cleanGloss(text){
  return String(text||'').replace(/\s*\([^()]*\)/g,'').replace(/\s+/g,' ').trim().replace(/[;,]+$/,'').trim();
}
function isGrammarNote(text){
  return /^(?:s|so|v|vo|bez)\s+(?:dat[ií]v\w*|akuzat[ií]v\w*|genit[ií]v\w*|inštrument[aá]l\w*|lok[aá]l\w*)\b/i.test(text)
     || /^(?:gramatick[aá] pozn[aá]mka|predlo[zž]ka|pou[zž][ií]va sa)\b/i.test(text);
}
function translationVariants(e,kind='de_to_sk',task=null){
  const base=correctAnswer(e,kind,task);
  const translations=[base,...(['de_to_sk','sk_to_de'].includes(kind)?(e.alternatives||[]):[])];
  const variants=[];
  for(const raw of translations){
    const value=String(raw||'').trim();if(!value)continue;
    const chunks=kind==='de_to_sk'&&e.type!=='phrase'?value.split(/\s*[,;/]\s*/):
      kind==='de_to_sk'&&e.type==='phrase'?value.split(/\s+(?:\/|\|)\s+|\s*;\s*/):[value];
    for(const chunk of chunks){
      if(kind==='de_to_sk'&&e.type==='phrase'){
        const questions=chunk.split(/(?<=[?])\s+(?=[\p{Lu}])/u).map(x=>x.trim()).filter(Boolean);
        if(questions.length>1&&questions.every(x=>x.endsWith('?'))){
          for(const q of questions){const cleaned=cleanGloss(q);if(cleaned)variants.push(cleaned);}
          continue;
        }
      }
      const cleaned=kind==='de_to_sk'?cleanGloss(chunk):chunk.trim();
      if(cleaned&&(kind!=='de_to_sk'||!isGrammarNote(cleaned)))variants.push(cleaned);
    }
    // Still accept the raw complete translation, but do not make it the expected label.
    if(value&&!isGrammarNote(value))variants.push(value);
  }
  return [...new Set(variants.filter(Boolean))];
}
function primaryTranslation(e,kind='de_to_sk'){
  const choices=translationVariants(e,kind);
  return choices[0]||correctAnswer(e,kind);
}
function acceptableAnswers(e,kind,task=null){
  return [...new Set(translationVariants(e,kind,task).flatMap(x=>answerSpellings(x,kind)).map(x=>normalizeAnswer(x,kind)).filter(Boolean))];
}
// Multiple-choice translations come from other entries of the same kind; never from a fixed fake list.
function choiceCandidates(entry,kind){
  if(!['de_to_sk','sk_to_de'].includes(kind))return [];
  const labelFor=e=>kind==='de_to_sk'?primaryTranslation(e,'de_to_sk'):displayName(e);
  const correctText=labelFor(entry);
  const correctKeys=new Set(acceptableAnswers(entry,kind));
  const currentPool=(quiz.style==='duo'?studyPool():practiceSelectedEntries()).filter(x=>x.type===entry.type);
  const largerPool=entries.filter(x=>x.type===entry.type);
  const found=new Map();
  const addPool=pool=>{
    for(const candidate of pool){
      if(candidate.id===entry.id)continue;
      const label=labelFor(candidate).trim();
      const normalized=normalizeAnswer(label,kind);
      if(!label||correctKeys.has(normalized)||found.has(normalized))continue;
      // Exclude distractors whose valid answers match a valid answer to the actual question.
      if(acceptableAnswers(candidate,kind).some(x=>correctKeys.has(x)))continue;
      found.set(normalized,{label,id:candidate.id});
    }
  };
  addPool(currentPool);
  // Only use another lesson when fewer than two distinct answers exist in the selected lesson.
  if(found.size<2)addPool(largerPool);
  const choices=[...found.values()].sort((a,b)=>Math.abs(a.label.length-correctText.length)-Math.abs(b.label.length-correctText.length));
  const nearby=shuffle(choices.slice(0,Math.min(25,choices.length))).slice(0,2);
  if(nearby.length<2)return []; // Fall back to writing; never fabricate wrong meanings.
  return shuffle([{label:correctText,correct:true},...nearby.map(x=>({label:x.label,correct:false}))]);
}
function activeAnswerMode(entry,task){
  if(quiz.style==='duo'){
    if(task.kind==='match5')return 'match';
    if(task.kind==='buildSentence')return 'build';
    if(task.kind==='clozeChoice')return 'choices';
    return task.modeHint==='choices'?'choices':'type';
  }
  if(quiz.mode==='card')return 'card';
  return quiz.mode==='choices' && ['de_to_sk','sk_to_de'].includes(task.kind)?'choices':'type';
}
function isCorrectAnswer(e,kind,value,task=null){
  return acceptableAnswers(e,kind,task).includes(normalizeAnswer(value,kind));
}
async function saveAttemptFor(e,kind,correct,method){
  const r={...newReview(),...(e.review||{})};
  r.attempts++;if(correct){r.correct++;r.streak++;}else{r.wrong++;r.streak=0;}
  const now=new Date();r.lastReviewed=now.toISOString();
  const mode=DeutschSRS.apply(e,kind,correct,now,method);
  r.dueAt=mode.dueAt;e.review=r;e.updatedAt=now.toISOString();
  const attempt={id:uid(),entryId:e.id,kind,correct:!!correct,answerMethod:method,createdAt:now.toISOString(),sessionType:quiz.style||'custom'};
  await dbPut('entries',e);await dbPut('attempts',attempt);attempts.push(attempt);
}
async function recordAttempt(isCorrect){
  if(quiz.resolved)return;
  quiz.resolved=true;const task=currentTask();
  quiz.answered++;if(isCorrect)quiz.good++;
  try{
    if(quiz.style==='duo'&&task.kind==='match5'){
      const missed=quiz.matchState.mistakes;
      for(let i=0;i<task.pairs.length;i++){
        const e=entries.find(x=>x.id===task.pairs[i].entryId);
        if(e)await saveAttemptFor(e,'de_to_sk',!missed.has(i),'choices');
        if(missed.has(i))quiz.misses.push(task.pairs[i].entryId);
      }
    }else{
      const e=currentEntry(),kind=task.kind==='clozeChoice'?'cloze':task.kind==='buildSentence'?'sk_to_de':task.kind;
      await saveAttemptFor(e,kind,isCorrect,quiz.activeInputMode==='choices'?'choices':'recall');
      if(quiz.style==='duo'&&!isCorrect)quiz.misses.push(e.id);
    }
    renderStats();if(quiz.style==='duo')renderDuoLessonOptions();
  }catch(err){notify('Odpoveď sa nepodarilo uložiť: '+err.message,true);}
}
function showAnswerResult(correct){
  const e=currentEntry(),task=currentTask();const answer=task.kind==='de_to_sk'?primaryTranslation(e,'de_to_sk'):task.kind==='match5'?task.pairs.map(p=>p.de+' — '+p.sk).join(' · '):correctAnswer(e,task.kind,task);
  const el=$('answerResult');el.className='answer-result'+(correct?'':' incorrect');
  const userSpelling=$('answerInput').value.trim();
  const germanDirection=!['de_to_sk','cloze_sk'].includes(task.kind);
  const spellingTip=correct && quiz.activeInputMode==='type' && germanDirection && userSpelling &&
    userSpelling!==answer ? '<p>Odpoveď je uznaná. Pozri si správny nemecký zápis vyššie.</p>' : '';
  const variants=task.kind==='de_to_sk'?translationVariants(e,task.kind).filter(x=>x!==answer&&x!==correctAnswer(e,task.kind,task)):[];
  const variantHelp=variants.length?`<p>Uznávame aj: ${escapeHtml(variants.join(' / '))}</p>`:'';
  el.innerHTML=`<span>${correct?'✓ Správne!':quiz.style==='duo'?'Zopakujeme si to ešte raz':'Správna odpoveď'}</span><strong>${escapeHtml(answer)}</strong>${variantHelp}${spellingTip}${e.exampleDe?`<p>${escapeHtml(e.exampleDe)}${e.exampleSk?' — '+escapeHtml(e.exampleSk):''}</p>`:''}${e.notes?`<p>${escapeHtml(e.notes)}</p>`:''}`;
  $('typedAnswerBox').classList.add('hidden');$('flashcardAnswerBox').classList.add('hidden');
  $('matchAnswerBox').classList.add('hidden');$('builderAnswerBox').classList.add('hidden');
  if(quiz.activeInputMode==='choices'){
    [...$('choiceAnswers').children].forEach((button,i)=>{
      button.disabled=true;
      if(quiz.choiceOptions[i]?.correct)button.classList.add('choice-correct');
      if(i===quiz.chosenOptionIndex&&!quiz.choiceOptions[i]?.correct)button.classList.add('choice-wrong');
    });
  } else $('choiceAnswerBox').classList.add('hidden');
  $('nextQuestionBtn').classList.remove('hidden');
  $('nextQuestionBtn').focus();
}
async function checkChoiceAnswer(index){
  if(!quiz || quiz.resolved || quiz.activeInputMode!=='choices')return;
  const choice=quiz.choiceOptions?.[index];
  if(!choice)return;
  quiz.chosenOptionIndex=index;
  await recordAttempt(choice.correct);
  showAnswerResult(choice.correct);
}
async function checkTypedAnswer(){
  if(!quiz || quiz.resolved)return;
  const typed=$('answerInput').value;
  if(!typed.trim()){notify('Najprv napíš svoju odpoveď.',true);return;}
  const correct=isCorrectAnswer(currentEntry(),currentTask().kind,typed,currentTask());
  await recordAttempt(correct);showAnswerResult(correct);
}
async function dontKnow(){
  if(!quiz||quiz.resolved)return;
  await recordAttempt(false);
  showAnswerResult(false);
}
function revealCard(){
  if(!quiz || quiz.resolved)return;
  const e=currentEntry(),task=currentTask();
  $('answerResult').className='answer-result';
  $('answerResult').innerHTML=`<span>Správna odpoveď</span><strong>${escapeHtml(correctAnswer(e,task.kind,task))}</strong>${e.exampleDe?`<p>${escapeHtml(e.exampleDe)}${e.exampleSk?' — '+escapeHtml(e.exampleSk):''}</p>`:''}`;
  $('revealAnswerBtn').classList.add('hidden');$('gradeButtons').classList.remove('hidden');
}
async function gradeCard(correct){if(!quiz||quiz.resolved)return;await recordAttempt(correct);$('gradeButtons').classList.add('hidden');$('nextQuestionBtn').classList.remove('hidden');}
function handlePracticeEnter(event){
  if(event.key!=='Enter' || event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey)return;
  if(!quiz || $('practiceActive').classList.contains('hidden'))return;
  // Do not override native keyboard activation of unrelated controls.
  const button=event.target?.closest?.('button');
  if(button && !['checkAnswerBtn','nextQuestionBtn','introContinueBtn','revealAnswerBtn'].includes(button.id))return;
  if(event.target?.closest?.('textarea,select,[contenteditable="true"]'))return;
  if(!$('introPreview').classList.contains('hidden')){
    event.preventDefault();completeIntroduction();return;
  }
  if(quiz.resolved){
    if(!$('nextQuestionBtn').classList.contains('hidden')){
      event.preventDefault();nextQuestion();
    }
    return;
  }
  if(['choices','match','build'].includes(quiz.activeInputMode))return; // Keyboard activation uses focused buttons.
  if(quiz.activeInputMode==='type' && !$('questionCard').classList.contains('hidden')){
    event.preventDefault();checkTypedAnswer();return;
  }
  if(quiz.activeInputMode==='card' && !$('gradeButtons').classList.contains('hidden'))return;
  if(quiz.activeInputMode==='card' && !$('revealAnswerBtn').classList.contains('hidden')){
    event.preventDefault();revealCard();
  }
}
async function finalizeDuoRound(){
  const key=quiz.lesson,level=quiz.level,passed=quiz.good>=DeutschGame.PASS;
  const d={...duoLessonState(key)};
  d.completed=[...new Set([...(d.completed||[]),...(passed?[level]:[])])].sort((a,b)=>a-b);
  d.best={...(d.best||{})};d.best[level]=Math.max(d.best[level]||0,quiz.good);
  d.history=[...(d.history||[]),{level,score:quiz.good,total:DeutschGame.STEPS,passed,date:new Date().toISOString()}].slice(-150);
  duoState.lessons[key]=d;
  try{await saveDuoState();renderAchievements();}catch(err){notify('Výsledok úrovne sa nepodarilo uložiť: '+err.message,true);}
  const status=duoLessonProgress(key);
  $('duoFinishInfo').classList.remove('hidden');
  $('duoFinishInfo').innerHTML=`<strong>${passed?'✓ Úroveň '+level+' dokončená!':'Úroveň '+level+' zatiaľ nie je dokončená'}</strong><p>${passed?(status.done?'Celá lekcia dokončená. Ďalšia lekcia je odomknutá, ak je naimportovaná.':'Môžeš pokračovať na úroveň '+status.current+'.'):'Na postup potrebuješ aspoň '+DeutschGame.PASS+' správnych odpovedí z 15. Zopakuj rovnakú úroveň.'}</p><p>V lekcii máš dokončených <b>${status.passed} z ${status.levels}</b> úrovní.</p>`;
}
async function nextQuestion(){
  if(!quiz||!quiz.resolved)return;
  quiz.index++;
  if(quiz.style==='duo' && quiz.index===DeutschGame.OPENING && !quiz.recapCreated){
    quiz.recapCreated=true;
    const recap=DeutschGame.buildRecap(quiz.focus,quiz.review,quiz.misses);
    quiz.tasks.push(...recap);
  }
  if(quiz.index>=quiz.tasks.length){
    $('introPreview').classList.add('hidden');$('questionCard').classList.remove('hidden');
    $('practiceActive').classList.add('hidden');$('practiceFinished').classList.remove('hidden');
    $('practiceSummary').textContent=`Správne odpovede: ${quiz.good} z ${quiz.answered} (${Math.round(100*quiz.good/Math.max(quiz.answered,1))} %).`;
    $('progressBar').style.width='100%';
    if(quiz.style==='duo')await finalizeDuoRound();else $('duoFinishInfo').classList.add('hidden');
    renderQuizAvailability();renderDuoLessonOptions();updateDuolingoPreview();
  }else renderQuestion();
}
function resetPractice(){
  document.querySelector('#page-trening h1').textContent='Vlastný tréning';
  const previousStyle=quiz?.style;
  quiz=null;$('introPreview').classList.add('hidden');$('questionCard').classList.remove('hidden');
  $('practiceActive').classList.add('hidden');$('practiceFinished').classList.add('hidden');$('practiceSetup').classList.remove('hidden');
  $('duoActiveHint').classList.add('hidden');
  if(previousStyle==='duo')switchPage('ucenie');
}
function studyPool(){
  const lesson=$('studyLesson').value;
  return duoLessonUnlocked(lesson)?duoCoreForLesson(lesson):[];
}
function getDuoReviewPool(key,level){
  const core=duoCoreForLesson(key);const prior=core.slice(0,(level-1)*DeutschGame.SIZE);
  const n=Number(key.slice(7));
  for(let x=1;x<n;x++)for(const e of duoCoreForLesson('lesson-'+x)){
    if(DeutschSRS.hasStudied(e)&&(e.review?.wrong>0||due(e)))prior.push(e);
  }
  const unique=[...new Map(prior.map(e=>[e.id,e])).values()];
  return unique.sort(DeutschGame.sortWeak).slice(0,24);
}
function updateDuolingoPreview(){
  const lesson=$('studyLesson').value,status=duoLessonProgress(lesson),state=duoLessonState(lesson);
  $('duoLessonTitle').textContent=lessonLabel(lesson);
  $('duoLessonNumbers').textContent=`${status.passed} / ${status.levels} úrovní · ${Math.min(status.passed*DeutschGame.SIZE,status.total)} / ${status.total} výrazov`;
  $('duoLessonBar').style.width=(status.levels?100*status.passed/status.levels:0)+'%';
  $('duoLessonHint').textContent=status.done?'Lekcia dokončená. Môžeš pokračovať ďalej.':
    `Aktuálne: úroveň ${status.current} z ${status.levels}. Na postup potrebuješ 12 z 15 správnych odpovedí. Na ďalšiu lekciu dokonči všetky úrovne.`;
  $('duoLevelGrid').replaceChildren();
  for(let n=1;n<=status.levels;n++){
    const done=(state.completed||[]).includes(n),current=n===status.current&&!status.done;
    const cell=document.createElement('div');cell.className='duo-level-chip'+(done?' done':current?' current':' locked');
    cell.innerHTML=`<strong>${done?'✓':n}</strong><span>${done?'Hotovo':current?'Teraz':'Zamknuté'}</span>`;
    $('duoLevelGrid').append(cell);
  }
  const pool=studyPool(),review=getDuoReviewPool(lesson,status.current);
  const focus=pool.slice((status.current-1)*DeutschGame.SIZE,status.current*DeutschGame.SIZE);
  $('duoDueCount').textContent=`Nové slová v tejto úrovni: ${focus.filter(e=>!DeutschSRS.hasStudied(e)).length} · Preberané na opakovanie: ${review.length} · Slovesá v učive: ${pool.filter(e=>e.type==='verb').length}.`;
  $('duoPreview').innerHTML=pool.length?`<strong>Úroveň ${status.current} z ${status.levels}: 15 úloh · 10 na učenie + 5 opakovaní</strong><br>${status.done?'Všetky úrovne sú hotové. Môžeš si ešte precvičiť poslednú.':'Postupne prejdeš '+pool.length+' základných A2+ výrazov vrátane '+pool.filter(e=>e.type==='verb').length+' slovies. Na konci kola sa vrátia najmä chybné odpovede.'}`:
    '<strong>Táto lekcia je zamknutá alebo zatiaľ nie je naimportovaná.</strong>';
  $('beginDuoBtn').disabled=!pool.length||!duoLessonUnlocked(lesson);
}
async function startDuolingo(){
  const lesson=$('studyLesson').value;
  if(!duoLessonUnlocked(lesson)){notify('Túto lekciu odomkneš dokončením predošlej lekcie.',true);return;}
  const pool=studyPool(),status=duoLessonProgress(lesson),level=status.current;
  const focus=pool.slice((level-1)*DeutschGame.SIZE,level*DeutschGame.SIZE);
  if(!focus.length){notify('Pre túto lekciu chýba učivo. Najprv importuj slovíčka.',true);return;}
  const previous=duoLessonState(lesson);
  if((previous.coreIds||[]).join('|')!==pool.map(x=>x.id).join('|')){duoState.lessons[lesson]={...previous,coreIds:pool.map(x=>x.id)};await saveDuoState();}
  const review=getDuoReviewPool(lesson,level);
  const lessonEntries=entries.filter(e=>lessonMatches(e,lesson));
  const tasks=DeutschGame.buildOpening(focus,review,lessonEntries);
  // Grammar appears only after the meaning is established in both directions.
  if(level>=5){const ready=review.find(e=>e.type==='verb'&&e.perfect&&DeutschSRS.duoMastered(e));
    if(ready)tasks[9]={entryId:ready.id,kind:'perfect',stage:'new',step:10,modeHint:'type'};
  }
  const newAtStart=new Set(focus.filter(e=>!DeutschSRS.hasStudied(e)).map(e=>e.id));
  quiz={tasks,index:0,good:0,answered:0,mode:'type',resolved:false,style:'duo',lesson,level,focus,review,
    introEnabled:true,previewedIds:new Set(),newAtStart,recapCreated:false,misses:[]};
  $('practiceSetup').classList.add('hidden');$('practiceFinished').classList.add('hidden');$('practiceActive').classList.remove('hidden');
  $('duoActiveHint').classList.remove('hidden');$('duoFinishInfo').classList.add('hidden');
  switchPage('trening');
  document.querySelector('#page-trening h1').textContent=`Duolingo · Úroveň ${level}`;
  $('breadcrumb').innerHTML=`Osobná učebnica <span>/</span> Duolingo · Úroveň ${level}`;
  document.querySelectorAll('.nav-link').forEach(btn=>btn.classList.toggle('active',btn.dataset.page==='ucenie'));
  renderQuestion();
}
function renderLearningStats(){
  if(!$('statsToday'))return;
  const report=DeutschSRS.summarize(attempts,entries);
  $('statsToday').textContent=report.today;
  $('statsWeek').textContent=report.week;
  $('statsMastered').textContent=report.mastered;
  $('statsNewToday').textContent=report.newToday;
  $('statsNewWeek').textContent=report.newWeek;
  $('statsDue').textContent=report.due;
  $('statsTodayAccuracy').textContent=`Dnešná úspešnosť: ${report.accuracyToday==null?'—':report.accuracyToday+' %'}`;
  $('statsWeekAccuracy').textContent=`Týždenná úspešnosť: ${report.accuracyWeek==null?'—':report.accuracyWeek+' %'}`;
  $('homeTodayCount').textContent=report.today+' otázok';
  $('dailyPulseBar').style.width=Math.min(100,report.today/15*100)+'%';
  $('homeLearnedToday').textContent=report.newToday;
  $('homeDayStreak').textContent=report.streak+' dní';
  const top=Math.max(1,...report.days.map(d=>d.count));
  $('statsChart').innerHTML=report.days.map(d=>`<div class="day-bar"><span>${d.count}</span><div class="bar-track"><div class="bar-fill" style="height:${Math.max(d.count?6:1,Math.round(d.count/top*100))}%"></div></div><small>${escapeHtml(d.day)}</small></div>`).join('');
  const wrong=new Map();for(const a of attempts)if(!a.correct)wrong.set(a.entryId,(wrong.get(a.entryId)||0)+1);
  const hard=[...entries].filter(e=>wrong.has(e.id)).sort((a,b)=>(wrong.get(b.id)||0)-(wrong.get(a.id)||0)).slice(0,8);
  $('statsHardWords').innerHTML=hard.length?hard.map(e=>`<div class="hard-word"><span><strong>${escapeHtml(displayName(e))}</strong><small>${escapeHtml(e.sk)}</small></span><em>${wrong.get(e.id)}× chyba</em></div>`).join(''):'<p class="muted-small">Zatiaľ žiadne chyby. Začni prvým tréningom.</p>';
  updateDuolingoPreview();
  renderAchievements();
}
async function refreshApp(){
  const confirmed=confirm('Znovu načítať súbory aplikácie? Slovník ani výsledky učenia sa tým nevymažú.');
  if(!confirmed)return;
  try{
    if('serviceWorker' in navigator){const r=await navigator.serviceWorker.getRegistration();if(r)await r.update();}
    if('caches' in window){const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('deutsch-trainer-static-')).map(k=>caches.delete(k)));}
  }catch(error){console.warn('Aktualizácia cache:',error);}
  const url=new URL(window.location.href);url.searchParams.set('dt_reload',Date.now().toString());window.location.replace(url.href);
}

const CHATGPT_PROMPT=`Priprav mi import do webovej aplikácie Deutsch Trainer 1.9 z nasledujúcich nemeckých slovíčok a viet. Vráť IBA validný JSON, bez markdown bloku a bez vysvetlení. Štruktúra: {"format":"deutsch-trainer","version":1,"entries":[{"type":"verb","de":"gehen","sk":"ísť pešo","preterite":"ging","perfect":"ist gegangen","auxiliary":"sein","level":"A1","tags":["Pohyb"],"exampleDe":"Ich gehe nach Hause.","exampleSk":"Idem domov.","notes":""}]}. Povolené typy: verb, noun, phrase, other. Pri podstatných menách ulož základný tvar BEZ člena do "de" a člen zvlášť do "article" (der/die/das), množné číslo do "plural" (napr. "die Häuser"). Pri slovesách používaj Präteritum pre er/sie/es (napr. ging) a Perfekt pre er/sie/es (napr. ist gegangen). Nepíš vymyslené tvary, pri neistote nechaj voliteľné pole prázdne. Každá položka musí mať type, de, sk. Ak ide o učivo z lekcie, priraď každému záznamu rovnaké pole lesson, napríklad "Begegnungen A2+ – Lekcia 2"; toto pole je dôležité pre filtrovanie tréningu podľa lekcií. Ďalšie voliteľné polia: article, plural, preterite, perfect, auxiliary, exampleDe, exampleSk, notes, level, lesson, lessons, tags, alternatives. Text neprekladaj do angličtiny. Tu je môj zoznam:\n\n`;
async function copyText(text){
  try{await navigator.clipboard.writeText(text);notify('Prompt je skopírovaný. Vlož ho do ChatGPT a doplň zoznam slov.');}
  catch{const el=$('jsonInput');el.value=text;el.focus();el.select();notify('Automatické kopírovanie nie je dostupné. Prompt je označený, skopíruj ho pomocou Ctrl+C.');}
}
function readJson(text){
  let data;try{data=JSON.parse(text);}catch{throw new Error('Neplatný JSON. Skontroluj, či neobsahuje markdown ``` alebo vysvetľujúci text.');}
  if(!data||typeof data!=='object'||Array.isArray(data)&&data.length===0)throw new Error('JSON je prázdny.');
  if(!Array.isArray(data)){
    if(data.format && data.format!==DATA_FORMAT)throw new Error('Tento súbor nie je určený pre Deutsch Trainer.');
    if(data.version && Number(data.version)>DATA_VERSION)throw new Error('Súbor pochádza z novšej verzie aplikácie.');
  }
  const rows=Array.isArray(data)?data:data.entries;
  if(!Array.isArray(rows)||!rows.length)throw new Error('Chýba neprázdne pole "entries".');
  if(rows.length>10000)throw new Error('Maximálne 10 000 záznamov na jeden import.');
  const keepProgress=!!(data && data.backup===true);
  const normalized=rows.map((row,i)=>{try{return normalizeEntry(row,keepProgress);}catch(err){throw new Error(`Záznam ${i+1}: ${err.message}`);}});
  let history=[];
  if(keepProgress&&Array.isArray(data.attempts))history=data.attempts.filter(a=>a&&typeof a.id==='string'&&typeof a.entryId==='string'&&typeof a.createdAt==='string').slice(0,200000);
  const meta=keepProgress&&data.duoProgress&&typeof data.duoProgress==='object'?data.duoProgress:null;
  return {entries:normalized,history,keepProgress,meta};
}
function previewImport(){
  try{
    importPending=readJson($('jsonInput').value.trim());
    const known=new Set(entries.map(entryKey));let fresh=0,duplicates=0;
    for(const e of importPending.entries){if(known.has(entryKey(e)))duplicates++;else fresh++;known.add(entryKey(e));}
    $('importPreview').innerHTML=`<strong>Kontrola úspešná ✓</strong><p>Celkom: ${importPending.entries.length} položiek · nových: ${fresh} · existujúcich / opakovaných: ${duplicates}.</p><p>Existujúce údaje zostanú zachované; doplnia sa len prázdne polia a nové kategórie.</p><button class="btn btn-primary" id="confirmImportBtn">Potvrdiť import</button>`;
    $('importPreview').classList.remove('hidden');$('confirmImportBtn').addEventListener('click',confirmImport,{once:true});
  }catch(err){importPending=null;$('importPreview').classList.add('hidden');notify(err.message,true);}
}
async function confirmImport(){
  if(!importPending)return;
  const button=$('confirmImportBtn');if(button)button.disabled=true;
  try{
    const known=new Map(entries.map(e=>[entryKey(e),e]));
    let added=0,updated=0,unchanged=0;
    for(const incoming of importPending.entries){
      const key=entryKey(incoming); const old=known.get(key);
      if(!old && [...known.values()].some(e=>e.id===incoming.id)){incoming.id=uid();}
      if(old){const m=mergeEntries(old,incoming);if(m.changed){await dbPut('entries',m.merged);known.set(key,m.merged);updated++;}else unchanged++;}
      else{await dbPut('entries',incoming);known.set(key,incoming);added++;}
    }
    // History is restored only for exact entry IDs present in backup.
    if(importPending.keepProgress){
      const ids=new Set([...known.values()].map(e=>e.id));
      for(const record of importPending.history){if(ids.has(record.entryId))await dbPut('attempts',record);}
      if(importPending.meta?.lessons){duoState={id:'duo-progress-v2',lessons:importPending.meta.lessons};await saveDuoState();}
    }
    importPending=null;$('jsonInput').value='';$('jsonFile').value='';$('selectedFile').textContent='';
    $('importPreview').classList.add('hidden');
    await reloadData();notify(`Import dokončený: ${added} nových, ${updated} doplnených, ${unchanged} bez zmeny.`);
  }catch(err){notify('Import sa nepodarilo dokončiť: '+err.message,true);if(button)button.disabled=false;}
}
// Both destructive actions run in one IndexedDB transaction, so failures roll back.
let resetKind=null;
const resetTokens={progress:'RESET',all:'VYMAZAT'};
function openResetDialog(kind){
  if(!db){notify('Databáza nie je dostupná.',true);return;}
  resetKind=kind;
  const all=kind==='all';
  $('resetDialogTitle').textContent=all?'Vymazať celú databázu?':'Vynulovať výsledky učenia?';
  $('resetDialogDescription').textContent=all
    ?'Natrvalo sa zmažú všetky slovíčka, importované lekcie, odpovede, štatistiky, levely aj odznaky v tomto prehliadači. Aplikácia zostane nainštalovaná, ale slovník bude prázdny.'
    :'Zmaže sa celá história odpovedí, úspešnosť, opakovacie termíny, odznaky a dokončené levely. Všetky slovíčka, preklady, kategórie a lekcie zostanú zachované.';
  $('resetDialogToken').textContent=resetTokens[kind];
  $('resetConfirmInput').value='';
  $('resetConfirmBtn').disabled=true;
  $('resetConfirmBtn').textContent=all?'Vymazať všetko':'Vynulovať progres';
  $('resetDialog').showModal();
  $('resetConfirmInput').focus();
}
function closeResetDialog(){ $('resetDialog').close();resetKind=null; }
function executeReset(kind){
  return new Promise((resolve,reject)=>{
    const stores=['entries','attempts','meta'];
    // Older prerelease installations may additionally contain an unused sync queue.
    if(db.objectStoreNames.contains('sync_ops'))stores.push('sync_ops');
    const tx=db.transaction(stores,'readwrite');
    const entryStore=tx.objectStore('entries');
    if(kind==='all'){
      entryStore.clear();
      tx.objectStore('attempts').clear();
      tx.objectStore('meta').clear();
      if(stores.includes('sync_ops'))tx.objectStore('sync_ops').clear();
    }else{
      tx.objectStore('attempts').clear();
      tx.objectStore('meta').delete('duo-progress-v2');
      // Reset each entry without changing its meaning, ID, lesson or tags.
      const cursorRequest=entryStore.openCursor();
      cursorRequest.onsuccess=()=>{
        const cursor=cursorRequest.result;
        if(!cursor)return;
        const e=cursor.value;
        e.review=newReview();
        e.reviewModes={};
        cursor.update(e);
        cursor.continue();
      };
    }
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error||new Error('Zlyhala databázová transakcia.'));
    tx.onabort=()=>reject(tx.error||new Error('Transakcia bola zrušená.'));
  });
}
async function confirmReset(){
  const kind=resetKind;
  if(!kind||$('resetConfirmInput').value.trim().toUpperCase()!==resetTokens[kind])return;
  const btn=$('resetConfirmBtn');btn.disabled=true;
  try{
    if(quiz)resetPractice();
    await executeReset(kind);
    closeResetDialog();
    importPending=null;
    $('jsonInput').value='';$('jsonFile').value='';$('selectedFile').textContent='';
    $('importPreview').classList.add('hidden');
    await reloadData();
    switchPage(kind==='all'?'import':'ucenie');
    notify(kind==='all'
      ?'Databáza bola vymazaná. Teraz importuj nový JSON slovník a začni od Levelu 1.'
      :'Progres je vynulovaný. Slovník zostal zachovaný a začínaš od Levelu 1.');
  }catch(err){notify('Reset sa nepodarilo dokončiť: '+err.message,true);btn.disabled=false;}
}

function exportData(){
  const payload={format:DATA_FORMAT,version:DATA_VERSION,backup:true,exportedAt:new Date().toISOString(),entries,attempts,duoProgress:duoState};
  downloadJson(payload,`deutsch-trainer-zaloha-${new Date().toISOString().slice(0,10)}.json`);
  notify('Záloha bola pripravená na stiahnutie. Ulož ju na bezpečné miesto.');
}
function downloadJson(data,filename){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function loadDemo(){
  try{
    const response=await fetch('./ukazkove-slovicka.json',{cache:'no-store'});
    if(!response.ok)throw new Error('Ukážkový súbor sa nepodarilo načítať.');
    const data=await response.json();const imported=readJson(JSON.stringify(data));
    const known=new Set(entries.map(entryKey));let count=0;
    for(const e of imported.entries){if(known.has(entryKey(e)))continue;await dbPut('entries',e);count++;}
    await reloadData();notify(`Pridaných ${count} ukážkových záznamov. Môžeš ich upravovať alebo zmazať.`);
  }catch(err){notify(err.message,true);}
}
async function handleFile(event){
  const file=event.target.files?.[0];if(!file)return;
  if(file.size>8*1024*1024){notify('Súbor je príliš veľký (max. 8 MB).',true);return;}
  try{$('jsonInput').value=await file.text();$('selectedFile').textContent=`Vybraný súbor: ${file.name}`;importPending=null;$('importPreview').classList.add('hidden');notify('Súbor bol načítaný. Teraz klikni na Skontrolovať import.');}
  catch(err){notify('Súbor sa nepodarilo prečítať: '+err.message,true);}
}
function bind(){
  document.querySelectorAll('.nav-link').forEach(btn=>btn.addEventListener('click',()=>{if(quiz){resetPractice();}switchPage(btn.dataset.page);}));
  document.querySelector('.brand').addEventListener('click',()=>switchPage('domov'));
  window.addEventListener('hashchange',()=>switchPage(location.hash.slice(1),false));
  $('refreshVersionBtn').addEventListener('click',refreshApp);
  $('startDuolingoHome').addEventListener('click',()=>{switchPage('ucenie');updateDuolingoPreview();});
  $('beginDuoBtn').addEventListener('click',startDuolingo);
  $('introContinueBtn').addEventListener('click',completeIntroduction);
  $('studyLesson').addEventListener('change',updateDuolingoPreview);
  ['quickAddBtn','libraryAddBtn','homeAddBtn'].forEach(id=>$(id).addEventListener('click',()=>showDialog()));
  $('homeDemoBtn').addEventListener('click',loadDemo);
  $('allEntriesBtn').addEventListener('click',()=>switchPage('slovnik'));
  $('openImportBtn').addEventListener('click',()=>switchPage('import'));
  $('startQuickBtn').addEventListener('click',()=>{resetPractice();switchPage('trening');renderQuizAvailability();});
  ['searchEntries','filterType','filterLevel','filterTopic'].forEach(id=>$(id).addEventListener('input',()=>{libraryVisible=LIBRARY_PAGE_SIZE;renderLibrary();}));
  $('filterLesson').addEventListener('change',()=>{libraryVisible=LIBRARY_PAGE_SIZE;renderLibraryTopics();renderLibrary();});
  $('loadMoreEntriesBtn').addEventListener('click',()=>{libraryVisible+=LIBRARY_PAGE_SIZE;renderLibrary();});
  ['practiceLesson','practiceSection','practiceKind','practiceScope','practiceCount','practiceAll'].forEach(id=>$(id).addEventListener('change',renderQuizAvailability));
  $('practiceCount').addEventListener('input',updatePracticeSummary);
  document.querySelectorAll('input[name="studyCategory"]').forEach(el=>el.addEventListener('change',()=>{ $('practiceKind').value='de_to_sk';renderQuizAvailability(); }));
  $('practiceAdvanced').addEventListener('change',()=>{if(!$('practiceAdvanced').checked)$('practiceKind').value='de_to_sk';renderQuizAvailability();});
  $('practiceTopic').addEventListener('change',updatePracticeSummary);
  document.querySelectorAll('[data-count]').forEach(btn=>btn.addEventListener('click',()=>{
    $('practiceAll').checked=false;$('practiceCount').value=btn.dataset.count;updatePracticeSummary();
  }));
  $('entryList').addEventListener('click',e=>{
    const edit=e.target.closest('[data-edit]');const del=e.target.closest('[data-delete]');
    if(edit)showDialog(edit.dataset.edit);else if(del)deleteEntry(del.dataset.delete);
  });
  $('fieldType').addEventListener('change',toggleFormFields);
  $('entryForm').addEventListener('submit',handleEntrySave);
  $('closeDialogBtn').addEventListener('click',()=>$('entryDialog').close());
  $('cancelDialogBtn').addEventListener('click',()=>$('entryDialog').close());
  $('beginPracticeBtn').addEventListener('click',startPractice);
  $('quitPracticeBtn').addEventListener('click',()=>{const s=quiz?.style;resetPractice();if(s==='duo')switchPage('ucenie');});
  $('checkAnswerBtn').addEventListener('click',checkTypedAnswer);
  $('choiceAnswers').addEventListener('click',event=>{
    const selected=event.target.closest('[data-choice-index]');
    if(selected)checkChoiceAnswer(Number(selected.dataset.choiceIndex));
  });
  $('matchAnswerBox').addEventListener('click',event=>{const l=event.target.closest('[data-match-left]'),r=event.target.closest('[data-match-right]');if(l)chooseMatch('left',Number(l.dataset.matchLeft));else if(r)chooseMatch('right',Number(r.dataset.matchRight));});
  $('builderBank').addEventListener('click',event=>{const b=event.target.closest('[data-token-id]');if(!b||b.disabled||quiz?.resolved)return;quiz.builderSelected.push(b.dataset.tokenId);renderBuilderSelected();});
  $('builderChosen').addEventListener('click',event=>{const b=event.target.closest('[data-undo-token]');if(!b||quiz?.resolved)return;quiz.builderSelected=quiz.builderSelected.filter(id=>id!==b.dataset.undoToken);renderBuilderSelected();});
  $('builderCheckBtn').addEventListener('click',checkBuilder);
  $('builderClearBtn').addEventListener('click',()=>{if(quiz&&!quiz.resolved){quiz.builderSelected=[];renderBuilderSelected();}});
  $('builderDontKnowBtn').addEventListener('click',dontKnow);
  $('dontKnowBtn').addEventListener('click',dontKnow);
  document.addEventListener('keydown',handlePracticeEnter);
  $('revealAnswerBtn').addEventListener('click',revealCard);
  $('gradeWrongBtn').addEventListener('click',()=>gradeCard(false));
  $('gradeCorrectBtn').addEventListener('click',()=>gradeCard(true));
  $('nextQuestionBtn').addEventListener('click',nextQuestion);
  $('practiceAgainBtn').addEventListener('click',()=>{const s=quiz?.style;resetPractice();if(s==='duo')startDuolingo();else startPractice();});
  $('practiceHomeBtn').addEventListener('click',()=>{resetPractice();switchPage('domov');});
  $('copyPromptBtn').addEventListener('click',()=>copyText(CHATGPT_PROMPT));
  $('jsonInput').addEventListener('input',()=>{importPending=null;$('importPreview').classList.add('hidden');});
  $('jsonFile').addEventListener('change',handleFile);
  $('previewImportBtn').addEventListener('click',previewImport);
  $('exportBtn').addEventListener('click',exportData);
  $('resetProgressBtn').addEventListener('click',()=>openResetDialog('progress'));
  $('resetAllBtn').addEventListener('click',()=>openResetDialog('all'));
  $('resetCancelBtn').addEventListener('click',closeResetDialog);
  $('resetConfirmInput').addEventListener('input',()=>{
    $('resetConfirmBtn').disabled=!resetKind||$('resetConfirmInput').value.trim().toUpperCase()!==resetTokens[resetKind];
  });
  $('resetConfirmBtn').addEventListener('click',confirmReset);
  $('resetDialog').addEventListener('close',()=>{resetKind=null;});


}
async function init(){
  bind();switchPage(location.hash.slice(1)||'domov',false);
  if(!('indexedDB' in window)){notify('Tento prehliadač nepodporuje IndexedDB. Použi aktuálny Chrome, Firefox alebo Edge.',true);return;}
  try{db=await idbOpen();await reloadData();updateGreeting();}
  catch(err){notify('Nedá sa otvoriť lokálna databáza: '+err.message,true);}
  if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost' || location.hostname==='127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
}
document.addEventListener('DOMContentLoaded',init);
window.addEventListener('focus',updateGreeting);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateGreeting();});
setInterval(updateGreeting,60000);

