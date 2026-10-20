import {get,put,BlobPreconditionFailedError} from '@vercel/blob';
import {randomUUID,createHmac} from 'node:crypto';
import {passwordMatches,issueToken,validToken,validateRecipe} from '../server/security.js';
const SITE='https://mendylanda.github.io';
const API='https://moms-recipes-api.vercel.app';
const opts={access:'private',addRandomSuffix:false,contentType:'application/json',cacheControlMaxAge:60};
async function read(path){const b=await get(path,{access:'private',useCache:false});return b?{data:await new Response(b.stream).json(),etag:b.blob.etag}:{data:null,etag:null};}
async function loginAllowed(req){
 const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||'unknown').split(',')[0];
 const key=createHmac('sha256',process.env.SESSION_SECRET).update(ip).digest('hex').slice(0,32);
 const path='limits/'+key+'.json';
 for(let i=0;i<5;i++){
  const old=await read(path),now=Date.now();let d=old.data;
  if(!d||now-d.start>15*60_000)d={start:now,count:0};
  if(d.count>=5)return false;
  d.count++;
  try{await put(path,JSON.stringify(d),{...opts,...(old.etag?{ifMatch:old.etag}:{})});return true;}catch(e){if(!(e instanceof BlobPreconditionFailedError)&&!String(e.message).includes('already exists'))throw e;}
 }
 return false;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const origin=req.headers.origin;
 if(origin&&![SITE,API].includes(origin)){res.status(403).json({error:'הגישה אינה מורשית.'});return;}
 if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
 res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
 if(req.method==='OPTIONS'){res.status(204).end();return;}
 try{
  if(req.method==='GET'&&req.query.image){
   if(!/^[a-f0-9-]{36}$/.test(req.query.image)){res.status(400).end();return;}
   const image=await get('images/'+req.query.image+'.jpg',{access:'private'});
   if(!image){res.status(404).end();return;}
   res.setHeader('Content-Type','image/jpeg');res.setHeader('Cache-Control','public,max-age=31536000,immutable');
   res.send(Buffer.from(await new Response(image.stream).arrayBuffer()));return;
  }
  if(req.method==='GET'){const s=await read('content.json');res.json({revision:s.etag,overrides:s.data?.overrides||{},deleted:s.data?.deleted||[]});return;}
  if(req.method!=='POST'){res.status(405).json({error:'בקשה לא נתמכת.'});return;}
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(!body||JSON.stringify(body).length>1800_000){res.status(400).json({error:'הבקשה גדולה מדי.'});return;}
  if(body.action==='login'){
   if(!process.env.PASSWORD_HASH||!process.env.SESSION_SECRET)throw new Error('Missing configuration');
   if(!await loginAllowed(req)){res.status(429).json({error:'בוצעו יותר מדי ניסיונות כניסה. נסי שוב בעוד 15 דקות.'});return;}
   if(!passwordMatches(body.password,process.env.PASSWORD_HASH)){res.status(401).json({error:'הסיסמה שגויה.'});return;}
   res.json({token:issueToken(process.env.SESSION_SECRET)});return;
  }
  if(!validToken(req.headers.authorization?.replace(/^Bearer /,''),process.env.SESSION_SECRET)){res.status(401).json({error:'יש להתחבר שוב כדי לשמור שינויים.'});return;}
  if(body.action==='session'){res.json({ok:true});return;}
  if(!['save','delete','restore'].includes(body.action)){res.status(400).json({error:'פעולה לא מוכרת.'});return;}
  if(typeof body.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(body.id)){res.status(400).json({error:'מזהה לא תקין.'});return;}
  const s=await read('content.json');
  if((body.revision||null)!==s.etag){res.status(409).json({error:'המחברת השתנתה בינתיים. רענני את הרשימה ונסי שוב; הפרטים שהקלדת נשמרו בטופס.'});return;}
  const data=s.data||{overrides:{},deleted:[]};
  let recipe;
  if(body.action==='save'){
   try{recipe=validateRecipe({...body.recipe,id:body.id});}catch(e){res.status(400).json({error:e.message});return;}
   if(body.imageData){
    if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(body.imageData)||body.imageData.length>1400_000){res.status(400).json({error:'התמונה אינה תקינה או גדולה מדי.'});return;}
    const image=Buffer.from(body.imageData.split(',')[1],'base64');
    if(image[0]!==255||image[1]!==216){res.status(400).json({error:'תמונה לא תקינה.'});return;}
    const imageId=randomUUID();await put('images/'+imageId+'.jpg',image,{...opts,contentType:'image/jpeg'});
    recipe.imageUrl=API+'/api/manage?image='+imageId;recipe.imageKind='photo';
   }
  }
  // Keep a private recovery snapshot before each mutation. Deleted recipes use tombstones.
  await put('history/'+Date.now()+'-'+randomUUID()+'.json',JSON.stringify({at:new Date().toISOString(),action:body.action,id:body.id,before:data}),opts);
  if(body.action==='save'){data.overrides[body.id]=recipe;data.deleted=data.deleted.filter(id=>id!==body.id);}
  if(body.action==='delete'&&!data.deleted.includes(body.id))data.deleted.push(body.id);
  if(body.action==='restore')data.deleted=data.deleted.filter(id=>id!==body.id);
  data.updatedAt=new Date().toISOString();
  const saved=await put('content.json',JSON.stringify(data),{...opts,...(s.etag?{ifMatch:s.etag}:{})});
  res.json({revision:saved.etag,overrides:data.overrides,deleted:data.deleted});
 }catch(e){
  if(e instanceof BlobPreconditionFailedError||String(e.message).includes('already exists')){res.status(409).json({error:'בוצע עדכון נוסף במקביל. רענני ונסי שוב.'});return;}
  console.error('Recipe API failure',e.name);
  res.status(503).json({error:'לא הצלחנו לשמור כרגע. הפרטים נשארו בטופס; נסי שוב בעוד רגע.'});
 }
}
