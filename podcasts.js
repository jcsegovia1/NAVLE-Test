"use strict";
// Independent of the NAVLE quiz engine. No localStorage writes and no external APIs.
const statusNode = document.getElementById('podcastStatus');
const episodeNode = document.getElementById('podcastEpisodes');
const subjectNode = document.getElementById('podcastSubject');
let episodes = [];
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
      label.appendChild(speed);controls.appendChild(label);card.appendChild(controls);
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
