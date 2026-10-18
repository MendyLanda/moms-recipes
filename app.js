const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s).normalize('NFD').replace(/[\u0591-\u05C7]/g,'').replace(/[׳״'"]/g,'').replace(/[־–—-]/g,' ').replace(/\s+/g,' ').toLowerCase();
let category='הכול',tipCategory='הכול';
const priority=['chocolate-cake','apple-cake','quinoa-cake'];
const sorted=[...RECIPES].sort((a,b)=>(priority.includes(a.id)?priority.indexOf(a.id):-1) < 0 ? (priority.includes(b.id)?1:0) : (priority.includes(b.id)?priority.indexOf(a.id)-priority.indexOf(b.id):-1));
const photo=r=>`assets/${r.image||r.id}.jpg`;
function filters(target,values,get,set){values.forEach(c=>{const b=document.createElement('button');b.textContent=c;b.setAttribute('aria-pressed',String(get()===c));b.onclick=()=>{set(c);[...$(target).children].forEach(x=>x.setAttribute('aria-pressed',String(x.textContent===c)))};$(target).append(b)})}
filters('filters',['הכול',...new Set(RECIPES.map(r=>r.category))],()=>category,c=>{category=c;render()});
filters('tip-filters',['הכול',...new Set(TIPS.map(r=>r.category))],()=>tipCategory,c=>{tipCategory=c;renderTips()});
$('total-count').textContent=RECIPES.length;
function render(){const q=norm($('search').value.trim());const rows=sorted.filter(r=>(category==='הכול'||category===r.category)&&norm([r.title,r.title.replace(/עוגת/g,'עוגה'),r.description,r.category,...r.ingredients].join(' ')).includes(q));$('count').textContent=rows.length+' מתכונים במחברת';$('empty').hidden=rows.length>0;$('cards').replaceChildren();rows.forEach(r=>{const b=document.createElement('button');b.className='card';b.setAttribute('aria-label','למתכון '+r.title);b.innerHTML=`<img class="card-photo" src="${esc(photo(r))}" alt="המחשה של ${esc(r.title)}" loading="lazy" width="600" height="420"><span class="card-body"><span class="tag">${esc(r.category)} · ${esc(r.type)}</span><h3>${esc(r.title)}</h3><p>${esc(r.description)}</p><span class="go">למתכון המלא <span aria-hidden="true">↙</span></span></span>`;b.onclick=()=>openRecipe(r.id);$('cards').append(b)})}
function renderTips(){const q=norm($('tip-search').value.trim());const rows=TIPS.filter(t=>(tipCategory==='הכול'||t.category===tipCategory)&&norm([t.title,t.text,t.category].join(' ')).includes(q));$('tip-cards').replaceChildren();$('tips-empty').hidden=rows.length>0;rows.forEach(t=>{const el=document.createElement('article');el.className='tip';el.innerHTML=`<span class="tag">${esc(t.category)}</span><h3>${esc(t.title)}</h3><p>${esc(t.text)}</p>${t.recipe?`<a href="#${esc(t.recipe)}" data-recipe="${esc(t.recipe)}">למתכון שקשור לטיפ ←</a>`:`<a href="https://chatgpt.com/c/${encodeURIComponent(t.source)}" target="_blank" rel="noopener">לשיחה המקורית ↗</a>`}`;$('tip-cards').append(el)})}
function openRecipe(id){const r=RECIPES.find(r=>r.id===id);if(!r)return;$('copy-status').textContent='';$('detail').innerHTML=`<img class="detail-photo" src="${esc(photo(r))}" alt="המחשה של ${esc(r.title)}"><p class="detail-caption">תמונת המחשה שנוצרה ב־AI</p><div class="detail-header"><p class="eyebrow">${esc(r.category)} · ${esc(r.type)}</p><h2 id="recipe-title">${esc(r.title)}</h2><p>${esc(r.description)}</p></div><h3>מה צריך?</h3><ul>${r.ingredients.map(s=>`<li><label><input type="checkbox"><span>${esc(s)}</span></label></li>`).join('')}</ul><h3>איך מכינים?</h3><ol>${r.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>${r.note?`<p class="note">${esc(r.note)}</p>`:''}<p><a href="https://chatgpt.com/c/${encodeURIComponent(r.source)}" target="_blank" rel="noopener">בחזרה לשיחה המקורית ↗</a></p>`;if(!$('recipe').open)$('recipe').showModal();$('recipe').scrollTop=0;history.replaceState(null,'','#'+id)}
$('search').oninput=render;$('tip-search').oninput=renderTips;
$('close').onclick=()=>$('recipe').close();
$('recipe').addEventListener('close',()=>history.replaceState(null,'',location.pathname+'#recipes'));
$('print').onclick=()=>window.print();
$('copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('copy-status').textContent='הקישור הועתק'}catch{$('copy-status').textContent='אפשר להעתיק את כתובת המתכון משורת הכתובת'}};
$('recipe').addEventListener('click',e=>{if(e.target===$('recipe')){const b=$('recipe').getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)$('recipe').close()}});
document.addEventListener('click',e=>{const target=e.target.closest('[data-recipe]');if(target){e.preventDefault();openRecipe(target.dataset.recipe)}});
window.addEventListener('hashchange',()=>{const id=decodeURIComponent(location.hash.slice(1));if(RECIPES.some(r=>r.id===id))openRecipe(id)});
render();renderTips();if(location.hash)openRecipe(decodeURIComponent(location.hash.slice(1)));

// Restore section anchors after the recipe and tip lists have been populated.
if(["#recipes","#tips","#how"].includes(location.hash)){requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView({behavior:"instant"}));}

document.addEventListener("click",async e=>{const b=e.target.closest("[data-copy]");if(!b)return;const text=document.getElementById(b.dataset.copy).textContent;try{await navigator.clipboard.writeText(text);$("message-copy-status").textContent="ההודעה הועתקה. עכשיו הדביקי אותה בשיחת ניהול האתר והוסיפי את המתכון או הקישור."}catch{$("message-copy-status").textContent="לא הצלחנו להעתיק אוטומטית. סמני את נוסח ההודעה והעתיקי אותו ידנית."}});
