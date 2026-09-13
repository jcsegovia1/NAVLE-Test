const APP_KEY = "navle-study-lab-v1";
const app = document.getElementById("app");
const loadingTemplate = document.getElementById("loadingTemplate");
let meta = null;
let currentSession = null;
const cache = new Map();

function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function pct(n,d){return d ? Math.round((n/d)*100) : 0}
function pctPrecise(n,d){
  if(!d)return "0";
  const value=(n/d)*100;
  if(value===0)return "0";
  if(value<1)return value.toFixed(2).replace(/0+$/,"").replace(/\.$/,"");
  if(value<10)return value.toFixed(1).replace(/\.0$/,"");
  return Math.round(value).toString();
}
function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function defaultProgress(){return {version:2,questions:{},sessions:0}}
function sectionForQuestionId(id){
  const n=Number(String(id).replace(/\D/g,""));
  return meta?.sections.find(s=>n>=s.idMin&&n<=s.idMax)?.section || null;
}
function normalizeProgress(p){
  if(!p||typeof p!=="object")p=defaultProgress();
  p.questions ||= {}; p.sessions ||= 0; p.version=2;
  let changed=false;
  for(const [id,s] of Object.entries(p.questions)){
    if(typeof s!=="object"||!s){p.questions[id]={attempts:0,correct:0,misses:0,completed:false};changed=true;continue}
    if(s.completed===undefined){s.completed=(s.correct||0)>0;changed=true}
    if(s.misses===undefined){s.misses=Math.max(0,(s.attempts||0)-(s.correct||0));changed=true}
    if(!s.section&&meta){s.section=sectionForQuestionId(id);changed=true}
  }
  if(changed)saveProgress(p);
  return p;
}
function loadProgress(){
  try{return normalizeProgress(JSON.parse(localStorage.getItem(APP_KEY))||defaultProgress())}
  catch{return defaultProgress()}
}
function saveProgress(p){localStorage.setItem(APP_KEY,JSON.stringify(p))}
function isCompleted(id,progress=loadProgress()){return !!progress.questions[id]?.completed}
function recordAttempt(q,correct,{preserveCompletion=false}={}){
  const p=loadProgress();
  const s=p.questions[q.id] || {attempts:0,correct:0,misses:0,completed:false,section:q.section};
  s.attempts=(s.attempts||0)+1;
  s.correct=(s.correct||0)+(correct?1:0);
  s.misses=(s.misses||0)+(correct?0:1);
  s.last=correct;
  s.section=q.section;
  if(correct)s.completed=true;
  else if(!preserveCompletion && !s.completed)s.completed=false;
  s.lastSeen=Date.now();
  p.questions[q.id]=s;
  saveProgress(p);
}
function sectionProgress(section,progress=loadProgress()){
  let completed=0,attempted=0;
  for(const [id,s] of Object.entries(progress.questions)){
    const sec=s.section||sectionForQuestionId(id);
    if(sec!==section.section)continue;
    if((s.attempts||0)>0)attempted++;
    if(s.completed)completed++;
  }
  completed=Math.min(completed,section.count);
  return {completed,remaining:Math.max(0,section.count-completed),attempted};
}
function globalProgress(progress=loadProgress()){
  const completed=meta.sections.reduce((n,s)=>n+sectionProgress(s,progress).completed,0);
  return {completed,remaining:Math.max(0,meta.total-completed)};
}
function showLoading(){app.innerHTML="";app.appendChild(loadingTemplate.content.cloneNode(true))}
async function init(){
  showLoading();
  meta=await fetch("data/index.json?v=2").then(r=>r.json());
  normalizeProgress(loadProgress());
  renderDashboard();
}
async function getSection(slug){
  if(cache.has(slug))return cache.get(slug);
  const data=await fetch(`data/${slug}.json`).then(r=>r.json());
  cache.set(slug,data);return data;
}

function renderDashboard(){
  currentSession=null;
  const progress=loadProgress();
  const overall=globalProgress(progress);
  app.innerHTML=`
    <section class="hero">
      <div>
        <div class="eyebrow">Rigorous NAVLE review</div>
        <h1>good luck <3</h1>
        <p class="lede">Work through the full ${meta.total.toLocaleString()}-question bank once. Every correct answer clears that question from your active pool; missed questions stay in rotation until you get them right.</p>
      </div>
      <aside class="hero-stat">
        <div class="big">${overall.remaining.toLocaleString()}</div>
        <p>questions remaining · ${overall.completed.toLocaleString()} completed</p>
        <div class="hero-progress"><span style="width:${(overall.completed/meta.total)*100}%"></span></div>
        <small>${pctPrecise(overall.completed,meta.total)}% overall complete · ${overall.completed.toLocaleString()} / ${meta.total.toLocaleString()}</small>
      </aside>
    </section>
    <section class="controls">
      <div class="field"><label>Question pool</label>
        <select id="poolSelect"><option value="mixed">Mixed NAVLE (weighted)</option>${meta.sections.map(s=>{const sp=sectionProgress(s,progress);return `<option value="${s.slug}" ${sp.remaining===0?"disabled":""}>${esc(s.label)} · ${sp.remaining} remaining</option>`}).join("")}</select>
      </div>
      <div class="field"><label>Mode</label><select id="modeSelect"><option value="study">Study · instant feedback</option><option value="exam">Exam · grade at end</option></select></div>
      <div class="field"><label>Questions</label><select id="sizeSelect"><option>20</option><option selected>50</option><option>100</option><option>200</option></select></div>
      <button class="primary-btn" id="startBtn" ${overall.remaining===0?"disabled":""}>${overall.remaining===0?"Bank complete":"Start session"}</button>
    </section>
    <div class="section-heading"><div><div class="eyebrow">Question bank</div><h2>Study by section</h2></div><p>${meta.sections.length} sections</p></div>
    <section class="grid">
      ${meta.sections.map(s=>{
        const sp=sectionProgress(s,progress), done=sp.remaining===0;
        return `<button class="category-card ${done?"complete-card":""}" data-slug="${s.slug}">
          <div class="card-top"><span class="count">${s.count.toLocaleString()} questions</span>${done?'<span class="complete-chip">Complete ✓</span>':""}</div>
          <h3>${esc(s.label)}</h3>
          <div class="mini-progress" aria-label="${pct(sp.completed,s.count)}% complete"><span style="width:${pct(sp.completed,s.count)}%"></span></div>
          <div class="progress-numbers"><strong>${sp.remaining.toLocaleString()} remaining</strong><span>${sp.completed.toLocaleString()} completed</span></div>
          <div class="card-footer"><span>${done?"Section cleared":`${pct(sp.completed,s.count)}% complete`}</span><span>${done?"Review →":"Open →"}</span></div>
        </button>`
      }).join("")}
    </section>`;
  const start=document.getElementById("startBtn"); if(start)start.onclick=()=>startConfiguredSession();
  document.querySelectorAll(".category-card").forEach(btn=>btn.onclick=()=>openSection(btn.dataset.slug));
}

async function activeQuestionsForSection(sectionMeta,progress=loadProgress()){
  const data=await getSection(sectionMeta.slug);
  return data.questions.filter(q=>!isCompleted(q.id,progress));
}
async function openSection(slug){
  const s=meta.sections.find(x=>x.slug===slug);
  const sp=sectionProgress(s);
  if(sp.remaining===0){renderCompletedSection(s);return}
  document.getElementById("poolSelect").value=slug;
  startConfiguredSession();
}
async function buildMixed(size){
  const progress=loadProgress();
  const weighted=meta.sections.filter(s=>s.weight>0);
  const pools=[];
  for(const s of weighted){
    const active=await activeQuestionsForSection(s,progress);
    if(active.length)pools.push({...s,active});
  }
  const available=pools.reduce((n,s)=>n+s.active.length,0);
  size=Math.min(size,available);
  if(!size)return [];
  const totalWeight=pools.reduce((a,s)=>a+s.weight,0);
  const plan=pools.map(s=>{const exact=size*s.weight/totalWeight;return {...s,take:Math.min(s.active.length,Math.floor(exact)),frac:exact-Math.floor(exact)}});
  let left=size-plan.reduce((n,s)=>n+s.take,0);
  while(left>0){
    let candidates=plan.filter(s=>s.take<s.active.length).sort((a,b)=>(b.frac-a.frac)||(b.weight-a.weight));
    if(!candidates.length)break;
    for(const s of candidates){if(left<=0)break;s.take++;left--}
  }
  const picked=[];
  for(const s of plan)if(s.take)picked.push(...shuffle(s.active).slice(0,s.take));
  return shuffle(picked).slice(0,size);
}
async function startConfiguredSession(){
  const pool=document.getElementById("poolSelect").value;
  const mode=document.getElementById("modeSelect").value;
  const requested=Number(document.getElementById("sizeSelect").value);
  showLoading();
  let qs,label,poolSlug=pool;
  if(pool==="mixed"){qs=await buildMixed(requested);label="Mixed NAVLE"}
  else{
    const sm=meta.sections.find(s=>s.slug===pool), data=await getSection(pool);
    const active=data.questions.filter(q=>!isCompleted(q.id));
    label=data.label; qs=shuffle(active).slice(0,Math.min(requested,active.length));
  }
  if(!qs.length){renderNoQuestions(label,poolSlug);return}
  currentSession={questions:qs,index:0,answers:Array(qs.length).fill(null),mode,label,poolSlug,round:1,retry:false,reviewOnly:false};
  renderQuestion();
}
function renderNoQuestions(label,poolSlug){
  app.innerHTML=`<section class="result-card complete-result"><div class="complete-icon">✓</div><div class="eyebrow">Section complete</div><h2>${esc(label)}</h2><p class="lede">Every question in this pool has been answered correctly at least once.</p><div class="result-actions"><button class="primary-btn" id="dashBtn">Dashboard</button></div></section>`;
  document.getElementById("dashBtn").onclick=renderDashboard;
}
function renderQuestion(){
  const s=currentSession,q=s.questions[s.index],chosen=s.answers[s.index];
  const answered=chosen!==null;
  const reveal=s.mode==="study"&&answered;
  const progress=pct(s.index+1,s.questions.length);
  const modeLabel=s.retry?`Retry round ${s.round} · ${s.mode==="study"?"Study mode":"Exam mode"}`:(s.reviewOnly?"Completed review":(s.mode==="study"?"Study mode":"Exam mode"));
  app.innerHTML=`
    <section class="quiz-head">
      <div class="quiz-title"><div class="eyebrow">${esc(modeLabel)}</div><h2>${esc(s.label)}</h2><p>${s.questions.length} questions${s.retry?" · missed questions only":" · correct answers leave the active pool"}</p></div>
      <div class="progress-wrap"><small>Question ${s.index+1} of ${s.questions.length}</small><div class="progress-bar"><span style="width:${progress}%"></span></div></div>
    </section>
    <article class="question-card">
      <div class="question-meta"><span class="badge">${esc(q.section.replace(/\s*\([^)]*\)\s*$/,"") )}</span><span class="badge">${esc(q.target)}</span><span class="badge">Source row ${q.sourceRow}</span></div>
      <h3 class="question-text">${esc(q.question)}</h3>
      <div class="choices">${q.choices.map((choice,i)=>{
        let cls="choice";if(chosen===i)cls+=" selected";if(reveal&&i===q.answerIndex)cls+=" correct";if(reveal&&chosen===i&&chosen!==q.answerIndex)cls+=" wrong";
        return `<button class="${cls}" data-i="${i}" ${reveal?"disabled":""}><span class="choice-letter">${"ABCD"[i]}</span><span>${esc(choice)}</span></button>`
      }).join("")}</div>
      ${reveal?`<div class="feedback ${chosen===q.answerIndex?"good":"bad"}"><strong>${chosen===q.answerIndex?"Correct — cleared":"Not yet cleared"}</strong><p>${chosen===q.answerIndex?"This question is now removed from normal future sessions.":`Correct answer: ${"ABCD"[q.answerIndex]}. ${esc(q.answer)} This question will return in the retry round.`}</p></div>`:""}
      <div class="quiz-actions"><button class="secondary-btn" id="quitBtn">Exit</button><div class="quiz-actions-right">${s.mode==="exam"&&s.index>0?'<button class="secondary-btn" id="prevBtn">Previous</button>':""}<button class="primary-btn" id="nextBtn" ${chosen===null?"disabled":""}>${s.index===s.questions.length-1?(s.mode==="exam"?"Submit":"Finish"):"Next"}</button></div></div>
    </article>`;
  document.querySelectorAll(".choice").forEach(btn=>btn.onclick=()=>chooseAnswer(Number(btn.dataset.i)));
  document.getElementById("quitBtn").onclick=()=>renderDashboard();
  const prev=document.getElementById("prevBtn");if(prev)prev.onclick=()=>{s.index--;renderQuestion()};
  document.getElementById("nextBtn").onclick=advance;
}
function chooseAnswer(i){
  const s=currentSession,q=s.questions[s.index];
  if(s.mode==="study"&&s.answers[s.index]!==null)return;
  const first=s.answers[s.index]===null;
  s.answers[s.index]=i;
  if(s.mode==="study"&&first)recordAttempt(q,i===q.answerIndex,{preserveCompletion:s.reviewOnly});
  renderQuestion();
}
function advance(){
  if(currentSession.index<currentSession.questions.length-1){currentSession.index++;renderQuestion();return}
  finishSession();
}
function finishSession(){
  const s=currentSession;
  if(s.mode==="exam")s.questions.forEach((q,i)=>recordAttempt(q,s.answers[i]===q.answerIndex,{preserveCompletion:s.reviewOnly}));
  const correct=s.questions.reduce((n,q,i)=>n+(s.answers[i]===q.answerIndex?1:0),0);
  const missed=s.questions.filter((q,i)=>s.answers[i]!==q.answerIndex);
  const p=loadProgress();p.sessions=(p.sessions||0)+1;saveProgress(p);
  const allClear=missed.length===0;
  app.innerHTML=`
    <section class="result-card ${allClear?"complete-result":""}">
      ${allClear?'<div class="complete-icon">✓</div>':""}<div class="eyebrow">${s.retry?(allClear?"Retry cleared":"Retry complete"):"Session complete"}</div><h2>${esc(s.label)}</h2>
      <div class="result-score"><div class="score-ring">${pct(correct,s.questions.length)}%</div><div class="result-copy"><h3>${correct} / ${s.questions.length} correct</h3><p>${missed.length?`${missed.length} ${missed.length===1?"question remains":"questions remain"}. Correct questions are already cleared; retry only the ones you missed.`:(s.retry?"You cleared every question from this retry set.":"Every question in this session was cleared.")}</p></div></div>
      <div class="result-actions">
        ${missed.length?`<button class="primary-btn" id="missedBtn">Retry missed (${missed.length})</button>`:""}
        <button class="secondary-btn" id="dashBtn">Dashboard</button>${!s.retry&&!s.reviewOnly?'<button class="secondary-btn" id="newBtn">New session</button>':""}
      </div>
      ${missed.length?`<div class="missed-list"><div class="retry-note"><strong>These stay active until correct.</strong><span>Retry rounds contain only the questions below.</span></div>${missed.slice(0,12).map(q=>`<div class="missed-row">${esc(q.question)}</div>`).join("")}${missed.length>12?`<div class="missed-row">+ ${missed.length-12} more</div>`:""}</div>`:""}
    </section>`;
  document.getElementById("dashBtn").onclick=renderDashboard;
  const nb=document.getElementById("newBtn");if(nb)nb.onclick=renderDashboard;
  const mb=document.getElementById("missedBtn");if(mb)mb.onclick=()=>startRetry(missed,s);
}
function startRetry(missed,previous){
  const qs=shuffle(missed);
  currentSession={questions:qs,index:0,answers:Array(qs.length).fill(null),mode:previous.mode,label:previous.label,poolSlug:previous.poolSlug,round:(previous.round||1)+1,retry:true,reviewOnly:previous.reviewOnly};
  renderQuestion();
}

async function renderCompletedSection(sectionMeta){
  const sp=sectionProgress(sectionMeta);
  app.innerHTML=`<section class="result-card complete-result"><div class="complete-icon">✓</div><div class="eyebrow">Section cleared</div><h2>${esc(sectionMeta.label)}</h2><p class="lede">${sp.completed.toLocaleString()} of ${sectionMeta.count.toLocaleString()} questions completed. These questions stay out of normal sessions unless you choose to review or reset this section.</p><div class="section-complete-bar"><span style="width:100%"></span></div><div class="result-actions"><button class="primary-btn" id="reviewBtn">Review completed</button><button class="secondary-btn" id="resetSectionBtn">Reset section</button><button class="secondary-btn" id="dashBtn">Dashboard</button></div></section>`;
  document.getElementById("dashBtn").onclick=renderDashboard;
  document.getElementById("reviewBtn").onclick=async()=>{
    showLoading();const data=await getSection(sectionMeta.slug);const qs=shuffle(data.questions).slice(0,Math.min(50,data.questions.length));
    currentSession={questions:qs,index:0,answers:Array(qs.length).fill(null),mode:"exam",label:`${sectionMeta.label} review`,poolSlug:sectionMeta.slug,round:1,retry:false,reviewOnly:true};renderQuestion();
  };
  document.getElementById("resetSectionBtn").onclick=async()=>{
    if(!confirm(`Reset all completion progress for ${sectionMeta.label}? This will put every question in this section back into the active pool.`))return;
    showLoading();const data=await getSection(sectionMeta.slug);const ids=new Set(data.questions.map(q=>q.id));const p=loadProgress();for(const id of ids)delete p.questions[id];saveProgress(p);renderDashboard();
  };
}
function renderStats(){
  const p=loadProgress(),overall=globalProgress(p),vals=Object.values(p.questions);
  const attempts=vals.reduce((n,x)=>n+(x.attempts||0),0),correct=vals.reduce((n,x)=>n+(x.correct||0),0),misses=vals.reduce((n,x)=>n+(x.misses||0),0);
  app.innerHTML=`<section class="stats-card"><div class="eyebrow">Local browser progress</div><h2>Your progress</h2>
    <div class="stats-grid"><div class="stat-box"><strong>${overall.completed.toLocaleString()}</strong><span>completed</span></div><div class="stat-box"><strong>${overall.remaining.toLocaleString()}</strong><span>remaining</span></div><div class="stat-box"><strong>${pct(correct,attempts)}%</strong><span>answer accuracy</span></div><div class="stat-box"><strong>${p.sessions||0}</strong><span>sessions</span></div></div>
    <div class="overall-progress"><div><strong>${pctPrecise(overall.completed,meta.total)}% complete</strong><span>${overall.completed.toLocaleString()} / ${meta.total.toLocaleString()} across all sections</span></div><div class="progress-bar"><span style="width:${(overall.completed/meta.total)*100}%"></span></div></div>
    <p class="lede">A question is completed the first time you answer it correctly. Incorrect questions remain active and return in retry rounds until you clear them. Progress is stored in this browser with localStorage.</p>
    <div class="result-actions"><button class="primary-btn" id="backDash">Back to dashboard</button><button class="secondary-btn" id="clearProgress">Clear all progress</button></div></section>`;
  document.getElementById("backDash").onclick=renderDashboard;
  document.getElementById("clearProgress").onclick=()=>{if(confirm("Clear all saved NAVLE progress in this browser? Every question will become active again.")){localStorage.removeItem(APP_KEY);renderStats()}};
}

document.getElementById("homeBtn").onclick=renderDashboard;
document.getElementById("statsBtn").onclick=renderStats;
document.getElementById("resetBtn").onclick=()=>{
  if(!currentSession){renderDashboard();return}
  if(confirm("Restart this session from question 1? Answers from this current session will be cleared, but questions already completed in earlier sessions stay completed.")){
    currentSession.index=0;currentSession.answers=Array(currentSession.questions.length).fill(null);renderQuestion();
  }
};
init().catch(err=>{console.error(err);app.innerHTML=`<section class="center-card"><h2>Could not load the question bank</h2><p>Serve this folder through GitHub Pages or a local web server rather than opening index.html directly from file://.</p></section>`});
