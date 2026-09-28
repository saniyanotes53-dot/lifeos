import {createHmac} from 'node:crypto';
import {adminToken,decode} from './reminder-mail.js';
import {readDocument,writeDocument} from './product-store.js';
const encode=data=>Object.fromEntries(Object.entries(data).map(([k,v])=>[k,typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{integerValue:String(v)}:{stringValue:String(v)}]));
// Compare-and-swap protects counters and one-time credentials across function instances.
export async function atomicRecord(path,change,{read=readDocument,write=writeDocument,token}={}){
 const auth=token||await adminToken();
 for(let attempt=0;attempt<5;attempt++){
  const doc=await read(path,auth),current=doc?decode({mapValue:{fields:doc.fields||{}}}):null;
  const next=change(current);
  if(next===null)return null;
  try{await write(path,encode(next),doc?.updateTime,auth);return next;}
  catch(e){if(e.status!==409)throw e;}
 }
 throw Object.assign(Error('Please wait a moment and try again.'),{status:503});
}
export async function persistentLimit(req,scope,max,windowMs,secret,atomic=atomicRecord){
 const ip=String(req.headers?.['x-vercel-forwarded-for']||req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
 const id=createHmac('sha256',secret).update(scope+':'+ip).digest('hex'),now=Date.now();
 await atomic('securityLimits/'+id,old=>{
  const row=old&&old.expiresAt>now?old:{count:0,expiresAt:now+windowMs};
  if(row.count>=max)throw Object.assign(Error('Too many attempts. Please try again later.'),{status:429});
  return {...row,count:row.count+1};
 });
}
