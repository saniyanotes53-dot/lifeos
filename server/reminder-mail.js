import {smtpReady} from './delivery.js';
import {SignJWT,importPKCS8} from 'jose';
import {billLedger,validEmail} from '../src/assistant/budget-tools.js';
export const mailReady=()=>Boolean(smtpReady()&&process.env.FIREBASE_SERVICE_ACCOUNT_JSON&&process.env.CRON_SECRET);
const cleanName=value=>String(value||'').replace(/[\r\n\x00-\x1f]/g,' ').trim().slice(0,80);
export async function reminderOwner(token,uid,request=fetch){
 if(!/^[^/]{1,128}$/.test(uid))throw Error('Invalid reminder owner.');
 const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
 const [profileResponse,authResponse]=await Promise.all([
  request(`https://firestore.googleapis.com/v1/projects/lifeos-61443/databases/(default)/documents/users/${encodeURIComponent(uid)}`,{headers,signal:AbortSignal.timeout(8000)}),
  request('https://identitytoolkit.googleapis.com/v1/projects/lifeos-61443/accounts:lookup',{method:'POST',headers,body:JSON.stringify({localId:[uid]}),signal:AbortSignal.timeout(8000)})
 ]);
 if(!authResponse.ok||(!profileResponse.ok&&profileResponse.status!==404))throw Error('Could not verify payment reminder owner.');
 const account=(await authResponse.json()).users?.find(u=>u.localId===uid);
 if(!account||account.disabled)return null;
 const profile=profileResponse.ok?decode({mapValue:{fields:(await profileResponse.json()).fields||{}}}):{};
 const email=account.emailVerified&&validEmail(account.email)?account.email:'';
 const candidate=cleanName(profile.displayName);
 const name=(candidate&&candidate!=='User'?candidate:cleanName(account.displayName))||email;
 return name?{name,email,uid}:null;
}
export function reminderRecipients(collection,r,owner={name:'Account owner',email:''}){
 if(!r.emailReminders||r.settled)return [];
 const senderName=cleanName(owner.name),senderEmail=owner.email||'';
 const identity={senderName,senderEmail};
 if(collection==='loans'){
  if(!['lend','borrow'].includes(r.type)||!validEmail(r.email)||!Number.isFinite(Number(r.amount))||Number(r.amount)<=0)return [];
  const person=cleanName(r.person)||'Contact';
  const borrower=r.type==='lend'?person:senderName,lender=r.type==='lend'?senderName:person;
  return [{...identity,email:r.email,name:person,title:'Loan repayment',kind:r.type==='lend'?'payable':'receivable',borrower,lender,dueDate:r.dueDate,text:`${borrower} owes ${lender} ₹${Number(r.amount).toFixed(2)}.`}];
 }
 const {rows,transfers}=billLedger(r);
 if(!transfers.length)return [];
 return rows.filter(p=>validEmail(r.emails?.[p.name])&&transfers.some(d=>d.from===p.name||d.to===p.name)).map(p=>{
  const relevant=transfers.filter(d=>d.from===p.name||d.to===p.name);
  return {...identity,email:r.emails[p.name],name:p.name,title:r.title,kind:p.net>0?'receivable':'payable',borrower:[...new Set(relevant.map(d=>d.from))].join(', '),lender:[...new Set(relevant.map(d=>d.to))].join(', '),dueDate:r.dueDate,text:`${p.name}'s share is ₹${p.amount.toFixed(2)}; already paid ₹${p.paid.toFixed(2)}. ${relevant.map(d=>`${d.from} owes ${d.to} ₹${d.amount.toFixed(2)}.`).join(' ')}`};
 });
}
export async function adminToken(scope='https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit'){
 const account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
 if(account.project_id!=='lifeos-61443')throw Error('Wrong Firebase project in mail configuration.');
 const assertion=await new SignJWT({scope}).setProtectedHeader({alg:'RS256'}).setIssuer(account.client_email).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('5m').sign(await importPKCS8(account.private_key,'RS256'));
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('Firebase mail credentials could not authenticate.');return (await response.json()).access_token;
}
export function decode(v){if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)]));if('arrayValue'in v)return (v.arrayValue.values||[]).map(decode);if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;return v.stringValue??v.booleanValue??null;}
export async function reminderDocuments(token,collection){
 const r=await fetch('https://firestore.googleapis.com/v1/projects/lifeos-61443/databases/(default)/documents:runQuery',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:{from:[{collectionId:collection,allDescendants:true}],limit:1001}}),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Reminder records could not be read.');const rows=(await r.json()).filter(x=>x.document).map(x=>({...decode({mapValue:{fields:x.document.fields}}),path:x.document.name}));if(rows.length>1000)throw Error('Reminder capacity exceeded; configure pagination before enabling more records.');return rows.filter(x=>/\/documents\/users\/[^/]+\/(loans|billSplits)\/[^/]+$/.test(x.path));
}
