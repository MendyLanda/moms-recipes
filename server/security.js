import { scryptSync, timingSafeEqual, createHmac, randomBytes } from 'node:crypto';
export function passwordMatches(password, stored) {
  if(typeof password!=='string'||password.length>128||!stored)return false;
  const [salt,hash]=stored.split(':');
  if(!salt||!hash||hash.length!==128)return false;
  const actual=scryptSync(password,salt,64);
  return timingSafeEqual(actual,Buffer.from(hash,'hex'));
}
export function issueToken(secret,now=Date.now()) {
  const payload=Buffer.from(JSON.stringify({exp:now+8*3600_000,nonce:randomBytes(16).toString('hex')})).toString('base64url');
  return payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url');
}
export function validToken(token,secret,now=Date.now()) {
  if(!secret||typeof token!=='string'||token.length>1000)return false;
  const [p,s,...extra]=token.split('.');if(!p||!s||extra.length)return false;
  const expected=createHmac('sha256',secret).update(p).digest();
  try {const signature=Buffer.from(s,'base64url');return signature.length===expected.length&&timingSafeEqual(signature,expected)&&JSON.parse(Buffer.from(p,'base64url')).exp>now;}catch{return false;}
}
export function validateRecipe(input) {
  const text=(v,max,required=false)=>{if(typeof v!=='string'||v.length>max||required&&!v.trim())throw new Error('חסרים פרטים או שהטקסט ארוך מדי.');return v.trim();};
  const lines=v=>{if(!Array.isArray(v)||v.length<1||v.length>150)throw new Error('יש למלא מצרכים ושלבי הכנה.');return v.map(x=>text(x,2000,true));};
  const r={id:text(input.id,80,true),title:text(input.title,150,true),category:text(input.category,60,true),type:text(input.type,20,true),description:text(input.description||'',600),ingredients:lines(input.ingredients),steps:lines(input.steps),note:text(input.note||'',4000)};
  if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(r.id)||!['בשרי','חלבי','פרווה'].includes(r.type))throw new Error('פרטי המתכון אינם תקינים.');
  if(input.source){if(!/^[a-f0-9-]{36}$/.test(input.source))throw new Error('מקור לא תקין.');r.source=input.source;}
  if(input.image){if(!/^[a-z0-9-]+$/.test(input.image))throw new Error('תמונה לא תקינה.');r.image=input.image;}
  if(input.imageUrl){if(!/^https:\/\/moms-recipes-api\.vercel\.app\/api\/manage\?image=[a-f0-9-]{36}$/.test(input.imageUrl))throw new Error('תמונה לא תקינה.');r.imageUrl=input.imageUrl;}
  if(input.imageKind==='photo')r.imageKind='photo';
  return r;
}
