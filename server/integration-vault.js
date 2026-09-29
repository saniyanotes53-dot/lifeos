import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';
import {adminToken} from './reminder-mail.js';
import {readDocument,writeDocument} from './product-store.js';
const path='privateIntegrations/groq';
function encryptionKey(secret=process.env.CRON_SECRET){
 if(typeof secret!=='string'||secret.length<32)throw Object.assign(Error('The server encryption secret needs configuration.'),{status:503});
 return createHmac('sha256',secret).update('lifeos-groq-vault-v1').digest();
}
export function sealKey(value,secret){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(secret),iv);cipher.setAAD(Buffer.from('lifeos:groq:v1'));
 const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 return [iv,encrypted,cipher.getAuthTag()].map(b=>b.toString('base64')).join('.');
}
export function openKey(value,secret){
 const [iv,body,tag]=String(value).split('.').map(v=>Buffer.from(v,'base64'));
 const decipher=createDecipheriv('aes-256-gcm',encryptionKey(secret),iv);decipher.setAAD(Buffer.from('lifeos:groq:v1'));decipher.setAuthTag(tag);
 return Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8');
}
export async function readIntegration(){
 const doc=await readDocument(path,await adminToken());
 return {sealedKey:doc?.fields.sealedKey?.stringValue||'',model:doc?.fields.model?.stringValue||'openai/gpt-oss-20b',revision:doc?.updateTime||'',updatedAt:doc?.fields.updatedAt?.stringValue||''};
}
export async function saveIntegration({sealedKey,model,revision}){
 const updatedAt=new Date().toISOString();
 const next=await writeDocument(path,{sealedKey:{stringValue:sealedKey},model:{stringValue:model},updatedAt:{stringValue:updatedAt}},revision,await adminToken());
 return {configured:!!sealedKey,model,updatedAt,revision:next};
}
export async function privatePython(payload,request=fetch){
 if(!process.env.CRON_SECRET)throw Object.assign(Error('The Python service is not configured.'),{status:503});
 const response=await request('https://lifeos53.vercel.app/api/deliver',{method:'POST',headers:{Authorization:`Bearer ${process.env.CRON_SECRET}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(28000)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(Error(response.status===429?'Groq usage limit reached. Please retry later.':result.error||'The private AI service is temporarily unavailable.'),{status:response.status>=400&&response.status<500?response.status:502});
 return result;
}
