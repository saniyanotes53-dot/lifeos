import {smtpReady} from './delivery.js';
import {SignJWT,importPKCS8} from 'jose';
import {billLedger,validEmail} from '../src/assistant/budget-tools.js';
export const mailReady=()=>Boolean(smtpReady()&&process.env.FIREBASE_SERVICE_ACCOUNT_JSON&&process.env.CRON_SECRET);
export function reminderRecipients(collection,r){
 if(!r.emailReminders||r.settled)return [];
 if(collection==='loans')return validEmail(r.email)&&Number(r.amount)>0?[{email:r.email,text:`${r.person}: ₹${Number(r.amount).toFixed(2)} ${r.type==='lend'?'owed to the sender':'owed by the sender'}. Due ${r.dueDate||'not specified'}.`}]:[];
 const {rows,transfers}=billLedger(r);
 if(!transfers.length)return [];
 return rows.filter(p=>validEmail(r.emails?.[p.name])).map(p=>({email:r.emails[p.name],text:`${r.title}: ${p.name}'s share is ₹${p.amount.toFixed(2)}; already paid ₹${p.paid.toFixed(2)}. ${transfers.filter(d=>d.from===p.name||d.to===p.name).map(d=>`${d.from} owes ${d.to} ₹${d.amount.toFixed(2)}.`).join(' ')||'Your share is settled.'}`}));
}
export async function adminToken(){
 const account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
 if(account.project_id!=='lifeos-61443')throw Error('Wrong Firebase project in mail configuration.');
 const assertion=await new SignJWT({scope:'https://www.googleapis.com/auth/datastore'}).setProtectedHeader({alg:'RS256'}).setIssuer(account.client_email).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('5m').sign(await importPKCS8(account.private_key,'RS256'));
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('Firebase mail credentials could not authenticate.');return (await response.json()).access_token;
}
export function decode(v){if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)]));if('arrayValue'in v)return (v.arrayValue.values||[]).map(decode);if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;return v.stringValue??v.booleanValue??null;}
export async function reminderDocuments(token,collection){
 const r=await fetch('https://firestore.googleapis.com/v1/projects/lifeos-61443/databases/(default)/documents:runQuery',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:{from:[{collectionId:collection,allDescendants:true}],limit:1001}}),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Reminder records could not be read.');const rows=(await r.json()).filter(x=>x.document).map(x=>({...decode({mapValue:{fields:x.document.fields}}),path:x.document.name}));if(rows.length>1000)throw Error('Reminder capacity exceeded; configure pagination before enabling more records.');return rows.filter(x=>/\/documents\/users\/[^/]+\/(loans|billSplits)\/[^/]+$/.test(x.path));
}
