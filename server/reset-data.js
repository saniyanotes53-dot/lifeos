import {requireUser,bearerToken,projectId,fail} from './firebase.js';
export const RESET_SCOPES=Object.freeze({tasks:['tasks','timetable'],budget:['transactions','wallets','categoryBudgets','loans','subscriptions','billSplits'],health:['sleep','workouts','meals','bodyMetrics']});
export function validateReset(body,user,now=Date.now()){
 if(!Object.hasOwn(RESET_SCOPES,body?.scope)||body.confirmation!==`RESET ${body.scope.toUpperCase()}`)throw Object.assign(new Error('Confirm the exact section to reset.'),{status:400});
 if(!Number.isInteger(user.auth_time)||now/1000-user.auth_time>120||user.auth_time>now/1000)throw Object.assign(new Error('Please verify your identity again before resetting.'),{status:401});
 return RESET_SCOPES[body.scope];
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
 try{
 const user=await requireUser(req),collections=validateReset(req.body,user);
 const base=`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
 const headers={Authorization:`Bearer ${bearerToken(req)}`,'Content-Type':'application/json'};
 let deleted=0;
 for(const collection of collections){
  for(let page=0;page<8;page++){
   const response=await fetch(`${base}/users/${encodeURIComponent(user.uid)}/${collection}?pageSize=300`,{headers,signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw new Error('read');
   const {documents=[]}=await response.json();
   if(!documents.length)break;
   const prefix=`projects/${projectId}/databases/(default)/documents/users/${user.uid}/${collection}/`;
   if(documents.some(d=>!d.name.startsWith(prefix)||d.name.slice(prefix.length).includes('/')))throw new Error('scope');
   const commit=await fetch(`${base}:commit`,{method:'POST',headers,body:JSON.stringify({writes:[...documents.map(d=>({delete:d.name,currentDocument:{updateTime:d.updateTime}})),{transform:{document:`projects/${projectId}/databases/(default)/documents/users/${user.uid}`,fieldTransforms:[{fieldPath:'assistantRevision',increment:{integerValue:'1'}}]}}]}),signal:AbortSignal.timeout(8000)});
   if(!commit.ok)throw new Error('commit');
   deleted+=documents.length;
   if(page===7)return res.status(200).json({complete:false,deleted,message:'Some records were removed. Verify again and repeat to finish this large reset.'});
  }
 }
 return res.status(200).json({complete:true,deleted});
 }catch(error){return fail(res,error.status?error:Object.assign(new Error('Reset could not finish. Some records may already be removed; refresh and retry. Your account and other sections were not reset.'),{status:503}));}
}
