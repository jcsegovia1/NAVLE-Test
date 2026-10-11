"use strict";
// Independent of the NAVLE quiz engine. No localStorage writes and no external APIs.
const statusNode = document.getElementById('podcastStatus');
const episodeNode = document.getElementById('podcastEpisodes');
const subjectNode = document.getElementById('podcastSubject');
let episodes = [];

// Podcast playback positions use a separate keyspace from the quiz progress data.
const positionPrefix='navle-podcast-position-v1:';
const positionKey=e=>positionPrefix+String(e.id||e.audioUrl);
function storedPosition(e){
  try{const n=Number(localStorage.getItem(positionKey(e)));return Number.isFinite(n)&&n>0?n:0}
  catch(_){return 0}
}
function savePosition(e,audio){
  if(!Number.isFinite(audio.currentTime)||audio.currentTime<0)return;
  try{
    if(audio.ended || (Number.isFinite(audio.duration)&&audio.duration>0&&audio.currentTime>=audio.duration-3)){
      localStorage.removeItem(positionKey(e));
    }else if(audio.currentTime>=1){
      localStorage.setItem(positionKey(e),String(Math.floor(audio.currentTime)));
    }
  }catch(_){/* Private browsing or disabled storage: playback still works. */}
}
function clearPosition(e){try{localStorage.removeItem(positionKey(e))}catch(_){}}
function timeLabel(seconds){
  const n=Math.max(0,Math.floor(seconds));
  return Math.floor(n/3600)?`${Math.floor(n/3600)}:${String(Math.floor(n%3600/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`
    :`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
}
function enableResume(e,audio,controls){
  const note=document.createElement('span');note.className='podcast-resume-note';note.setAttribute('role','status');
  note.setAttribute('aria-live','polite');
  const restart=document.createElement('button');restart.type='button';restart.className='podcast-restart';restart.textContent='Start over';
  controls.append(note,restart);
  const saved=storedPosition(e);
  if(saved>=5)note.textContent=`Saved position: ${timeLabel(saved)}`;
  else restart.hidden=true;
  let restored=false;
  audio.addEventListener('loadedmetadata',()=>{
    if(restored)return;
    restored=true;
    const resume=storedPosition(e);
    if(resume>=5 && ( !Number.isFinite(audio.duration) || resume<audio.duration-5)){
      try{audio.currentTime=resume;note.textContent=`Resumed at ${timeLabel(resume)}`;restart.hidden=false}
      catch(_){note.textContent=`Saved position: ${timeLabel(resume)}`}
    }else if(resume>0){clearPosition(e);note.textContent='';restart.hidden=true}
  });
  // Safari can defer metadata until play is pressed. Setting the seek on loadedmetadata
  // resumes without triggering playback or interfering with lock-screen audio controls.
  let lastStoredSecond=-1;
  audio.addEventListener('timeupdate',()=>{
    const sec=Math.floor(audio.currentTime);
    if(sec-lastStoredSecond>=5 || sec<lastStoredSecond){savePosition(e,audio);lastStoredSecond=sec}
  });
  audio.addEventListener('pause',()=>savePosition(e,audio));
  audio.addEventListener('seeking',()=>savePosition(e,audio));
  audio.addEventListener('ended',()=>{clearPosition(e);note.textContent='Finished';restart.hidden=true});
  restart.addEventListener('click',()=>{
    clearPosition(e);audio.currentTime=0;note.textContent='Started over';restart.hidden=true;
  });
  // pagehide also runs when Safari is backgrounded, including on iPhone.
  window.addEventListener('pagehide',()=>savePosition(e,audio));
}

const escapeText = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderEpisodes(){
  const selected=subjectNode.value;
  const visible=episodes.filter(e=>selected==='all'||e.subject===selected);
  episodeNode.replaceChildren();
  statusNode.textContent=visible.length?'': 'No episodes in this subject yet.';
  for(const e of visible){
    const card=document.createElement('article');card.className='podcast-card';
    const safe=(v)=>escapeText(v);
    card.innerHTML=`<div class="podcast-card-header"><span class="podcast-chip">${safe(e.subject)}</span><span class="podcast-chip">Episode ${safe(e.episode)}</span>${e.published?'': '<span class="podcast-chip pending">Audio coming soon</span>'}</div>
      <h3>${safe(e.title)}</h3><div class="podcast-hosts">${safe(e.hosts)} · ${safe(e.durationLabel)}</div>
      <p>${safe(e.description)}</p>`;
    if(e.published && e.audioUrl){
      const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.setAttribute('aria-label',`Play ${e.title}`);audio.src=e.audioUrl;
      card.appendChild(audio);
      const controls=document.createElement('div');controls.className='podcast-controls';
      const label=document.createElement('label');label.textContent='Playback speed';
      const speed=document.createElement('select');speed.setAttribute('aria-label',`Playback speed for ${e.title}`);
      for(const v of [1,1.25,1.5,2]){const opt=document.createElement('option');opt.value=String(v);opt.textContent=v+'×';speed.appendChild(opt)}
      speed.addEventListener('change',()=>{audio.playbackRate=Number(speed.value)});
      label.appendChild(speed);controls.appendChild(label);enableResume(e,audio,controls);card.appendChild(controls);
      audio.addEventListener('error',()=>{statusNode.textContent='One audio file could not be loaded. Check its MP3 path and capitalization.'});
    }else{
      const message=document.createElement('p');message.className='podcast-empty';message.textContent='The episode is ready in the library. Upload the finished MP3 and mark it published to enable listening and downloads.';card.appendChild(message);
    }
    const actions=document.createElement('div');actions.className='podcast-actions';
    if(e.published && e.audioUrl){const download=document.createElement('a');download.className='podcast-action primary';download.href=e.audioUrl;download.download=e.audioUrl.split('/').pop();download.textContent='Download MP3';actions.appendChild(download)}
    if(e.relatedQuiz && e.relatedQuiz.url){const quiz=document.createElement('a');quiz.className='podcast-action';quiz.href=e.relatedQuiz.url;quiz.textContent=e.relatedQuiz.label||'Quiz dashboard';actions.appendChild(quiz)}
    card.appendChild(actions);episodeNode.appendChild(card);
  }
}
async function loadLibrary(){
  try{
    const response=await fetch('podcasts.json?v=1',{cache:'no-cache'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const data=await response.json();
    if(!Array.isArray(data.episodes))throw new Error('Invalid episodes catalog');
    episodes=data.episodes;
    const subjects=[...new Set(episodes.map(e=>e.subject).filter(Boolean))].sort();
    subjects.forEach(subject=>{const option=document.createElement('option');option.value=subject;option.textContent=subject;subjectNode.appendChild(option)});
    subjectNode.addEventListener('change',renderEpisodes);
    renderEpisodes();
  }catch(error){statusNode.textContent='Unable to load the podcast library. Confirm podcasts.json was uploaded alongside podcasts.html.';console.error(error)}
}
loadLibrary();
