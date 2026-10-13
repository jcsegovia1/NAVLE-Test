'use strict';
// Podcast state never uses the quiz progress key (navle-study-lab-v1).
const $=id=>document.getElementById(id);
const audio=$('mainAudio'),list=$('podcastEpisodes'),status=$('podcastStatus');
const PREFIX='navle-podcast-v5:';
const TIME_PREFIX='navle-podcast-position-v1:'; // compatible with the earlier podcast add-on
let episodes=[],selectedIndex=0,lastSave=0,restorePending=false,currentlyAvailable=true;
const read=(key,fall='')=>{try{return localStorage.getItem(key)??fall}catch{return fall}};
const store=(key,value)=>{try{localStorage.setItem(key,String(value))}catch{}};
const del=key=>{try{localStorage.removeItem(key)}catch{}};
const number=e=>String(e.episode).padStart(2,'0');
const progressKey=e=>TIME_PREFIX+(e.id||e.audioUrl);
const doneKey=e=>PREFIX+'done:'+number(e);
const completed=e=>read(doneKey(e))==='1';
const fmt=s=>{if(!Number.isFinite(s)||s<0)return '—';s=Math.floor(s);return s>=3600?`${Math.floor(s/3600)}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`:`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`};
function current(){return episodes[selectedIndex]}
function savedSeconds(e){let raw=read(progressKey(e));if(!raw&&e.episode===1)raw=read(TIME_PREFIX+'bella-edward-001','0');let n=Number(raw||0);return Number.isFinite(n)&&n>0?n:0}
function setComplete(e,value){value?store(doneKey(e),'1'):del(doneKey(e));if(value)del(progressKey(e));updateStats();renderList();updateState()}
function updateState(){const e=current();if(!e)return;$('nowState').textContent=completed(e)?'Completed':(savedSeconds(e)>4?'In progress':'Not completed');$('markComplete').textContent=completed(e)?'Mark incomplete':'Mark complete'}
function updateStats(){$('completedCount').textContent=`${episodes.filter(completed).length} / ${episodes.length} completed`}
function save(){const e=current();if(!e||audio.ended||!Number.isFinite(audio.currentTime)||audio.currentTime<2)return;if(audio.ended||(Number.isFinite(audio.duration)&&audio.duration>0&&audio.currentTime>=audio.duration-3))return;
 store(progressKey(e),Math.floor(audio.currentTime));store(PREFIX+'last',number(e));lastSave=audio.currentTime}
function resetAudio(){audio.pause();audio.removeAttribute('src');audio.load();restorePending=false;currentlyAvailable=true;$('audioWarning').hidden=true;$('timeReadout').textContent='0:00 / —'}
function selectEpisode(index,{updateHash=true,scroll=false}={}){if(index<0||index>=episodes.length)return;save();resetAudio();selectedIndex=index;const e=current();store(PREFIX+'last',number(e));
 $('nowNumber').textContent=`Episode ${number(e)} of ${episodes.length}`;$('nowTitle').textContent=e.title;$('nowDetail').textContent=`${e.subject} · Alex & Maya`;
 $('downloadEpisode').href=e.audioUrl;$('downloadEpisode').download=e.filename;$('relatedQuiz').href=e.relatedQuiz?.url||'index.html';
 $('relatedQuiz').textContent=e.relatedQuiz?.label||'Practice questions';
 $('resumeReadout').textContent=savedSeconds(e)>=5?`Saved at ${fmt(savedSeconds(e))}`:'Playback starts at the beginning';
 // Do not autoplay. Metadata fetch determines real duration from the uploaded MP3.
 audio.src=e.audioUrl;audio.playbackRate=Number($('podcastSpeed').value);restorePending=true;audio.load();
 updateState();renderList();if(updateHash)history.replaceState(null,'','#episode-'+number(e));if(scroll)$('playerPanel').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderList(){const filter=$('podcastSubject').value,query=$('podcastSearch').value.trim().toLowerCase();list.replaceChildren();let count=0;
 episodes.forEach((e,i)=>{if(filter!=='all'&&e.subject!==filter)return;if(query&&!`${e.title} ${e.subject} ${e.episode}`.toLowerCase().includes(query))return;count++;
 const row=document.createElement('article');row.className='podcast-episode'+(selectedIndex===i?' selected':'');row.id='list-episode-'+number(e);
 const button=document.createElement('button');button.type='button';button.className='podcast-episode-select';button.setAttribute('aria-current',selectedIndex===i?'true':'false');
 const heading=document.createElement('strong');heading.textContent=`${number(e)} · ${e.title}`;const meta=document.createElement('span');meta.textContent=e.subject+' · '+(completed(e)?'✓ Completed':savedSeconds(e)>5?'Resume at '+fmt(savedSeconds(e)):'Not completed');
 button.append(heading,meta);button.addEventListener('click',()=>selectEpisode(i,{scroll:true}));row.appendChild(button);
 const link=document.createElement('a');link.href=e.audioUrl;link.download=e.filename;link.className='podcast-episode-download';link.textContent='↓ MP3';link.setAttribute('aria-label','Download '+e.title);row.appendChild(link);list.appendChild(row) });
 status.textContent=count?'': 'No episodes match the selected filters.';updateStats()}
function warn(){currentlyAvailable=false;$('audioWarning').hidden=false;$('audioWarning').textContent=`Audio file not available yet: ${current().audioUrl}. Upload this MP3 to your repository's audio/ folder, including the exact capitalization.`}
audio.addEventListener('loadedmetadata',()=>{const e=current(),saved=savedSeconds(e),duration=audio.duration;
 if(restorePending){restorePending=false;if(saved>=5&&(!Number.isFinite(duration)||saved<duration-5)){try{audio.currentTime=saved;$('resumeReadout').textContent='Resumed at '+fmt(saved)}catch{}}else if(saved>0&&Number.isFinite(duration)&&saved>=duration-5)del(progressKey(e))}
 $('timeReadout').textContent=fmt(audio.currentTime)+' / '+fmt(duration);$('audioWarning').hidden=true;currentlyAvailable=true});
audio.addEventListener('timeupdate',()=>{const e=current();if(!e)return;$('timeReadout').textContent=fmt(audio.currentTime)+' / '+fmt(audio.duration);if(Math.abs(audio.currentTime-lastSave)>=5){save();updateState()}});
audio.addEventListener('pause',save);audio.addEventListener('seeking',save);audio.addEventListener('ratechange',()=>{if(audio.playbackRate!==Number($('podcastSpeed').value))audio.playbackRate=Number($('podcastSpeed').value)});
audio.addEventListener('ended',()=>{const e=current();del(progressKey(e));if(e.episode===1)del(TIME_PREFIX+'bella-edward-001');setComplete(e,true);$('resumeReadout').textContent='Episode finished';$('timeReadout').textContent=fmt(audio.duration)+' / '+fmt(audio.duration)});
audio.addEventListener('error',()=>{if(audio.getAttribute('src'))warn()});
window.addEventListener('pagehide',save);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save()});
$('podcastSpeed').addEventListener('change',()=>{audio.playbackRate=Number($('podcastSpeed').value)});
$('prevEpisode').addEventListener('click',()=>selectEpisode(selectedIndex-1));$('nextEpisode').addEventListener('click',()=>selectEpisode(selectedIndex+1));
$('startOver').addEventListener('click',()=>{const e=current();if(!e)return;del(progressKey(e));try{audio.currentTime=0}catch{}$('resumeReadout').textContent='Started over';updateState();renderList()});
$('markComplete').addEventListener('click',()=>setComplete(current(),!completed(current())));
$('podcastSubject').addEventListener('change',renderList);$('podcastSearch').addEventListener('input',renderList);
async function start(){try{const response=await fetch('podcasts.json?v=6',{cache:'no-cache'});if(!response.ok)throw Error('HTTP '+response.status);const doc=await response.json();if(!Array.isArray(doc.episodes)||doc.episodes.length!==25)throw Error('Expected 25 episodes');episodes=doc.episodes;
 const subjects=[...new Set(episodes.map(e=>e.subject))].sort((a,b)=>a.localeCompare(b));for(const s of subjects){const o=document.createElement('option');o.value=s;o.textContent=s;$('podcastSubject').appendChild(o)}
 const hash=location.hash.match(/^#episode-(\d{2})$/);const chosen=hash?Number(hash[1]):Number(read(PREFIX+'last','1'));const i=episodes.findIndex(e=>e.episode===chosen);selectEpisode(i>=0?i:0,{updateHash:false});window.addEventListener('hashchange',()=>{const match=location.hash.match(/^#episode-(\d{2})$/);if(match){const i=episodes.findIndex(e=>e.episode===Number(match[1]));if(i>=0&&i!==selectedIndex)selectEpisode(i,{updateHash:false})}});
 status.textContent='';}catch(err){status.textContent='Could not load the 25-episode library. Make sure podcasts.json is in the same folder as podcasts.html.';console.error(err)}}
start();
