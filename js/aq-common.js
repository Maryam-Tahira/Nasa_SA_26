// AstroQuest: helpers shared by every page. All real work (data, grading, XP, badges) happens on the server.
function aqFetch(u,o){return fetch(u,o).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r})}
const aqPost=(u,b)=>aqFetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function aqToast(msg){
  let box=document.getElementById('aqToasts');
  if(!box){box=document.createElement('div');box.id='aqToasts';document.body.appendChild(box)}
  const t=document.createElement('div');t.className='aq-toast';t.textContent=msg;box.appendChild(t);
  setTimeout(()=>t.remove(),3800)}

function aqBadges(list){(list||[]).forEach((b,i)=>setTimeout(()=>aqToast(`${b.icon} Badge unlocked: ${b.name}`),700+i*1900))}

function aqFatal(msg){
  document.body.insertAdjacentHTML('afterbegin',`<div class="aq-fatal"><div><h2>⚠️ Mission Control offline</h2><p>${esc(msg)}</p></div></div>`)}

// First visit to a world = XP (only for logged-in users; the server decides).
function aqExplore(n){
  if(!window.AQ||!AQ.auth)return;
  aqPost('/api/progress/explore',{planet:n}).then(r=>r.json()).then(d=>{
    if(d.xpEarned>0){AQ.xp=d.totalXp;AQ.rank=d.rank;aqToast(`🛰️ First visit to ${n}! +${d.xpEarned} XP · ${d.rank}`)}
    aqBadges(d.newBadges)}).catch(()=>{})}

// Moon Base mission: the server recomputes the score from the five resource levels.
async function aqSaveMission(res){
  if(!window.AQ||!AQ.auth){aqToast('Log in to save your mission score on the leaderboard');return}
  try{const d=await aqPost('/api/mission/moon',res).then(r=>r.json());
    AQ.xp=d.totalXp;AQ.rank=d.rank;
    aqToast(`Mission saved · ${d.score}% · +${d.xpEarned} XP · ${d.rank}`);aqBadges(d.newBadges)}
  catch(e){aqToast('Could not save the mission result')}}
