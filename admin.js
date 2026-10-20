const API_URL='https://moms-recipes-api.vercel.app/api/manage';
const BASE_RECIPES=RECIPES.map(r=>({...r}));
let cloud={revision:null,overrides:{},deleted:[]},cloudReady=false,adminToken='',editingId=null,newImage=null;
try{adminToken=sessionStorage.getItem('recipes-admin')||'';}catch{}
async function request(body){
 const response=await fetch(API_URL,{method:body?'POST':'GET',cache:'no-store',headers:body?{'Content-Type':'application/json',...(adminToken?{Authorization:'Bearer '+adminToken}:{})}:{},...(body?{body:JSON.stringify(body)}:{})});
 let data;try{data=await response.json();}catch{throw new Error('לא הצלחנו להתחבר למחברת. נסי שוב בעוד רגע.');}
 if(!response.ok){if(response.status===401&&body?.action!=='login'){setToken('');showLogin();}throw new Error(data.error||'לא הצלחנו לשמור. נסי שוב.');}return data;
}
function setToken(value){adminToken=value;try{value?sessionStorage.setItem('recipes-admin',value):sessionStorage.removeItem('recipes-admin');}catch{}document.body.classList.toggle('is-admin',!!value);}
function applyCloud(data){
 cloud=data;cloudReady=true;
 const merged=new Map(BASE_RECIPES.map(r=>[r.id,r]));
 Object.values(data.overrides).forEach(r=>merged.set(r.id,r));data.deleted.forEach(id=>merged.delete(id));
 RECIPES.splice(0,RECIPES.length,...merged.values());
 refreshRecipes();renderAdminList();
 const current=decodeURIComponent(location.hash.slice(1));
 if($('recipe').open){if(RECIPES.some(r=>r.id===current))openRecipe(current);else $('recipe').close();}
 else if(current&&RECIPES.some(r=>r.id===current))openRecipe(current);
}
async function loadCloud(){applyCloud(await request());$('sync-warning').hidden=true;}
function showLogin(){if(!$('admin').open)$('admin').showModal();$('admin-login').hidden=false;$('admin-content').hidden=true;}
async function openAdmin(){
 if(!$('admin').open)$('admin').showModal();$('admin-status').textContent='';
 if(!adminToken){showLogin();return;}
 try{await request({action:'session'});await loadCloud();showManager();}catch(e){$('admin-status').textContent=e.message;}
}
function showManager(){$('admin-login').hidden=true;$('admin-content').hidden=false;setToken(adminToken);renderAdminList();}
function renderAdminList(){
 const list=$('admin-list');if(!list)return;list.replaceChildren();
 const q=norm($('admin-search').value||'');
 const deleted=$('show-deleted').checked;
 const merged=new Map(BASE_RECIPES.map(r=>[r.id,r]));Object.values(cloud.overrides).forEach(r=>merged.set(r.id,r));
 [...merged.values()].filter(r=>cloud.deleted.includes(r.id)===deleted&&norm(r.title).includes(q)).forEach(r=>{
  const row=document.createElement('div');row.className='admin-row';const name=document.createElement('span');name.textContent=r.title;row.append(name);
  const edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.textContent=deleted?'שחזור':'עריכה';edit.onclick=()=>deleted?restore(r.id):editRecipe(r.id);row.append(edit);
  if(!deleted){const del=document.createElement('button');del.type='button';del.className='danger-text';del.textContent='מחיקה';del.onclick=()=>confirmDelete(r);row.append(del);}list.append(row);
 });
 if(!list.children.length)list.textContent=deleted?'אין מתכונים שנמחקו.':'לא נמצאו מתכונים.';
}
function editRecipe(id){
 editingId=id||'recipe-'+crypto.randomUUID();newImage=null;
 const r=id?RECIPES.find(r=>r.id===id):null;
 $('editor-title').textContent=r?'עריכת המתכון':'מתכון חדש למחברת';
 $('recipe-editor').reset();
 for(const name of ['title','category','type','description','note'])$('edit-'+name).value=r?.[name]||({'category':'תוספות',type:'פרווה'}[name]||'');
 if(r&&!['פרווה','חלבי','בשרי'].includes(r.type))$('edit-type').value=r.type.includes('חלבי')?'חלבי':r.type.includes('בשרי')?'בשרי':'פרווה';
 $('edit-ingredients').value=r?.ingredients.join('\n')||'';$('edit-steps').value=r?.steps.join('\n')||'';
 $('edit-status').textContent='';$('editor').showModal();$('edit-title').focus();
}
function confirmDelete(r){$('delete-name').textContent=r.title;$('confirm-delete').dataset.id=r.id;$('delete-status').textContent='';$('delete-confirm').showModal();}
async function mutate(action,id,extra={}){
 if(!cloudReady)throw new Error('יש לרענן את המחברת לפני שמירה.');
 const result=await request({action,id,revision:cloud.revision,...extra});applyCloud(result);return result;
}
async function restore(id){try{await mutate('restore',id);$('admin-status').textContent='המתכון שוחזר ומופיע שוב באתר.';}catch(e){$('admin-status').textContent=e.message;}}
$('open-admin').onclick=openAdmin;$('how-admin').onclick=openAdmin;
$('close-admin').onclick=()=>$('admin').close();$('close-editor').onclick=()=>$('editor').close();$('cancel-delete').onclick=()=>$('delete-confirm').close();
$('admin-login').onsubmit=async e=>{e.preventDefault();const b=$('admin-login').querySelector('button[type=submit]');b.disabled=true;$('admin-status').textContent='מתחברת…';try{const result=await request({action:'login',password:$('admin-password').value});setToken(result.token);$('admin-password').value='';await loadCloud();showManager();$('admin-status').textContent='';}catch(e){$('admin-status').textContent=e.message;}finally{b.disabled=false;}};
$('logout-admin').onclick=()=>{setToken('');showLogin();$('admin-status').textContent='יצאת מאזור הניהול.';};
$('new-recipe').onclick=()=>editRecipe();$('admin-search').oninput=renderAdminList;$('show-deleted').onchange=renderAdminList;
$('refresh-admin').onclick=async()=>{try{await loadCloud();$('admin-status').textContent='הרשימה עודכנה.';}catch(e){$('admin-status').textContent=e.message;}};
$('confirm-delete').onclick=async()=>{const b=$('confirm-delete');b.disabled=true;try{await mutate('delete',b.dataset.id);$('delete-confirm').close();$('admin-status').textContent='המתכון הוסר מהאתר. אפשר לשחזר אותו דרך ״מתכונים שנמחקו״.';}catch(e){$('delete-status').textContent=e.message;}finally{b.disabled=false;}};
$('editor-refresh').onclick=async()=>{try{await loadCloud();$('edit-status').textContent='המחברת עודכנה. הטופס נשאר כפי שהקלדת; בדקי את השינויים לפני שמירה חוזרת.';}catch(e){$('edit-status').textContent=e.message;}};
$('recipe-editor').onsubmit=async e=>{
 e.preventDefault();const b=$('save-recipe');b.disabled=true;$('edit-status').textContent='שומרת במחברת…';
 try{
  const old=RECIPES.find(r=>r.id===editingId)||{};
  const r={...old,id:editingId};for(const name of ['title','category','type','description','note'])r[name]=$('edit-'+name).value.trim();
  r.ingredients=$('edit-ingredients').value.split('\n').map(x=>x.trim()).filter(Boolean);r.steps=$('edit-steps').value.split('\n').map(x=>x.trim()).filter(Boolean);
  if(!r.ingredients.length||!r.steps.length)throw new Error('מלאי מצרכים ושלבי הכנה, כל אחד בשורה נפרדת.');
  if(!old.id)r.image='recipe-placeholder';
  await mutate('save',editingId,{recipe:r,...(newImage?{imageData:newImage}:{})});
  $('editor').close();$('admin-status').textContent='המתכון נשמר ומופיע באתר לכולם.';
 }catch(e){$('edit-status').textContent=e.message;}finally{b.disabled=false;}
};
$('edit-photo').onchange=async()=>{
 const file=$('edit-photo').files[0];newImage=null;if(!file)return;
 if(!file.type.startsWith('image/')||file.size>20*1024*1024){$('edit-status').textContent='בחרי תמונה בגודל של עד 20 מגה.';$('edit-photo').value='';return;}
 $('save-recipe').disabled=true;
 try{const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();newImage=canvas.toDataURL('image/jpeg',.8);if(newImage.length>1400_000)throw new Error();$('edit-status').textContent='התמונה מוכנה ותעלה עם שמירת המתכון.';}catch{newImage=null;$('edit-photo').value='';$('edit-status').textContent='לא הצלחנו לקרוא את התמונה. נסי קובץ JPG או PNG אחר.';}finally{$('save-recipe').disabled=false;}
};
document.addEventListener('click',e=>{const edit=e.target.closest('[data-edit-recipe]');if(edit&&adminToken){$('recipe').close();openAdmin().then(()=>{if(adminToken)editRecipe(edit.dataset.editRecipe);});}});
$('retry-sync').onclick=()=>loadCloud().catch(()=>{});
loadCloud().catch(()=>{$('sync-warning').hidden=false;});
