// Run manually with production Blob env and password on stdin. Uses only an existing temporary test recipe.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {get,put,del} from '@vercel/blob';
const url='https://moms-recipes-api.vercel.app/api/manage';
const password=readFileSync(0,'utf8').trim();let token='',testId='',imageId='';
async function post(body,auth=true){return fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});}
async function state(){return (await fetch(url,{cache:'no-store'})).json();}
try{
 assert.equal((await post({action:'delete',id:'asado'},false)).status,401);
 assert.equal((await fetch(url,{headers:{Origin:'https://example.org'}})).status,403);
 const preflight=await fetch(url,{method:'OPTIONS',headers:{Origin:'https://mendylanda.github.io'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://mendylanda.github.io');
 const login=await post({action:'login',password},false);assert.equal(login.status,200);token=(await login.json()).token;
 let data=await state();const r=Object.values(data.overrides).find(r=>r.title.startsWith('בדיקת מערכת זמנית'));assert.ok(r,'temporary UI recipe must exist');testId=r.id;assert.ok(data.deleted.includes(testId),'UI delete persisted');
 let response=await post({action:'restore',id:testId,revision:data.revision});assert.equal(response.status,200);data=await response.json();assert.ok(!data.deleted.includes(testId));
 const stale=data.revision;
 response=await post({action:'save',id:testId,revision:data.revision,recipe:r,imageData:'data:image/jpeg;base64,'+readFileSync('assets/asado.jpg').toString('base64')});assert.equal(response.status,200);data=await response.json();const imageUrl=data.overrides[testId].imageUrl;imageId=new URL(imageUrl).searchParams.get('image');
 const image=await fetch(imageUrl);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/jpeg');assert.ok((await image.arrayBuffer()).byteLength>1000);
 response=await post({action:'delete',id:testId,revision:stale});assert.equal(response.status,409);
 response=await post({action:'save',id:testId,revision:data.revision,recipe:{...r,ingredients:[]}});assert.equal(response.status,400);
 const publicState=await state();assert.equal(publicState.overrides[testId].title,r.title);assert.ok(!JSON.stringify(publicState).includes(password));
 console.log('PASS: auth, origin/CORS, durable UI add/edit/delete, restore, photo upload/retrieval, conflict and invalid-input rejection.');
}finally{
 if(testId){
  const current=await get('content.json',{access:'private',useCache:false});const data=await new Response(current.stream).json();delete data.overrides[testId];data.deleted=data.deleted.filter(id=>id!==testId);
  await put('content.json',JSON.stringify(data),{access:'private',addRandomSuffix:false,contentType:'application/json',ifMatch:current.blob.etag});
  if(imageId)await del('images/'+imageId+'.jpg');
  console.log('Temporary recipe and test image removed; real recipes untouched.');
 }
}
