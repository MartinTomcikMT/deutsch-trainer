/* Deutsch Trainer 1.5 – introduce, practice and review + progress tracking. */
'use strict';

const DB_NAME = 'deutsch-trainer-v1';
const DB_VERSION = 1;
const DATA_FORMAT = 'deutsch-trainer';
const APP_VERSION = '1.5.0';
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
  return new Promise((resolve,reject) => {
    const transaction = db.transaction(store,'readwrite');
    transaction.objectStore(store).put(data);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
function dbDelete(store,id) {
  return new Promise((resolve,reject) => {
    const transaction = db.transaction(store,'readwrite');
    transaction.objectStore(store).delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}
async function reloadData() {
  [entries,attempts] = await Promise.all([dbGetAll('entries'),dbGetAll('attempts')]);
  entries.sort((a,b) => String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  renderStats(); renderLessonOptions(); renderLibraryTopics(); renderLibrary(); renderCategories(); renderQuizAvailability(); updateDuolingoPreview();
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
const DUO_CORE_SIZE=40;
const DUO_TYPE_QUOTAS={noun:12,verb:12,phrase:10,other:6};
function duoCoreForLesson(key){
  const all=entries.filter(e=>lessonMatches(e,key));
  // Optional B material never blocks advancement. Text from A/C/D is preferred.
  const eligible=all.filter(e=>!(e.tags||[]).some(t=>/^Časť B\b/i.test(t)));
  const pool=eligible.length?eligible:all;
  const levelRank={A1:0,A2:1,B1:2,B2:3};
  const sorted=[...pool].sort((a,b)=>(levelRank[a.level]??3)-(levelRank[b.level]??3)||
    (a.de.length-b.de.length)||a.de.localeCompare(b.de,'de'));
  const selected=[];const used=new Set();
  for(const [type,limit] of Object.entries(DUO_TYPE_QUOTAS)){
    for(const e of sorted.filter(e=>e.type===type).slice(0,limit)){selected.push(e);used.add(e.id);}
  }
  for(const e of sorted){if(selected.length>=DUO_CORE_SIZE)break;if(!used.has(e.id)){selected.push(e);used.add(e.id);}}
  return selected.slice(0,DUO_CORE_SIZE);
}
function duoLessonProgress(key){
  const pool=duoCoreForLesson(key);
  const mastered=pool.filter(DeutschSRS.duoMastered).length;
  const introduced=pool.filter(DeutschSRS.hasStudied).length;
  return {total:pool.length,mastered,introduced,done:pool.length>0&&mastered===pool.length};
}
function duoLessonUnlocked(key){
  if(!/^lesson-\d+$/.test(key))return false;
  const n=Number(key.slice(7));
  if(n<1)return false;
  for(let i=1;i<n;i++)if(!duoLessonProgress('lesson-'+i).done)return false;
  return true;
}
function renderDuoLessonOptions(){
  const select=$('studyLesson');const previous=select.value;
  select.replaceChildren();
  for(let i=1;i<=8;i++){
    const key='lesson-'+i;const status=duoLessonProgress(key);
    const enabled=duoLessonUnlocked(key)&&status.total>0;
    const opt=document.createElement('option');opt.value=key;opt.disabled=!enabled;
    opt.textContent=lessonLabel(key)+(status.total?' ('+status.mastered+'/'+status.total+' zvládnutých)':' (zatiaľ nenahraté)')+(enabled?'':' 🔒');
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
    default:return {label:'PREKLAD DO NEMČINY',q:e.sk,context:e.type==='noun'?'Napíš nemecké slovo aj s členom.':'Napíš nemecký preklad.'};
  }
}
function renderQuestion(){
  quiz.resolved=false;
  const e=currentEntry(),task=currentTask();
  const q=promptFor(e,task.kind,task);
  $('practiceProgressLabel').textContent=`Otázka ${quiz.index+1} / ${quiz.tasks.length}${quiz.style==='duo'?' · opakovanie':''}`;
  $('progressBar').style.width=`${(quiz.index)/quiz.tasks.length*100}%`;
  $('questionType').textContent=q.label;$('questionPrompt').textContent=q.q;
  $('questionContext').textContent=q.context;$('questionContext').className='question-context';
  $('typedAnswerBox').classList.toggle('hidden',quiz.mode!=='type');
  $('flashcardAnswerBox').classList.toggle('hidden',quiz.mode!=='card');
  $('answerResult').className='answer-result hidden';
  $('nextQuestionBtn').classList.add('hidden');$('gradeButtons').classList.add('hidden');
  $('revealAnswerBtn').classList.remove('hidden');
  $('answerInput').value='';
  const grammarKinds=['perfect','preterite','article','plural','cloze','cloze_sk'];
  const firstGrammar=grammarKinds.includes(task.kind) && DeutschSRS.isNew(e,task.kind);
  const introduction=quiz.style==='duo' && quiz.introEnabled && (
    (quiz.newAtStart?.has(e.id)&&!quiz.previewedIds.has(e.id)) ||
    (firstGrammar&&!quiz.previewedIds.has(e.id+'::'+task.kind))
  );
  $('introPreview').classList.toggle('hidden',!introduction);
  $('questionCard').classList.toggle('hidden',introduction);
  if(introduction){
    if(firstGrammar){
      quiz.previewedIds.add(e.id+'::'+task.kind);
      $('introGerman').textContent=`${displayName(e)} · ${q.label.toLowerCase()}`;
      $('introSlovak').textContent=correctAnswer(e,task.kind,task);
      $('introExtra').textContent=`Nový typ úlohy. Pozri si tvar alebo chýbajúce slovo. Znamená to: ${e.sk}. Teraz ho ešte nemusíš vedieť spamäti.`;
      $('introExtra').classList.remove('hidden');
    }else{
      quiz.previewedIds.add(e.id);
      $('introGerman').textContent=displayName(e);
      $('introSlovak').textContent=e.sk;
      $('introExtra').textContent=e.type==='verb'?'Zatiaľ sa učíš iba význam slovesa. Minulé časy sa pridajú neskôr.':'';
      $('introExtra').classList.toggle('hidden',e.type!=='verb');
    }
    $('introExample').replaceChildren();
    if(e.exampleDe){const a=document.createElement('p');a.textContent=e.exampleDe;$('introExample').append(a);}
    if(e.exampleSk){const a=document.createElement('p');a.textContent=e.exampleSk;$('introExample').append(a);}
    $('introExample').classList.toggle('hidden',!e.exampleDe&&!e.exampleSk);
    $('practiceProgressLabel').textContent=`Zoznám sa so slovom · otázka ${quiz.index+1} / ${quiz.tasks.length}`;
  }else if(quiz.mode==='type')setTimeout(()=>$('answerInput').focus(),50);
}
function completeIntroduction(){
  if(!quiz||$('introPreview').classList.contains('hidden'))return;
  $('introPreview').classList.add('hidden');$('questionCard').classList.remove('hidden');
  if(quiz.mode==='type')$('answerInput').focus();
  $('practiceProgressLabel').textContent=`Otázka ${quiz.index+1} / ${quiz.tasks.length} · skús odpovedať`;
}
function normalizeAnswer(a,kind='sk_to_de'){
  let text=String(a||'').trim().toLocaleLowerCase(kind==='de_to_sk'?'sk-SK':'de-DE')
    .replace(/[.!?]+$/g,'').replace(/[„“”"']/g,'').replace(/\s+/g,' ');
  if(kind==='de_to_sk'||kind==='cloze_sk')text=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return text.trim();
}
function acceptableAnswers(e,kind,task=null){
  const base=correctAnswer(e,kind,task);
  const options=[base,...(kind==='de_to_sk'||kind==='sk_to_de'?(e.alternatives||[]):[])];
  if(kind==='de_to_sk' && e.type!=='phrase'){
    // Glossary entries may list independent Slovak meanings separated by comma, slash or semicolon.
    // For example „profesia, povolanie“ accepts just „povolanie“.
    for(const text of [...options]){
      options.push(...text.split(/\s*[,;/]\s*/).map(x=>x.trim()).filter(Boolean));
      options.push(text.replace(/\s*\([^)]*\)/g,'').trim());
    }
  }
  return [...new Set(options.map(x=>normalizeAnswer(x,kind)).filter(Boolean))];
}
function isCorrectAnswer(e,kind,value,task=null){
  return acceptableAnswers(e,kind,task).includes(normalizeAnswer(value,kind));
}
async function recordAttempt(isCorrect){
  if(quiz.resolved)return;
  quiz.resolved=true;
  const e=currentEntry();const task=currentTask();
  const r={...newReview(),...(e.review||{})};
  r.attempts++; if(isCorrect){r.correct++;r.streak++;quiz.good++;}else{r.wrong++;r.streak=0;}
  quiz.answered++;
  const now=new Date();r.lastReviewed=now.toISOString();
  const mode=DeutschSRS.apply(e,task.kind,isCorrect,now);
  r.dueAt=mode.dueAt;
  e.review=r;e.updatedAt=now.toISOString();
  const attempt={id:uid(),entryId:e.id,kind:task.kind,correct:!!isCorrect,createdAt:now.toISOString(),sessionType:quiz.style||'custom'};
  try{await dbPut('entries',e);await dbPut('attempts',attempt);attempts.push(attempt);renderStats();if(quiz.style==='duo')renderDuoLessonOptions();}
  catch(err){notify('Odpoveď sa nepodarilo uložiť: '+err.message,true);}
  if(quiz.style==='duo'&&!isCorrect&&!task.retryCount){
    quiz.tasks.splice(Math.min(quiz.tasks.length,quiz.index+3),0,{...task,retryCount:1});
  }
}
function showAnswerResult(correct){
  const e=currentEntry(),task=currentTask();const answer=correctAnswer(e,task.kind,task);
  const el=$('answerResult');el.className='answer-result'+(correct?'':' incorrect');
  el.innerHTML=`<span>${correct?'✓ Správne!':quiz.style==='duo'?'Zopakujeme si to ešte raz':'Správna odpoveď'}</span><strong>${escapeHtml(answer)}</strong>${e.exampleDe?`<p>${escapeHtml(e.exampleDe)}${e.exampleSk?' — '+escapeHtml(e.exampleSk):''}</p>`:''}${e.notes?`<p>${escapeHtml(e.notes)}</p>`:''}`;
  $('typedAnswerBox').classList.add('hidden');$('flashcardAnswerBox').classList.add('hidden');
  $('nextQuestionBtn').classList.remove('hidden');
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
function nextQuestion(){
  if(!quiz||!quiz.resolved)return;
  quiz.index++;
  if(quiz.index>=quiz.tasks.length){
    $('introPreview').classList.add('hidden');$('questionCard').classList.remove('hidden');
    $('practiceActive').classList.add('hidden');$('practiceFinished').classList.remove('hidden');
    $('practiceSummary').textContent=`Správne odpovede: ${quiz.good} z ${quiz.answered} (${Math.round(100*quiz.good/Math.max(quiz.answered,1))} %). Výsledky sa uložili do tvojej databázy.`;
    $('progressBar').style.width='100%';renderQuizAvailability();renderDuoLessonOptions();updateDuolingoPreview();
  }else renderQuestion();
}
function resetPractice(){
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
function studyCount(){return Number(document.querySelector('input[name="studyCount"]:checked')?.value)||10;}
function studyPlan(){return document.querySelector('input[name="studyPlan"]:checked')?.value||'mixed';}
function studyNewWords(){return Number($('studyNewWords').value)||3;}
// Duolingo always combines types; the difficulty adapts to actual learning progress.
function guidedOptions(){return {easy:true,reverse:true,cloze:true,grammar:true};}
function updateDuolingoPreview(){
  const lesson=$('studyLesson').value;
  const progress=duoLessonProgress(lesson);
  $('duoLessonTitle').textContent=lessonLabel(lesson);
  $('duoLessonNumbers').textContent=`${progress.mastered} / ${progress.total} zvládnutých`;
  $('duoLessonBar').style.width=(progress.total?100*progress.mastered/progress.total:0)+'%';
  $('duoLessonHint').textContent=progress.done?'Základný balík je hotový. Ak máš nahratú ďalšiu lekciu, odomkne sa automaticky.':
    `Na ďalšiu lekciu potrebuješ zvládnuť všetkých ${progress.total} základných výrazov. Zvládnutie = oba smery prekladu a správne odpovede aspoň v dvoch dňoch.`;
  const pool=studyPool(),plan=studyPlan();
  $('newWordsField').classList.toggle('hidden',plan==='review');
  $('studyPreview').closest('label').classList.toggle('hidden',plan==='review');
  const tasks=DeutschSRS.selectGuidedTasks(pool,studyCount(),plan,studyNewWords(),guidedOptions());
  const fresh=pool.filter(e=>!DeutschSRS.hasStudied(e)).length;
  const practiced=pool.length-fresh;
  const dueCount=pool.filter(e=>DeutschSRS.hasStudied(e)&&due(e)).length;
  const added=new Set(tasks.filter(t=>!DeutschSRS.hasStudied(pool.find(e=>e.id===t.entryId))).map(t=>t.entryId)).size;
  const byType=new Set(tasks.map(t=>pool.find(e=>e.id===t.entryId)?.type).filter(Boolean));
  $('duoDueCount').textContent=`Nových: ${fresh} · Preberaných: ${practiced} · Na opakovanie: ${dueCount}.`;
  const description=plan==='new'?`Najprv spoznáš ${added} nových výrazov rôznych druhov, potom ich preložíš.`:
    plan==='review'?'Vracajú sa preberané výrazy; pokročilejšie úlohy sa zapínajú až po osvojení významu.':
    `Zmiešaný tréning: ${added} nových výrazov + opakovanie; ${byType.size} druhy učiva podľa dostupných otázok.`;
  $('duoPreview').innerHTML=tasks.length?`<strong>${countLabel(tasks.length,'otázka','otázky','otázok')} · ${countLabel(added,'nový výraz','nové výrazy','nových výrazov')}</strong><br>${description}`:
    `<strong>${!pool.length?'Táto lekcia je zamknutá alebo ešte nie je nahratá.':plan==='review'?'Zatiaľ nemáš prebrané výrazy.':plan==='new'?'Už si prebral celý základný balík.':'Žiadne dostupné otázky.'}</strong><br>Skús iný plán alebo najprv pokračuj v aktuálnej lekcii.`;
  $('beginDuoBtn').disabled=!tasks.length||!duoLessonUnlocked(lesson);
}
function startDuolingo(){
  const lesson=$('studyLesson').value;
  if(!duoLessonUnlocked(lesson)){notify('Túto lekciu odomkneš dokončením predošlej lekcie.',true);return;}
  const pool=studyPool(),plan=studyPlan();
  const tasks=DeutschSRS.selectGuidedTasks(pool,studyCount(),plan,studyNewWords(),guidedOptions());
  if(!tasks.length){notify('Pre tento plán nie sú dostupné otázky. Skús Zmiešané učenie.',true);return;}
  const newAtStart=new Set(pool.filter(e=>!DeutschSRS.hasStudied(e)).map(e=>e.id));
  quiz={tasks,index:0,good:0,answered:0,mode:'type',resolved:false,style:'duo',
    plan,introEnabled:$('studyPreview').checked,previewedIds:new Set(),newAtStart};
  $('practiceSetup').classList.add('hidden');$('practiceFinished').classList.add('hidden');$('practiceActive').classList.remove('hidden');
  $('duoActiveHint').classList.remove('hidden');
  switchPage('trening');renderQuestion();
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

const CHATGPT_PROMPT=`Priprav mi import do webovej aplikácie Deutsch Trainer 1.5 z nasledujúcich nemeckých slovíčok a viet. Vráť IBA validný JSON, bez markdown bloku a bez vysvetlení. Štruktúra: {"format":"deutsch-trainer","version":1,"entries":[{"type":"verb","de":"gehen","sk":"ísť pešo","preterite":"ging","perfect":"ist gegangen","auxiliary":"sein","level":"A1","tags":["Pohyb"],"exampleDe":"Ich gehe nach Hause.","exampleSk":"Idem domov.","notes":""}]}. Povolené typy: verb, noun, phrase, other. Pri podstatných menách ulož základný tvar BEZ člena do "de" a člen zvlášť do "article" (der/die/das), množné číslo do "plural" (napr. "die Häuser"). Pri slovesách používaj Präteritum pre er/sie/es (napr. ging) a Perfekt pre er/sie/es (napr. ist gegangen). Nepíš vymyslené tvary, pri neistote nechaj voliteľné pole prázdne. Každá položka musí mať type, de, sk. Ak ide o učivo z lekcie, priraď každému záznamu rovnaké pole lesson, napríklad "Begegnungen A2+ – Lekcia 2"; toto pole je dôležité pre filtrovanie tréningu podľa lekcií. Ďalšie voliteľné polia: article, plural, preterite, perfect, auxiliary, exampleDe, exampleSk, notes, level, lesson, lessons, tags, alternatives. Text neprekladaj do angličtiny. Tu je môj zoznam:\n\n`;
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
  return {entries:normalized,history,keepProgress};
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
    }
    importPending=null;$('jsonInput').value='';$('jsonFile').value='';$('selectedFile').textContent='';
    $('importPreview').classList.add('hidden');
    await reloadData();notify(`Import dokončený: ${added} nových, ${updated} doplnených, ${unchanged} bez zmeny.`);
  }catch(err){notify('Import sa nepodarilo dokončiť: '+err.message,true);if(button)button.disabled=false;}
}
function exportData(){
  const payload={format:DATA_FORMAT,version:DATA_VERSION,backup:true,exportedAt:new Date().toISOString(),entries,attempts};
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
  document.querySelectorAll('input[name="studyPlan"]').forEach(el=>el.addEventListener('change',updateDuolingoPreview));
  $('studyNewWords').addEventListener('change',updateDuolingoPreview);
  $('studyPreview').addEventListener('change',updateDuolingoPreview);
  $('studyLesson').addEventListener('change',updateDuolingoPreview);
  document.querySelectorAll('input[name="studyCount"]').forEach(i=>i.addEventListener('change',updateDuolingoPreview));
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
  $('dontKnowBtn').addEventListener('click',dontKnow);
  $('answerInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();checkTypedAnswer();}});
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
}
async function init(){
  bind();switchPage(location.hash.slice(1)||'domov',false);
  if(!('indexedDB' in window)){notify('Tento prehliadač nepodporuje IndexedDB. Použi aktuálny Chrome, Firefox alebo Edge.',true);return;}
  try{db=await idbOpen();await reloadData();}
  catch(err){notify('Nedá sa otvoriť lokálna databáza: '+err.message,true);}
  if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost' || location.hostname==='127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
}
document.addEventListener('DOMContentLoaded',init);
