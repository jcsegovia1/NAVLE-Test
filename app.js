
const APP_KEY = "navle-study-lab-v1";
const app = document.getElementById("app");
const loadingTemplate = document.getElementById("loadingTemplate");
let meta = null;
let currentSession = null;
const cache = new Map();

function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function pct(n,d){return d ? Math.round((n/d)*100) : 0}
function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function loadProgress(){
  try{return JSON.parse(localStorage.getItem(APP_KEY)) || {questions:{},sessions:0}}catch{return {questions:{},sessions:0}}
}
function saveProgress(p){localStorage.setItem(APP_KEY,JSON.stringify(p))}
function recordAttempt(q,correct){
  const p=loadProgress(); const s=p.questions[q.id] || {attempts:0,correct:0,streak:0};
  s.attempts++; if(correct){s.correct++;s.streak++}else{s.streak=0}
  s.last=correct; s.section=q.section; p.questions[q.id]=s; saveProgress(p)
}
function masteredCount(ids){
  const p=loadProgress(); return ids.reduce((n,id)=>n+((p.questions[id]?.streak||0)>=2?1:0),0)
}
function showLoading(){app.innerHTML="";app.appendChild(loadingTemplate.content.cloneNode(true))}
async function init(){
  showLoading();
  meta = await fetch("data/index.json").then(r=>r.json());
  renderDashboard();
}
async function getSection(slug){
  if(cache.has(slug)) return cache.get(slug);
  const data = await fetch(`data/${slug}.json`).then(r=>r.json());
  cache.set(slug,data); return data;
}
function renderDashboard(){
  currentSession=null;
  const progress=loadProgress();
  const attempted=Object.keys(progress.questions).length;
  const mastered=Object.values(progress.questions).filter(x=>x.streak>=2).length;
  app.innerHTML=`
    <section class="hero">
      <div>
        <div class="eyebrow">Rigorous NAVLE review</div>
        <h1>Study deeply. Find the gaps. Repeat.</h1>
        <p class="lede">A clean interface for the full ${meta.total.toLocaleString()}-question bank. Build focused species sessions, run weighted mixed exams, and revisit missed material without loading the whole bank at once.</p>
      </div>
      <aside class="hero-stat">
        <div class="big">${mastered.toLocaleString()}</div>
        <p>questions mastered · ${attempted.toLocaleString()} attempted</p>
      </aside>
    </section>
    <section class="controls">
      <div class="field"><label>Question pool</label>
        <select id="poolSelect"><option value="mixed">Mixed NAVLE (weighted)</option>${meta.sections.map(s=>`<option value="${s.slug}">${esc(s.label)} · ${s.count}</option>`).join("")}</select>
      </div>
      <div class="field"><label>Mode</label><select id="modeSelect"><option value="study">Study · instant feedback</option><option value="exam">Exam · grade at end</option></select></div>
      <div class="field"><label>Questions</label><select id="sizeSelect"><option>20</option><option selected>50</option><option>100</option><option>200</option></select></div>
      <button class="primary-btn" id="startBtn">Start session</button>
    </section>
    <div class="section-heading"><div><div class="eyebrow">Question bank</div><h2>Study by section</h2></div><p>${meta.sections.length} sections</p></div>
    <section class="grid">
      ${meta.sections.map(s=>{
        const vals=Object.values(progress.questions).filter(v=>v.section===s.section);
        const attemptedSection=vals.length;
        const masteredSection=vals.filter(v=>v.streak>=2).length;
        return `<button class="category-card" data-slug="${s.slug}">
          <span class="count">${s.count.toLocaleString()} questions</span><h3>${esc(s.label)}</h3>
          <div class="mini-progress"><span style="width:${pct(masteredSection,s.count)}%"></span></div>
          <div class="card-footer"><span>${attemptedSection} attempted · ${masteredSection} mastered</span><span>Open →</span></div>
        </button>`
      }).join("")}
    </section>`;
  document.getElementById("startBtn").onclick=()=>startConfiguredSession();
  document.querySelectorAll(".category-card").forEach(btn=>btn.onclick=()=>{
    document.getElementById("poolSelect").value=btn.dataset.slug;
    startConfiguredSession();
  });
}
async function buildMixed(size){
  const weighted = meta.sections.filter(s=>s.weight>0 && s.count>0);
  const totalWeight=weighted.reduce((a,s)=>a+s.weight,0);
  const plan=weighted.map(s=>{
    const exact=size*s.weight/totalWeight;
    return {...s, take:Math.min(s.count,Math.floor(exact)), frac:exact-Math.floor(exact)};
  });
  let remaining=size-plan.reduce((n,s)=>n+s.take,0);
  for(const s of [...plan].sort((a,b)=>b.frac-a.frac)){
    if(remaining<=0)break;
    if(s.take<s.count){s.take++;remaining--}
  }
  const selected=[];
  for(const s of plan){
    if(!s.take)continue;
    const data=await getSection(s.slug);
    selected.push(...shuffle(data.questions).slice(0,s.take));
  }
  if(selected.length<size){
    const all=[]; for(const s of weighted){const d=await getSection(s.slug);all.push(...d.questions)}
    const have=new Set(selected.map(q=>q.id));
    selected.push(...shuffle(all.filter(q=>!have.has(q.id))).slice(0,size-selected.length));
  }
  return shuffle(selected).slice(0,size);
}
async function startConfiguredSession(){
  const pool=document.getElementById("poolSelect").value;
  const mode=document.getElementById("modeSelect").value;
  const size=Number(document.getElementById("sizeSelect").value);
  showLoading();
  let qs,label;
  if(pool==="mixed"){qs=await buildMixed(size);label="Mixed NAVLE"}
  else{
    const data=await getSection(pool); label=data.label; qs=shuffle(data.questions).slice(0,Math.min(size,data.questions.length));
  }
  currentSession={questions:qs,index:0,answers:Array(qs.length).fill(null),mode,label,submitted:false};
  renderQuestion();
}
function renderQuestion(){
  const s=currentSession, q=s.questions[s.index], chosen=s.answers[s.index];
  const answered=chosen!==null;
  const reveal=s.mode==="study" && answered;
  const progress=pct(s.index+1,s.questions.length);
  app.innerHTML=`
    <section class="quiz-head">
      <div class="quiz-title"><div class="eyebrow">${esc(s.mode==="study"?"Study mode":"Exam mode")}</div><h2>${esc(s.label)}</h2><p>${s.questions.length} questions · no duplicates in this session</p></div>
      <div class="progress-wrap"><small>Question ${s.index+1} of ${s.questions.length}</small><div class="progress-bar"><span style="width:${progress}%"></span></div></div>
    </section>
    <article class="question-card">
      <div class="question-meta"><span class="badge">${esc(q.section.replace(/\s*\([^)]*\)\s*$/,""))}</span><span class="badge">${esc(q.target)}</span><span class="badge">Source row ${q.sourceRow}</span></div>
      <h3 class="question-text">${esc(q.question)}</h3>
      <div class="choices">${q.choices.map((choice,i)=>{
        let cls="choice"; if(chosen===i)cls+=" selected";
        if(reveal&&i===q.answerIndex)cls+=" correct";
        if(reveal&&chosen===i&&chosen!==q.answerIndex)cls+=" wrong";
        return `<button class="${cls}" data-i="${i}" ${reveal?"disabled":""}><span class="choice-letter">${"ABCD"[i]}</span><span>${esc(choice)}</span></button>`
      }).join("")}</div>
      ${reveal?`<div class="feedback ${chosen===q.answerIndex?"good":"bad"}"><strong>${chosen===q.answerIndex?"Correct":"Review this one"}</strong><p>Correct answer: ${"ABCD"[q.answerIndex]}. ${esc(q.answer)}</p></div>`:""}
      <div class="quiz-actions">
        <button class="secondary-btn" id="quitBtn">Exit</button>
        <div class="quiz-actions-right">
          ${s.index>0?`<button class="secondary-btn" id="prevBtn">Previous</button>`:""}
          <button class="primary-btn" id="nextBtn" ${chosen===null?"disabled":""}>${s.index===s.questions.length-1?(s.mode==="exam"?"Submit exam":"Finish"):"Next"}</button>
        </div>
      </div>
    </article>`;
  document.querySelectorAll(".choice").forEach(btn=>btn.onclick=()=>chooseAnswer(Number(btn.dataset.i)));
  document.getElementById("quitBtn").onclick=()=>renderDashboard();
  const prev=document.getElementById("prevBtn"); if(prev)prev.onclick=()=>{s.index--;renderQuestion()};
  document.getElementById("nextBtn").onclick=()=>advance();
}
function chooseAnswer(i){
  const s=currentSession,q=s.questions[s.index];
  if(s.mode==="study" && s.answers[s.index]!==null)return;
  const first=s.answers[s.index]===null;
  s.answers[s.index]=i;
  if(s.mode==="study" && first)recordAttempt(q,i===q.answerIndex);
  renderQuestion();
}
function advance(){
  const s=currentSession;
  if(s.index<s.questions.length-1){s.index++;renderQuestion();return}
  finishSession();
}
function finishSession(){
  const s=currentSession;
  if(s.mode==="exam"){
    s.questions.forEach((q,i)=>recordAttempt(q,s.answers[i]===q.answerIndex));
  }
  const correct=s.questions.reduce((n,q,i)=>n+(s.answers[i]===q.answerIndex?1:0),0);
  const missed=s.questions.filter((q,i)=>s.answers[i]!==q.answerIndex);
  const p=loadProgress();p.sessions=(p.sessions||0)+1;saveProgress(p);
  app.innerHTML=`
    <section class="result-card">
      <div class="eyebrow">Session complete</div><h2>${esc(s.label)}</h2>
      <div class="result-score"><div class="score-ring">${pct(correct,s.questions.length)}%</div><div class="result-copy"><h3>${correct} / ${s.questions.length} correct</h3><p>${missed.length?`${missed.length} questions need another pass. Use “Study missed” to reinforce them immediately.`:"Perfect session. Keep spacing your reviews so the material sticks."}</p></div></div>
      <div class="result-actions">
        ${missed.length?`<button class="primary-btn" id="missedBtn">Study missed (${missed.length})</button>`:""}
        <button class="secondary-btn" id="againBtn">New session</button><button class="secondary-btn" id="dashBtn">Dashboard</button>
      </div>
      ${missed.length?`<div class="missed-list">${missed.slice(0,12).map(q=>`<div class="missed-row">${esc(q.question)}</div>`).join("")}${missed.length>12?`<div class="missed-row">+ ${missed.length-12} more</div>`:""}</div>`:""}
    </section>`;
  document.getElementById("dashBtn").onclick=renderDashboard;
  document.getElementById("againBtn").onclick=renderDashboard;
  const mb=document.getElementById("missedBtn"); if(mb)mb.onclick=()=>{
    currentSession={questions:shuffle(missed),index:0,answers:Array(missed.length).fill(null),mode:"study",label:"Missed questions",submitted:false};renderQuestion()
  };
}
function renderStats(){
  const p=loadProgress(), vals=Object.values(p.questions);
  const attempted=vals.length, attempts=vals.reduce((n,x)=>n+x.attempts,0), correct=vals.reduce((n,x)=>n+x.correct,0), mastered=vals.filter(x=>x.streak>=2).length;
  app.innerHTML=`<section class="stats-card"><div class="eyebrow">Local browser progress</div><h2>Your progress</h2>
    <div class="stats-grid"><div class="stat-box"><strong>${attempted}</strong><span>unique attempted</span></div><div class="stat-box"><strong>${attempts}</strong><span>total attempts</span></div><div class="stat-box"><strong>${pct(correct,attempts)}%</strong><span>accuracy</span></div><div class="stat-box"><strong>${mastered}</strong><span>mastered (2+ streak)</span></div></div>
    <p class="lede">Progress is stored only in this browser with localStorage. It does not require a login or backend.</p>
    <div class="result-actions"><button class="primary-btn" id="backDash">Back to dashboard</button><button class="secondary-btn" id="clearProgress">Clear progress</button></div>
  </section>`;
  document.getElementById("backDash").onclick=renderDashboard;
  document.getElementById("clearProgress").onclick=()=>{if(confirm("Clear all saved NAVLE progress in this browser?")){localStorage.removeItem(APP_KEY);renderStats()}};
}
document.getElementById("homeBtn").onclick=renderDashboard;
document.getElementById("statsBtn").onclick=renderStats;
document.getElementById("resetBtn").onclick=()=>{
  if(!currentSession){renderDashboard();return}
  if(confirm("Restart this session from question 1?")){
    currentSession.index=0;
    currentSession.answers=Array(currentSession.questions.length).fill(null);
    renderQuestion();
  }
};
init().catch(err=>{console.error(err);app.innerHTML=`<section class="center-card"><h2>Could not load the question bank</h2><p>Serve this folder through GitHub Pages or a local web server rather than opening index.html directly from file://.</p></section>`});
