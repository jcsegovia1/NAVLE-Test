const APP_KEY = "navle-study-lab-v1";
const app = document.getElementById("app");
const loadingTemplate = document.getElementById("loadingTemplate");
let meta = null;
let currentSession = null;
const cache = new Map();
const CLINICAL_COUNTS_FALLBACK = {
  "canine":102, "feline":85, "equine":144, "bovine":123, "porcine":63, "small-mammal":46, "ovinecaprine":35, "bird":23, "poultry":60, "camelidcervid":28, "reptile":3, "aquatics":20, "other":0
};
function hydrateClinicalMeta(){
  if(!meta?.sections)return;
  meta.sections.forEach(s=>{
    const fallback=CLINICAL_COUNTS_FALLBACK[s.slug]||0;
    if(!Number.isFinite(Number(s.clinicalCount)) || Number(s.clinicalCount)<=0){
      s.clinicalCount=fallback;
    }
  });
  const fallbackTotal=meta.sections.reduce((n,s)=>n+(CLINICAL_COUNTS_FALLBACK[s.slug]||0),0);
  if(!Number.isFinite(Number(meta.clinicalTotal)) || Number(meta.clinicalTotal)<=0){
    meta.clinicalTotal=fallbackTotal;
  }
}

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
function styleLabel(style){return style==="clinical"?"Clinical Cases":"Quick Burst"}
function trackKey(style){return style==="clinical"?"clinicalQuestions":"questions"}
function totalForStyle(style){return style==="clinical"?(meta.clinicalTotal||0):meta.total}
function countForSection(s,style){return style==="clinical"?(s.clinicalCount||0):s.count}

function defaultProgress(){return {version:3,questions:{},clinicalQuestions:{},sessions:0}}
function sectionForQuestionId(id){
  const n=Number(String(id).replace(/\D/g,""));
  return meta?.sections.find(s=>n>=s.idMin&&n<=s.idMax)?.section || null;
}
function normalizeTrack(track,isClinical=false){
  track ||= {};
  let changed=false;
  for(const [id,s0] of Object.entries(track)){
    let s=s0;
    if(typeof s!=="object"||!s){track[id]={attempts:0,correct:0,misses:0,completed:false};changed=true;continue}
    if(s.completed===undefined){s.completed=(s.correct||0)>0;changed=true}
    if(s.misses===undefined){s.misses=Math.max(0,(s.attempts||0)-(s.correct||0));changed=true}
    if(!s.section&&meta&&!isClinical){s.section=sectionForQuestionId(id);changed=true}
  }
  return {track,changed};
}
function normalizeProgress(p){
  if(!p||typeof p!=="object")p=defaultProgress();
  p.questions ||= {}; p.clinicalQuestions ||= {}; p.sessions ||= 0;
  const a=normalizeTrack(p.questions,false), b=normalizeTrack(p.clinicalQuestions,true);
  p.questions=a.track; p.clinicalQuestions=b.track; p.version=3;
  if(a.changed||b.changed)saveProgress(p);
  return p;
}
function loadProgress(){
  try{return normalizeProgress(JSON.parse(localStorage.getItem(APP_KEY))||defaultProgress())}
  catch{return defaultProgress()}
}
function saveProgress(p){localStorage.setItem(APP_KEY,JSON.stringify(p))}
function isCompleted(id,style,progress=loadProgress()){return !!progress[trackKey(style)]?.[id]?.completed}
function recordAttempt(q,correct,{style="quick",preserveCompletion=false}={}){
  const p=loadProgress(), key=trackKey(style), track=p[key]||(p[key]={});
  const s=track[q.id] || {attempts:0,correct:0,misses:0,completed:false,section:q.section};
  s.attempts=(s.attempts||0)+1;
  s.correct=(s.correct||0)+(correct?1:0);
  s.misses=(s.misses||0)+(correct?0:1);
  s.last=correct; s.section=q.section; s.lastSeen=Date.now();
  if(correct)s.completed=true;
  else if(!preserveCompletion&&!s.completed)s.completed=false;
  track[q.id]=s; saveProgress(p);
}
function sectionProgress(section,style,progress=loadProgress()){
  const key=trackKey(style), track=progress[key]||{};
  let completed=0,attempted=0;
  for(const [id,s] of Object.entries(track)){
    const sec=s.section||(!style||style==="quick"?sectionForQuestionId(id):null);
    if(sec!==section.section)continue;
    if((s.attempts||0)>0)attempted++;
    if(s.completed)completed++;
  }
  const count=countForSection(section,style);
  completed=Math.min(completed,count);
  return {completed,remaining:Math.max(0,count-completed),attempted,count};
}
function globalProgress(style,progress=loadProgress()){
  const completed=meta.sections.reduce((n,s)=>n+sectionProgress(s,style,progress).completed,0);
  const total=totalForStyle(style);
  return {completed,remaining:Math.max(0,total-completed),total};
}

function showLoading(){app.innerHTML="";app.appendChild(loadingTemplate.content.cloneNode(true))}
async function init(){
  showLoading();
  meta=await fetch("data/index.json?v=30").then(r=>r.json());
  hydrateClinicalMeta();
  normalizeProgress(loadProgress());
  renderDashboard();
}
async function getSection(slug){
  if(cache.has(slug))return cache.get(slug);
  const data=await fetch(`data/${slug}.json?v=30`).then(r=>r.json());
  cache.set(slug,data);return data;
}
function questionsForData(data,style){return style==="clinical"?(data.clinicalQuestions||[]):data.questions}

function sourceRowForQuestion(q){
  const sm=meta.sections.find(s=>s.section===q.section);
  if(!sm)return null;
  const data=cache.get(sm.slug);
  return data?.sourceRows?.[String(q.sourceRow)]||null;
}
function targetKeysForQuestion(q){
  const t=String(q.target||"").toLowerCase();
  if(t==="reportable/zoonotic")return new Set(["reportable","zoonotic"]);
  if(t==="diagnosis")return new Set(["disease"]);
  if(t==="treatment")return new Set(["treatment"]);
  if(t==="diagnostics")return new Set(["diagnostics"]);
  return new Set([t]);
}
function studyGuideHtml(q){
  const row=sourceRowForQuestion(q);
  if(!row)return `<div class="study-guide-panel"><div class="study-guide-empty">Study-guide row unavailable.</div></div>`;
  const targetKeys=targetKeysForQuestion(q);
  const sectionName=q.section.replace(/\s*\([^)]*\)\s*$/,"");
  return `
    <section class="study-guide-panel" aria-label="Original study guide row">
      <div class="study-guide-heading">
        <div><span class="study-guide-kicker">Study guide</span><strong>${esc(sectionName)} · row ${q.sourceRow}</strong></div>
        <span class="study-guide-source">Original workbook context</span>
      </div>
      <div class="study-guide-grid">
        ${row.fields.map(field=>{
          const highlighted=targetKeys.has(field.key);
          const raw=field.displayValue;
          const blank=raw===null||raw===undefined||raw==="";
          return `<div class="study-guide-field ${highlighted?"target-field":""}">
            <div class="study-guide-label">${esc(field.label||field.key)}${field.inherited?'<span class="continued-tag">continued</span>':""}</div>
            <div class="study-guide-value ${blank?"blank-value":""}">${blank?"—":esc(raw)}</div>
          </div>`;
        }).join("")}
      </div>
    </section>`;
}

function progressLane(title,progress,kind){
  const p=pctPrecise(progress.completed,progress.total);
  return `<div class="hero-lane ${kind}">
    <div class="hero-lane-head"><strong>${title}</strong><span>${progress.remaining.toLocaleString()} remaining</span></div>
    <div class="hero-progress"><span style="width:${progress.total?(progress.completed/progress.total)*100:0}%"></span></div>
    <small>${p}% complete · ${progress.completed.toLocaleString()} / ${progress.total.toLocaleString()}</small>
  </div>`;
}

function renderDashboard(){
  currentSession=null;
  const progress=loadProgress();
  const quick=globalProgress("quick",progress), clinical=globalProgress("clinical",progress);
  app.innerHTML=`
    <section class="hero">
      <div>
        <div class="eyebrow">Rigorous NAVLE review</div>
        <h1>good luck &lt;3</h1>
        <p class="lede">Build recall with Quick Burst, then apply it with Clinical Cases. Progress is tracked separately.</p>
      </div>
      <aside class="hero-stat dual-progress">
        ${progressLane("Quick Burst",quick,"quick")}
        ${progressLane("Clinical Cases",clinical,"clinical")}
      </aside>
    </section>

    <section class="controls clinical-controls">
      <div class="field"><label>Question style</label>
        <select id="styleSelect"><option value="quick">Quick Burst</option><option value="clinical">Clinical Cases</option></select>
      </div>
      <div class="field"><label>Question pool</label>
        <select id="poolSelect"><option value="mixed">Mixed NAVLE (weighted)</option>${meta.sections.map(s=>`<option value="${s.slug}">${esc(s.label)}</option>`).join("")}</select>
      </div>
      <div class="field"><label>Feedback</label><select id="modeSelect"><option value="study">Study · instant feedback</option><option value="exam">Exam · grade at end</option></select></div>
      <div class="field"><label>Questions</label><select id="sizeSelect"><option>20</option><option selected>50</option><option>100</option><option>200</option></select></div>
      <div class="start-session-row"><button class="primary-btn" id="startBtn">Start session</button></div>
    </section>

    <div class="section-heading"><div><div class="eyebrow">Question bank</div><h2>Study by section</h2></div><p>${meta.sections.length} sections</p></div>
    <section class="grid">
      ${meta.sections.map(s=>{
        const qp=sectionProgress(s,"quick",progress), cp=sectionProgress(s,"clinical",progress);
        return `<button class="category-card dual-card" data-slug="${s.slug}">
          <div class="card-top section-counts">
            <span>${s.count.toLocaleString()} Quick Burst</span>
            <span>${(s.clinicalCount||0).toLocaleString()} Clinical Cases</span>
          </div>
          <h3>${esc(s.label)}</h3>
          <div class="track-block quick-track">
            <div class="track-label"><span class="track-name">Quick Burst</span><span class="track-remaining">${qp.remaining.toLocaleString()} remaining</span></div>
            <div class="mini-progress"><span style="width:${qp.count?(qp.completed/qp.count)*100:0}%"></span></div>
            <div class="track-cleared">${qp.completed.toLocaleString()} cleared</div>
          </div>
          <div class="track-block clinical-track">
            <div class="track-label"><span class="track-name">Clinical Cases</span><span class="track-remaining">${cp.count?`${cp.remaining.toLocaleString()} remaining`:"No cases"}</span></div>
            <div class="mini-progress"><span style="width:${cp.count?(cp.completed/cp.count)*100:0}%"></span></div>
            <div class="track-cleared">${cp.completed.toLocaleString()} cleared</div>
          </div>
        </button>`
      }).join("")}
    </section>`;

  document.getElementById("startBtn").onclick=()=>startConfiguredSession();
  document.querySelectorAll(".category-card").forEach(btn=>btn.onclick=()=>{
    document.getElementById("poolSelect").value=btn.dataset.slug;
    startConfiguredSession();
  });
}

async function activeQuestionsForSection(sectionMeta,style,progress=loadProgress()){
  const data=await getSection(sectionMeta.slug);
  return questionsForData(data,style).filter(q=>!isCompleted(q.id,style,progress));
}
async function buildMixed(size,style){
  const progress=loadProgress();
  const weighted=meta.sections.filter(s=>s.weight>0&&countForSection(s,style)>0);
  const pools=[];
  for(const s of weighted){
    const active=await activeQuestionsForSection(s,style,progress);
    if(active.length)pools.push({...s,active});
  }
  const available=pools.reduce((n,s)=>n+s.active.length,0);
  size=Math.min(size,available);
  if(!size)return [];
  const totalWeight=pools.reduce((a,s)=>a+s.weight,0);
  const plan=pools.map(s=>{const exact=size*s.weight/totalWeight;return {...s,take:Math.min(s.active.length,Math.floor(exact)),frac:exact-Math.floor(exact)}});
  let left=size-plan.reduce((n,s)=>n+s.take,0);
  while(left>0){
    const candidates=plan.filter(s=>s.take<s.active.length).sort((a,b)=>(b.frac-a.frac)||(b.weight-a.weight));
    if(!candidates.length)break;
    for(const s of candidates){if(left<=0)break;s.take++;left--}
  }
  const picked=[];
  for(const s of plan)if(s.take)picked.push(...shuffle(s.active).slice(0,s.take));
  return shuffle(picked).slice(0,size);
}
async function startConfiguredSession(){
  const style=document.getElementById("styleSelect").value;
  const pool=document.getElementById("poolSelect").value;
  const mode=document.getElementById("modeSelect").value;
  const requested=Number(document.getElementById("sizeSelect").value);
  showLoading();
  let qs,label,poolSlug=pool;
  if(pool==="mixed"){qs=await buildMixed(requested,style);label=`Mixed NAVLE · ${styleLabel(style)}`}
  else{
    const sm=meta.sections.find(s=>s.slug===pool), data=await getSection(pool);
    const active=questionsForData(data,style).filter(q=>!isCompleted(q.id,style));
    label=`${data.label} · ${styleLabel(style)}`;
    qs=shuffle(active).slice(0,Math.min(requested,active.length));
  }
  if(!qs.length){renderNoQuestions(label,poolSlug,style);return}
  currentSession={questions:qs,index:0,answers:Array(qs.length).fill(null),mode,style,label,poolSlug,round:1,retry:false,reviewOnly:false};
  renderQuestion();
}
function renderNoQuestions(label,poolSlug,style){
  const sm=poolSlug!=="mixed"?meta.sections.find(s=>s.slug===poolSlug):null;
  const hasTrack=sm&&countForSection(sm,style)>0;
  app.innerHTML=`<section class="result-card complete-result"><div class="complete-icon">${hasTrack?"✓":"—"}</div><div class="eyebrow">${esc(styleLabel(style))}</div><h2>${esc(label)}</h2><p class="lede">${hasTrack?"Every question in this track has been answered correctly at least once.":"There are no eligible questions for this track in this section."}</p><div class="result-actions">${hasTrack?'<button class="primary-btn" id="reviewBtn">Review completed</button><button class="secondary-btn" id="resetTrackBtn">Reset this track</button>':""}<button class="secondary-btn" id="dashBtn">Dashboard</button></div></section>`;
  document.getElementById("dashBtn").onclick=renderDashboard;
  const review=document.getElementById("reviewBtn");
  if(review)review.onclick=async()=>{
    showLoading();const data=await getSection(poolSlug),all=questionsForData(data,style),qs=shuffle(all).slice(0,Math.min(50,all.length));
    currentSession={questions:qs,index:0,answers:Array(qs.length).fill(null),mode:"exam",style,label:`${sm.label} · ${styleLabel(style)} review`,poolSlug,round:1,retry:false,reviewOnly:true};renderQuestion();
  };
  const reset=document.getElementById("resetTrackBtn");
  if(reset)reset.onclick=async()=>{
    if(!confirm(`Reset ${styleLabel(style)} completion for ${sm.label}?`))return;
    showLoading();const data=await getSection(poolSlug),ids=new Set(questionsForData(data,style).map(q=>q.id)),p=loadProgress(),track=p[trackKey(style)]||{};
    for(const id of ids)delete track[id];
    p[trackKey(style)]=track;saveProgress(p);renderDashboard();
  };
}

function feedbackHtml(s,q,chosen){
  const correct=chosen===q.answerIndex;
  if(s.style==="clinical"){
    const explanation=q.explanation?esc(q.explanation):"";
    return `<div class="feedback ${correct?"good":"bad"}"><strong>${correct?"Correct — cleared":"Incorrect"}</strong><p>${correct?"":`Correct answer: ${"ABCD"[q.answerIndex]}. ${esc(q.answer)} `}${explanation}</p></div>`;
  }
  return `<div class="feedback ${correct?"good":"bad"}"><strong>${correct?"Correct — cleared":"Incorrect"}</strong><p>${correct?"This question is now removed from normal future sessions.":`Correct answer: ${"ABCD"[q.answerIndex]}. ${esc(q.answer)} This question will return in the retry round.`}</p></div>`;
}

function renderQuestion(){
  const s=currentSession,q=s.questions[s.index],chosen=s.answers[s.index];
  const answered=chosen!==null;
  const reveal=s.mode==="study"&&answered;
  const guideOpen=s.guideOpenFor===q.id;
  const progress=pct(s.index+1,s.questions.length);
  const modeName=s.mode==="study"?"Study · instant feedback":"Exam · grade at end";
  const modeLabel=s.retry?`Retry round ${s.round} · ${styleLabel(s.style)}`:`${styleLabel(s.style)} · ${modeName}`;
  app.innerHTML=`
    <section class="quiz-head">
      <div class="quiz-title"><div class="eyebrow">${esc(modeLabel)}</div><h2>${esc(s.label)}</h2><p>${s.questions.length} questions${s.retry?" · missed questions only":" · correct answers clear only this track"}</p></div>
      <div class="progress-wrap"><small>Question ${s.index+1} of ${s.questions.length}</small><div class="progress-bar"><span style="width:${progress}%"></span></div></div>
    </section>
    <article class="question-card ${s.style==="clinical"?"clinical-question-card":""}">
      <div class="question-meta"><span class="badge">${esc(q.section.replace(/\s*\([^)]*\)\s*$/,""))}</span><span class="badge">${esc(q.target)}</span>${s.style==="clinical"?'<span class="badge clinical-badge">Clinical case</span>':""}<span class="badge">Source row ${q.sourceRow}</span></div>
      <h3 class="question-text">${esc(q.question)}</h3>
      <div class="choices">${q.choices.map((choice,i)=>{
        let cls="choice";if(chosen===i)cls+=" selected";if(reveal&&i===q.answerIndex)cls+=" correct";if(reveal&&chosen===i&&chosen!==q.answerIndex)cls+=" wrong";
        return `<button class="${cls}" data-i="${i}" ${reveal?"disabled":""}><span class="choice-letter">${"ABCD"[i]}</span><span>${esc(choice)}</span></button>`
      }).join("")}</div>
      ${reveal?feedbackHtml(s,q,chosen):""}
      ${guideOpen?studyGuideHtml(q):""}
      <div class="quiz-actions">
        <div class="quiz-actions-left">
          <button class="secondary-btn" id="quitBtn">Exit</button>
          ${reveal?`<button class="secondary-btn study-guide-btn ${guideOpen?"active":""}" id="guideBtn">${guideOpen?"Hide study guide":"View study guide"}</button>`:""}
        </div>
        <div class="quiz-actions-right">
          ${s.mode==="exam"&&s.index>0?'<button class="secondary-btn" id="prevBtn">Previous</button>':""}
          <button class="primary-btn" id="nextBtn" ${chosen===null?"disabled":""}>${s.index===s.questions.length-1?(s.mode==="exam"?"Submit":"Finish"):"Next"}</button>
        </div>
      </div>
    </article>`;
  document.querySelectorAll(".choice").forEach(btn=>btn.onclick=()=>chooseAnswer(Number(btn.dataset.i)));
  document.getElementById("quitBtn").onclick=()=>renderDashboard();
  const guideBtn=document.getElementById("guideBtn");
  if(guideBtn)guideBtn.onclick=()=>{s.guideOpenFor=guideOpen?null:q.id;renderQuestion()};
  const prev=document.getElementById("prevBtn");if(prev)prev.onclick=()=>{s.index--;renderQuestion()};
  document.getElementById("nextBtn").onclick=advance;
}
function chooseAnswer(i){
  const s=currentSession,q=s.questions[s.index];
  if(s.mode==="study"&&s.answers[s.index]!==null)return;
  const first=s.answers[s.index]===null;
  s.answers[s.index]=i;
  if(s.mode==="study"&&first)recordAttempt(q,i===q.answerIndex,{style:s.style,preserveCompletion:s.reviewOnly});
  renderQuestion();
}
function advance(){
  if(currentSession.index<currentSession.questions.length-1){currentSession.index++;renderQuestion();return}
  finishSession();
}
function finishSession(){
  const s=currentSession;
  if(s.mode==="exam")s.questions.forEach((q,i)=>recordAttempt(q,s.answers[i]===q.answerIndex,{style:s.style,preserveCompletion:s.reviewOnly}));
  const correct=s.questions.reduce((n,q,i)=>n+(s.answers[i]===q.answerIndex?1:0),0);
  const missed=s.questions.filter((q,i)=>s.answers[i]!==q.answerIndex);
  const p=loadProgress();p.sessions=(p.sessions||0)+1;saveProgress(p);
  const allClear=missed.length===0;
  app.innerHTML=`
    <section class="result-card ${allClear?"complete-result":""}">
      ${allClear?'<div class="complete-icon">✓</div>':""}<div class="eyebrow">${esc(styleLabel(s.style))} · ${s.retry?(allClear?"Retry cleared":"Retry complete"):"Session complete"}</div><h2>${esc(s.label)}</h2>
      <div class="result-score"><div class="score-ring">${pct(correct,s.questions.length)}%</div><div class="result-copy"><h3>${correct} / ${s.questions.length} correct</h3><p>${missed.length?`${missed.length} ${missed.length===1?"question remains":"questions remain"}. Correct questions are cleared from ${styleLabel(s.style)} only; retry the ones you missed.`:(s.retry?"You cleared every question from this retry set.":"Every question in this session was cleared.")}</p></div></div>
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
  currentSession={questions:qs,index:0,answers:Array(qs.length).fill(null),mode:previous.mode,style:previous.style,label:previous.label,poolSlug:previous.poolSlug,round:(previous.round||1)+1,retry:true,reviewOnly:previous.reviewOnly};
  renderQuestion();
}

function trackStats(style,p){
  const vals=Object.values(p[trackKey(style)]||{});
  const attempts=vals.reduce((n,x)=>n+(x.attempts||0),0),correct=vals.reduce((n,x)=>n+(x.correct||0),0);
  const gp=globalProgress(style,p);
  return {...gp,attempts,correct,accuracy:pct(correct,attempts)};
}
function statsPanel(title,stats,kind){
  return `<div class="mode-stats ${kind}">
    <div class="mode-stats-head"><h3>${title}</h3><strong>${pctPrecise(stats.completed,stats.total)}%</strong></div>
    <div class="progress-bar"><span style="width:${stats.total?(stats.completed/stats.total)*100:0}%"></span></div>
    <div class="mode-stat-numbers"><span>${stats.completed.toLocaleString()} completed</span><span>${stats.remaining.toLocaleString()} remaining</span><span>${stats.accuracy}% accuracy</span></div>
  </div>`;
}
function renderStats(){
  const p=loadProgress(),quick=trackStats("quick",p),clinical=trackStats("clinical",p);
  app.innerHTML=`<section class="stats-card"><div class="eyebrow">Local browser progress</div><h2>Your progress</h2>
    <div class="progress-mode-stack">${statsPanel("Quick Burst",quick,"quick")}${statsPanel("Clinical Cases",clinical,"clinical")}</div>
    <div class="stats-grid"><div class="stat-box"><strong>${p.sessions||0}</strong><span>sessions</span></div><div class="stat-box"><strong>${quick.attempts.toLocaleString()}</strong><span>quick attempts</span></div><div class="stat-box"><strong>${clinical.attempts.toLocaleString()}</strong><span>clinical attempts</span></div><div class="stat-box"><strong>${meta.clinicalTotal.toLocaleString()}</strong><span>clinical cases available</span></div></div>
    <p class="lede">Quick Burst and Clinical Cases are independent mastery tracks. Clearing a clinical case never removes its related Quick Burst questions, and clearing a Quick Burst fact never removes a clinical case.</p>
    <div class="result-actions"><button class="primary-btn" id="backDash">Back to dashboard</button><button class="secondary-btn" id="clearProgress">Clear all progress</button></div></section>`;
  document.getElementById("backDash").onclick=renderDashboard;
  document.getElementById("clearProgress").onclick=()=>{if(confirm("Clear all saved NAVLE progress in this browser? Both Quick Burst and Clinical Cases will reset.")){localStorage.removeItem(APP_KEY);renderStats()}};
}

document.getElementById("homeBtn").onclick=renderDashboard;
document.getElementById("statsBtn").onclick=renderStats;
document.getElementById("resetBtn").onclick=()=>{
  if(!currentSession){renderDashboard();return}
  if(confirm("Restart this session from question 1? Answers from this current session will be cleared, but earlier completed questions stay completed.")){
    currentSession.index=0;currentSession.answers=Array(currentSession.questions.length).fill(null);renderQuestion();
  }
};
init().catch(err=>{console.error(err);app.innerHTML=`<section class="center-card"><h2>Could not load the question bank</h2><p>Serve this folder through GitHub Pages or a local web server rather than opening index.html directly from file://.</p></section>`});
