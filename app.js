/* Deutsch Trainer 1.0 – all study content stays on your device. No API keys or external database. */
'use strict';

const DB_NAME = 'deutsch-trainer-v1';
const DB_VERSION = 1;
const DATA_FORMAT = 'deutsch-trainer';
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
  renderStats(); renderLibrary(); renderCategories(); renderQuizAvailability();
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
    lesson:val(raw.lesson,100),notes:val(raw.notes,1500),tags:cleanTags(raw.tags),
    alternatives:Array.isArray(raw.alternatives)?raw.alternatives.map(t=>val(t,250)).filter(Boolean).slice(0,20):[],
    createdAt:keepProgress && typeof raw.createdAt==='string' ? raw.createdAt : now,
    updatedAt:now,review:newReview()
  };
  if(keepProgress && raw.review && typeof raw.review==='object') {
    const r=raw.review;
    item.review={attempts:Math.max(0,Number(r.attempts)||0),correct:Math.max(0,Number(r.correct)||0),
      wrong:Math.max(0,Number(r.wrong)||0),streak:Math.max(0,Number(r.streak)||0),
      lastReviewed:typeof r.lastReviewed==='string'?r.lastReviewed:null,
      dueAt:typeof r.dueAt==='string'?r.dueAt:null};
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
  if(changed)merged.updatedAt=new Date().toISOString();
  return {merged,changed};
}
function switchPage(page,updateHash=true){
  if(!['domov','slovnik','trening','import'].includes(page))page='domov';
  document.querySelectorAll('.page').forEach(e=>e.classList.toggle('active',e.id==='page-'+page));
  document.querySelectorAll('.nav-link').forEach(e=>e.classList.toggle('active',e.dataset.page===page));
  $('breadcrumb').innerHTML=`Osobná učebnica <span>/</span> ${escapeHtml({domov:'Prehľad',slovnik:'Môj slovník',trening:'Precvičovanie',import:'Import a zálohy'}[page])}`;
  if(updateHash && location.hash!==`#${page}`)history.replaceState(null,'',`#${page}`);
  window.scrollTo({top:0,behavior:'auto'});
}
function due(entry){const d=entry.review?.dueAt;return !d || new Date(d).getTime()<=Date.now();}
function renderStats(){
  $('statEntries').textContent=entries.length;
  $('statDue').textContent=entries.filter(due).length;
  $('statAccuracy').textContent=attempts.length ? `${Math.round(attempts.filter(a=>a.correct).length/attempts.length*100)} %` : '—';
  $('homeEmpty').hidden=entries.length>0;
}
function renderCategories(){
  const kinds=[['verb','↝','Slovesá'],['noun','▥','Podstatné mená'],['phrase','❞','Frázy a vety'],['other','✳','Ostatné']];
  $('homeCategories').innerHTML=kinds.map(([key,icon,label])=>`<div class="category-box"><span class="category-symbol">${icon}</span><strong>${entries.filter(x=>x.type===key).length}</strong><p>${label}</p></div>`).join('');
}
function displayName(e){return e.type==='noun' && e.article?`${e.article} ${e.de}`:e.de;}
function renderLibrary(){
  const term=$('searchEntries').value.toLocaleLowerCase('de-DE').trim();
  const type=$('filterType').value, level=$('filterLevel').value;
  const list=entries.filter(e=>(type==='all'||type===e.type)&&(level==='all'||level===e.level)&&(!term||[displayName(e),e.sk,e.preterite,e.perfect,...(e.tags||[])].join(' ').toLocaleLowerCase('de-DE').includes(term)));
  $('libraryCount').textContent=`${list.length} z ${entries.length} záznamov`;
  $('entryList').innerHTML=list.length?list.map(e=>`<article class="entry-card"><div class="entry-main"><div class="entry-top"><span class="type-label">${escapeHtml(typeLabels[e.type])}</span><span class="level-label">${escapeHtml(e.level)}</span>${(e.tags||[]).slice(0,2).map(t=>`<span class="level-label">${escapeHtml(t)}</span>`).join('')}</div><div class="entry-name">${escapeHtml(displayName(e))}</div><div class="entry-translation">${escapeHtml(e.sk)}</div>${e.type==='verb'&&(e.preterite||e.perfect)?`<div class="entry-extra">Präteritum: ${escapeHtml(e.preterite||'—')} &nbsp; · &nbsp; Perfekt: ${escapeHtml(e.perfect||'—')}</div>`:''}${e.type==='noun'&&e.plural?`<div class="entry-extra">Množné číslo: ${escapeHtml(e.plural)}</div>`:''}${e.exampleDe?`<div class="entry-extra">${escapeHtml(e.exampleDe)}</div>`:''}</div><div class="entry-actions"><button class="icon-button" data-edit="${escapeHtml(e.id)}">Upraviť</button><button class="icon-button danger" data-delete="${escapeHtml(e.id)}">Zmazať</button></div></article>`).join('') : `<div class="empty-state"><div class="empty-illustration">▤</div><strong>Žiadne záznamy</strong><p>${entries.length?'Skús upraviť filtre alebo vyhľadávanie.':'Zatiaľ tu nič nie je. Pridaj prvé slovo alebo načítaj ukážky.'}</p></div>`;
}
function renderQuizAvailability(){
  const tasks=buildTasks(entries,'mix');
  $('quizAvailable').textContent=`Dostupných otázok: ${tasks.length}`;
}
function showDialog(id){
  const e=id?entries.find(x=>x.id===id):null;
  $('entryForm').reset();$('entryId').value=e?.id||'';
  $('dialogHeading').textContent=e?'Upraviť záznam':'Nový záznam';
  const mapping={fieldType:'type',fieldDe:'de',fieldSk:'sk',fieldArticle:'article',fieldPlural:'plural',fieldPreterite:'preterite',fieldPerfect:'perfect',fieldAux:'auxiliary',fieldLevel:'level',fieldTags:'tags',fieldExampleDe:'exampleDe',fieldExampleSk:'exampleSk',fieldNotes:'notes'};
  Object.entries(mapping).forEach(([id,key])=>{if(e)$(id).value=key==='tags'?(e.tags||[]).join(', '):e[key]||((key==='level')?'A1':'');});
  if(!e){$('fieldType').value='verb';$('fieldLevel').value='A1';}
  toggleFormFields();$('entryDialog').showModal();
  setTimeout(()=>$('fieldDe').focus(),30);
}
function toggleFormFields(){const t=$('fieldType').value;$('nounFields').classList.toggle('hidden',t!=='noun');$('verbFields').classList.toggle('hidden',t!=='verb');}
async function handleEntrySave(event){
  event.preventDefault();
  const id=$('entryId').value;
  const record={type:$('fieldType').value,de:$('fieldDe').value,sk:$('fieldSk').value,article:$('fieldArticle').value,plural:$('fieldPlural').value,
    preterite:$('fieldPreterite').value,perfect:$('fieldPerfect').value,auxiliary:$('fieldAux').value,level:$('fieldLevel').value,
    tags:$('fieldTags').value,exampleDe:$('fieldExampleDe').value,exampleSk:$('fieldExampleSk').value,notes:$('fieldNotes').value};
  try {
    const old=entries.find(e=>e.id===id);
    const e=normalizeEntry(record);
    const duplicate=entries.find(x=>entryKey(x)===entryKey(e)&&x.id!==id);
    if(duplicate){notify('Takýto záznam už v slovníku existuje.',true);return;}
    if(old){e.id=old.id;e.createdAt=old.createdAt;e.review=old.review;e.alternatives=old.alternatives||[];}
    await dbPut('entries',e);$('entryDialog').close();await reloadData();notify(old?'Záznam bol upravený.':'Záznam bol uložený.');
  }catch(error){notify(error.message||'Záznam sa nepodarilo uložiť.',true);}
}
async function deleteEntry(id){
  const e=entries.find(x=>x.id===id);if(!e)return;
  if(!confirm(`Naozaj zmazať „${displayName(e)}“? Túto akciu nemožno vrátiť späť.`))return;
  try{await dbDelete('entries',id);await reloadData();notify('Záznam bol zmazaný.');}catch(err){notify('Mazanie zlyhalo: '+err.message,true);}
}
function correctAnswer(e,kind){
  switch(kind){case 'article':return e.article;case 'plural':return e.plural;case 'preterite':return e.preterite;case 'perfect':return e.perfect;default:return displayName(e);}
}
function buildTasks(list,kind){
  const tasks=[];
  for(const e of list){
    if(kind==='mix'||kind==='translation')tasks.push({entryId:e.id,kind:'translation'});
    if(e.type==='noun' && e.article && (kind==='mix'||kind==='article'))tasks.push({entryId:e.id,kind:'article'});
    if(e.type==='noun' && e.plural && (kind==='mix'||kind==='plural'))tasks.push({entryId:e.id,kind:'plural'});
    if(e.type==='verb' && e.preterite && (kind==='mix'||kind==='preterite'))tasks.push({entryId:e.id,kind:'preterite'});
    if(e.type==='verb' && e.perfect && (kind==='mix'||kind==='perfect'))tasks.push({entryId:e.id,kind:'perfect'});
  }
  return tasks;
}
function shuffle(a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;}
function startPractice(){
  const kind=$('practiceKind').value,scope=$('practiceScope').value;
  let source=entries;
  if(scope==='due')source=entries.filter(due);
  if(scope==='wrong')source=[...entries].filter(x=>x.review?.wrong>0).sort((a,b)=>((b.review.wrong||0)-(a.review.wrong||0)));
  let tasks=buildTasks(source,kind);
  if(scope!=='wrong')tasks=shuffle(tasks);
  const count=Number($('practiceCount').value)||10;
  tasks=tasks.slice(0,count);
  if(!tasks.length){notify('Pre zvolené nastavenie nie sú dostupné žiadne otázky. Skús iný typ alebo pridaj slovíčka.',true);return;}
  quiz={tasks,index:0,good:0,answered:0,mode:$('practiceMode').value,resolved:false};
  $('practiceSetup').classList.add('hidden');$('practiceFinished').classList.add('hidden');$('practiceActive').classList.remove('hidden');
  renderQuestion();
}
function currentTask(){return quiz.tasks[quiz.index];}
function currentEntry(){return entries.find(e=>e.id===currentTask().entryId);}
function promptFor(e,kind){
  switch(kind){
    case 'article':return {label:'SPRÁVNY ČLEN',q:`Aký člen má slovo „${e.de}“?`,context:'Napíš der, die alebo das.'};
    case 'plural':return {label:'MNOŽNÉ ČÍSLO',q:`Aké je množné číslo slova „${displayName(e)}“?`,context:'Napíš množné číslo aj s členom, napríklad die Bücher.'};
    case 'preterite':return {label:'PRÄTERITUM',q:`er/sie/es ______ · ${e.de}`,context:`Doplň tvar Präteritum slovesa „${e.de}“ (${e.sk}).`};
    case 'perfect':return {label:'PERFEKT',q:`er/sie/es ______ · ${e.de}`,context:`Napíš pomocné sloveso a Partizip II (${e.sk}). Príklad: ist gegangen.`};
    default:return {label:'PREKLAD DO NEMČINY',q:e.sk,context:e.type==='noun'?'Napíš nemecký výraz aj s členom.':'Napíš nemecký preklad.'};
  }
}
function renderQuestion(){
  quiz.resolved=false;
  const e=currentEntry(),task=currentTask();
  const q=promptFor(e,task.kind);
  $('practiceProgressLabel').textContent=`Otázka ${quiz.index+1} / ${quiz.tasks.length}`;
  $('progressBar').style.width=`${(quiz.index)/quiz.tasks.length*100}%`;
  $('questionType').textContent=q.label;$('questionPrompt').textContent=q.q;
  $('questionContext').textContent=q.context;$('questionContext').className='question-context';
  $('typedAnswerBox').classList.toggle('hidden',quiz.mode!=='type');
  $('flashcardAnswerBox').classList.toggle('hidden',quiz.mode!=='card');
  $('answerResult').className='answer-result hidden';
  $('nextQuestionBtn').classList.add('hidden');$('gradeButtons').classList.add('hidden');
  $('revealAnswerBtn').classList.remove('hidden');
  $('answerInput').value='';
  if(quiz.mode==='type')setTimeout(()=>$('answerInput').focus(),50);
}
function normalizeAnswer(a){return String(a||'').trim().toLocaleLowerCase('de-DE').replace(/[.!?]+$/,'').replace(/\s+/g,' ');}
function isCorrectAnswer(e,kind,value){
  const possibles=[correctAnswer(e,kind)];
  if(kind==='translation')possibles.push(...(e.alternatives||[]));
  return possibles.some(p=>normalizeAnswer(p)===normalizeAnswer(value));
}
async function recordAttempt(isCorrect){
  if(quiz.resolved)return;
  quiz.resolved=true;
  const e=currentEntry();const task=currentTask();
  const r={...newReview(),...(e.review||{})};
  r.attempts++; if(isCorrect){r.correct++;r.streak++;quiz.good++;}else{r.wrong++;r.streak=0;}
  quiz.answered++;
  const now=new Date();r.lastReviewed=now.toISOString();
  const days=Math.min(60,[1,2,4,7,14,30,60][Math.min(r.streak-1,6)]||1);
  r.dueAt=new Date(now.getTime()+(isCorrect?days*24*60*60*1000:10*60*1000)).toISOString();
  e.review=r;e.updatedAt=now.toISOString();
  const attempt={id:uid(),entryId:e.id,kind:task.kind,correct:!!isCorrect,createdAt:now.toISOString()};
  try{await dbPut('entries',e);await dbPut('attempts',attempt);attempts.push(attempt);renderStats();}
  catch(err){notify('Odpoveď sa nepodarilo uložiť: '+err.message,true);}
}
function showAnswerResult(correct){
  const e=currentEntry(),task=currentTask();const answer=correctAnswer(e,task.kind);
  const el=$('answerResult');el.className='answer-result'+(correct?'':' incorrect');
  el.innerHTML=`<span>${correct?'✓ Správne!':'Správna odpoveď'}</span><strong>${escapeHtml(answer)}</strong>${e.exampleDe?`<p>${escapeHtml(e.exampleDe)}</p>`:''}${e.notes?`<p>${escapeHtml(e.notes)}</p>`:''}`;
  $('typedAnswerBox').classList.add('hidden');$('flashcardAnswerBox').classList.add('hidden');
  $('nextQuestionBtn').classList.remove('hidden');
}
async function checkTypedAnswer(){
  if(!quiz || quiz.resolved)return;
  const typed=$('answerInput').value;
  if(!typed.trim()){notify('Najprv napíš svoju odpoveď.',true);return;}
  const correct=isCorrectAnswer(currentEntry(),currentTask().kind,typed);
  await recordAttempt(correct);showAnswerResult(correct);
}
function revealCard(){
  if(!quiz || quiz.resolved)return;
  const e=currentEntry(),task=currentTask();
  $('answerResult').className='answer-result';
  $('answerResult').innerHTML=`<span>Správna odpoveď</span><strong>${escapeHtml(correctAnswer(e,task.kind))}</strong>${e.exampleDe?`<p>${escapeHtml(e.exampleDe)}</p>`:''}`;
  $('revealAnswerBtn').classList.add('hidden');$('gradeButtons').classList.remove('hidden');
}
async function gradeCard(correct){if(!quiz||quiz.resolved)return;await recordAttempt(correct);$('gradeButtons').classList.add('hidden');$('nextQuestionBtn').classList.remove('hidden');}
function nextQuestion(){
  if(!quiz||!quiz.resolved)return;
  quiz.index++;
  if(quiz.index>=quiz.tasks.length){
    $('practiceActive').classList.add('hidden');$('practiceFinished').classList.remove('hidden');
    $('practiceSummary').textContent=`Správne odpovede: ${quiz.good} z ${quiz.answered} (${Math.round(100*quiz.good/Math.max(quiz.answered,1))} %). Výsledky sa uložili do tvojej databázy.`;
    $('progressBar').style.width='100%';renderQuizAvailability();
  }else renderQuestion();
}
function resetPractice(){quiz=null;$('practiceActive').classList.add('hidden');$('practiceFinished').classList.add('hidden');$('practiceSetup').classList.remove('hidden');}
const CHATGPT_PROMPT=`Priprav mi import do webovej aplikácie Deutsch Trainer 1.0 z nasledujúcich nemeckých slovíčok a viet. Vráť IBA validný JSON, bez markdown bloku a bez vysvetlení. Štruktúra: {"format":"deutsch-trainer","version":1,"entries":[{"type":"verb","de":"gehen","sk":"ísť pešo","preterite":"ging","perfect":"ist gegangen","auxiliary":"sein","level":"A1","tags":["Pohyb"],"exampleDe":"Ich gehe nach Hause.","exampleSk":"Idem domov.","notes":""}]}. Povolené typy: verb, noun, phrase, other. Pri podstatných menách ulož základný tvar BEZ člena do "de" a člen zvlášť do "article" (der/die/das), množné číslo do "plural" (napr. "die Häuser"). Pri slovesách používaj Präteritum pre er/sie/es (napr. ging) a Perfekt pre er/sie/es (napr. ist gegangen). Nepíš vymyslené tvary, pri neistote nechaj voliteľné pole prázdne. Každá položka musí mať type, de, sk. Ďalšie voliteľné polia: article, plural, preterite, perfect, auxiliary, exampleDe, exampleSk, notes, level, lesson, tags, alternatives. Text neprekladaj do angličtiny. Tu je môj zoznam:\n\n`;
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
  document.querySelectorAll('.nav-link').forEach(btn=>btn.addEventListener('click',()=>switchPage(btn.dataset.page)));
  document.querySelector('.brand').addEventListener('click',()=>switchPage('domov'));
  window.addEventListener('hashchange',()=>switchPage(location.hash.slice(1),false));
  ['quickAddBtn','libraryAddBtn','homeAddBtn'].forEach(id=>$(id).addEventListener('click',()=>showDialog()));
  $('homeDemoBtn').addEventListener('click',loadDemo);
  $('allEntriesBtn').addEventListener('click',()=>switchPage('slovnik'));
  $('openImportBtn').addEventListener('click',()=>switchPage('import'));
  $('startQuickBtn').addEventListener('click',()=>{switchPage('trening');startPractice();});
  ['searchEntries','filterType','filterLevel'].forEach(id=>$(id).addEventListener('input',renderLibrary));
  $('entryList').addEventListener('click',e=>{
    const edit=e.target.closest('[data-edit]');const del=e.target.closest('[data-delete]');
    if(edit)showDialog(edit.dataset.edit);else if(del)deleteEntry(del.dataset.delete);
  });
  $('fieldType').addEventListener('change',toggleFormFields);
  $('entryForm').addEventListener('submit',handleEntrySave);
  $('closeDialogBtn').addEventListener('click',()=>$('entryDialog').close());
  $('cancelDialogBtn').addEventListener('click',()=>$('entryDialog').close());
  $('beginPracticeBtn').addEventListener('click',startPractice);
  $('quitPracticeBtn').addEventListener('click',resetPractice);
  $('checkAnswerBtn').addEventListener('click',checkTypedAnswer);
  $('answerInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();checkTypedAnswer();}});
  $('revealAnswerBtn').addEventListener('click',revealCard);
  $('gradeWrongBtn').addEventListener('click',()=>gradeCard(false));
  $('gradeCorrectBtn').addEventListener('click',()=>gradeCard(true));
  $('nextQuestionBtn').addEventListener('click',nextQuestion);
  $('practiceAgainBtn').addEventListener('click',()=>{resetPractice();startPractice();});
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
