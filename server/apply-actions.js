import {createHash} from 'node:crypto';
import {projectId} from './firebase.js';
import {validateActions} from '../src/assistant/actions.js';
import {buildWrites} from '../src/assistant/build-writes.js';
export {buildWrites};
const problem=message=>Object.assign(new Error(message),{status:409});
const decode=fields=>Object.fromEntries(Object.entries(fields||{}).map(([k,v])=>[k,v.stringValue??v.booleanValue??(v.integerValue!==undefined?Number(v.integerValue):v.doubleValue??null)]));
const encode=data=>Object.fromEntries(Object.entries(data).filter(([,v])=>v!==undefined).map(([k,v])=>[k,v===null?{nullValue:null}:typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v}]));
const fingerprint=actions=>createHash('sha256').update(JSON.stringify(actions)).digest('hex');
export async function applyActions(uid,token,input,request=fetch){
 let actions;try{actions=validateActions(input.actions);}catch(e){throw Object.assign(e,{status:400});}
 if(input.offsets&&(!Object.values(input.offsets).every(v=>Number.isInteger(v)&&Math.abs(v)<=840)||Object.keys(input.offsets).length>20))throw Object.assign(new Error('Invalid timezone information.'),{status:400});
 if(!actions.length||typeof input.proposalId!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(input.proposalId)||!Number.isInteger(input.offset)||Math.abs(input.offset)>840)throw Object.assign(new Error('Invalid confirmation request.'),{status:400});
 const root=`projects/${projectId}/databases/(default)/documents`,parent=`${root}/users/${uid}`,ledger=`${parent}/assistantApplied/${input.proposalId}`,hash=fingerprint(actions);
 async function call(path,body){
  const url='https://firestore.googleapis.com/v1/'+path.split('/').map(p=>encodeURIComponent(p).replace(/%3A/g,':')).join('/');
  const response=await request(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  if(!response.ok){console.error('[assistant.firestore]',{operation:path.split(':').pop(),status:response.status});throw Object.assign(new Error(response.status===403?'Firestore blocked saving. Check your account access.':response.status===409?'Your records changed. Ask for a fresh proposal.':'Could not save changes. You can retry the same confirmation safely.'),{status:response.status===403?403:response.status===409?409:502});}
  return response.json();
 }
 const {transaction}=await call(`${root}:beginTransaction`,{options:{readWrite:{}}});
 try{
  const prior=await call(`${root}:batchGet`,{transaction,documents:[ledger]});
  if(prior[0]?.found){if(decode(prior[0].found.fields).hash!==hash)throw problem('This confirmation ID was already used for a different proposal.');await call(`${root}:rollback`,{transaction});return {ok:true,alreadyApplied:true};}
  const snapshot={};
  for(const collection of ['tasks','timetable','categoryBudgets','transactions']){
   const rows=await call(`${parent}:runQuery`,{transaction,structuredQuery:{from:[{collectionId:collection}],limit:1001}});
   snapshot[collection]=rows.filter(r=>r.document).map(r=>({id:r.document.name.split('/').pop(),...decode(r.document.fields)}));
   if(snapshot[collection].length>1000)throw problem('This account has too many records for a single assistant edit. Use the individual screen controls.');
  }
  const changes=buildWrites(actions,snapshot,input.proposalId,input.offset,Date.now(),input.offsets||{});
  if(changes.length>450)throw problem('Too many linked records would change. Confirm a smaller proposal.');
  const writes=changes.map(c=>c.delete?{delete:`${parent}/${c.collection}/${c.id}`}:{update:{name:`${parent}/${c.collection}/${c.id}`,fields:encode(c.data)},updateMask:{fieldPaths:Object.keys(c.data)}});
  writes.push({update:{name:ledger,fields:encode({hash,appliedAt:Date.now(),count:changes.length})},currentDocument:{exists:false}});
  await call(`${root}:commit`,{transaction,writes});return {ok:true,count:changes.length};
 }catch(e){await call(`${root}:rollback`,{transaction}).catch(()=>{});throw e;}
}
