import {createHash} from 'node:crypto';
import {projectId} from './firebase.js';
import {validateActions} from '../src/assistant/actions.js';
import {interval,overlaps} from '../src/assistant/planner.js';
const problem=message=>Object.assign(new Error(message),{status:409});
const decode=fields=>Object.fromEntries(Object.entries(fields||{}).map(([k,v])=>[k,v.stringValue??v.booleanValue??(v.integerValue!==undefined?Number(v.integerValue):v.doubleValue??null)]));
const encode=data=>Object.fromEntries(Object.entries(data).filter(([,v])=>v!==undefined).map(([k,v])=>[k,v===null?{nullValue:null}:typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v}]));
const fingerprint=actions=>createHash('sha256').update(JSON.stringify(actions)).digest('hex');
export function buildWrites(actions,snapshot,proposalId,offset,now=Date.now(),offsets={}){
 const changes=new Map(),created=new Map();
 const tasks=new Map(snapshot.tasks.map(d=>[d.id,{...d}])),blocks=new Map(snapshot.timetable.map(d=>[d.id,{...d}])),budgets=new Map(snapshot.categoryBudgets.map(d=>[d.id,{...d}]));
 const unique=(kind,id)=>`${kind}/${id}`;
 const newId=ref=>'ai_'+createHash('sha256').update(`${proposalId}:${ref}`).digest('hex').slice(0,32);
 function write(collection,id,data){const key=unique(collection,id);changes.set(key,{collection,id,data:{...changes.get(key)?.data,...data}});}
 function unchanged(current,before,keys){
  if(!current||keys.some(k=>(current[k]??null)!==(before[k]??null)))throw problem('A record changed since this proposal. Ask for a fresh plan.');
 }
 const updated=new Set();
 for(const a of actions){
  if(a.id){const target=(a.type==='update_task'?'tasks':a.type==='move_block'?'timetable':'categoryBudgets')+'/'+a.id;if(updated.has(target))throw problem('The plan changes the same record twice. Ask for a simpler plan.');updated.add(target);}
  if(a.type==='create_task'){
   const id=newId(a.ref);if(tasks.has(id))throw problem('This task already exists.');
   const date=new Date(now-offset*60000).toISOString().slice(0,10),data={title:a.title,priority:a.priority,done:false,date,source:'assistant'};
   created.set(a.ref,id);tasks.set(id,{id,...data});write('tasks',id,data);
  }
  if(a.type==='update_task'){
   const current=tasks.get(a.id);unchanged(current,a.before,['title','priority','done']);
   const id=current.id,data={title:a.title,priority:a.priority,done:a.done};tasks.set(id,{...current,...data});write('tasks',id,data);
   if(current.done!==a.done)for(const b of blocks.values())if(b.taskId===id){b.done=a.done;write('timetable',b.id,{done:a.done});}
  }
  if(a.type==='set_budget'){
   let id=a.id||newId(a.ref),current=budgets.get(id);
   if(a.id)unchanged(current,a.before,['category','limit']);
   if([...budgets.values()].some(b=>b.id!==id&&b.category?.toLowerCase()===a.category.toLowerCase()))throw problem('That category already has a budget. Ask to update it instead.');
   const data={category:a.category,limit:a.limit};budgets.set(id,{id,...data});write('categoryBudgets',id,data);
  }
 }
 // Remove all moved blocks from occupancy first, so a confirmed swap is valid.
 const moving=new Set(actions.filter(a=>a.type==='move_block').map(a=>a.id));
 const occupied=[...blocks.values()].filter(b=>!moving.has(b.id));
 for(const a of actions.filter(a=>['schedule_task','move_block'].includes(a.type))){
  let id,taskId,data;
  if(a.type==='move_block'){
   const current=blocks.get(a.id);unchanged(current,a.before,['date','time','label','durationMinutes','taskId','done']);
   if(current.done)throw problem('Completed blocks cannot be moved.');
   id=a.id;taskId=current.taskId;data={done:current.done};if(taskId)data.taskId=taskId;
  }else{
   id=newId(a.ref);taskId=created.get(a.taskId)||a.taskId;
   if(!tasks.has(taskId)||tasks.get(taskId).done)throw problem('A scheduled task no longer exists or is completed.');
   data={taskId,done:false,source:'assistant'};
  }
  const [y,m,d]=a.date.split('-').map(Number),[h,min]=a.time.split(':').map(Number);
  const remindAt=Date.UTC(y,m-1,d,h,min)+(offsets[a.ref]??offset)*60000;
  if(remindAt<=now||remindAt>now+366*86400000)throw problem('A proposed time is in the past or too far ahead. Ask for a fresh plan.');
  const range=interval(a),day=occupied.filter(b=>b.date===a.date);
  if(day.some(b=>!Number.isFinite(interval(b).start)||overlaps(range,interval(b))||(taskId&&b.taskId===taskId)))throw problem('The timetable has a conflicting block. Ask for a fresh plan.');
  Object.assign(data,{date:a.date,time:a.time,label:a.title,durationMinutes:a.durationMinutes,remindAt});occupied.push({id,...data});write('timetable',id,data);
 }
 return [...changes.values()];
}
export async function applyActions(uid,token,input,request=fetch){
 let actions;try{actions=validateActions(input.actions);}catch(e){throw Object.assign(e,{status:400});}
 if(input.offsets&&(!Object.values(input.offsets).every(v=>Number.isInteger(v)&&Math.abs(v)<=840)||Object.keys(input.offsets).length>20))throw Object.assign(new Error('Invalid timezone information.'),{status:400});
 if(!actions.length||typeof input.proposalId!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(input.proposalId)||!Number.isInteger(input.offset)||Math.abs(input.offset)>840)throw Object.assign(new Error('Invalid confirmation request.'),{status:400});
 const root=`projects/${projectId}/databases/(default)/documents`,parent=`${root}/users/${uid}`,ledger=`${parent}/assistantApplied/${input.proposalId}`,hash=fingerprint(actions);
 async function call(path,body){
  const url='https://firestore.googleapis.com/v1/'+path.split('/').map(p=>encodeURIComponent(p).replace(/%3A/g,':')).join('/');
  const response=await request(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Object.assign(new Error(response.status===403?'Firestore blocked saving. Check your account access.':response.status===409?'Your records changed. Ask for a fresh proposal.':'Could not save changes. You can retry the same confirmation safely.'),{status:response.status===403?403:response.status===409?409:502});
  return response.json();
 }
 const {transaction}=await call(`${root}:beginTransaction`,{options:{readWrite:{}}});
 try{
  const prior=await call(`${root}:batchGet`,{transaction,documents:[ledger]});
  if(prior[0]?.found){if(decode(prior[0].found.fields).hash!==hash)throw problem('This confirmation ID was already used for a different proposal.');await call(`${root}:rollback`,{transaction});return {ok:true,alreadyApplied:true};}
  const snapshot={};
  for(const collection of ['tasks','timetable','categoryBudgets']){
   const rows=await call(`${parent}:runQuery`,{transaction,structuredQuery:{from:[{collectionId:collection}],limit:1001}});
   snapshot[collection]=rows.filter(r=>r.document).map(r=>({id:r.document.name.split('/').pop(),...decode(r.document.fields)}));
   if(snapshot[collection].length>1000)throw problem('This account has too many records for a single assistant edit. Use the individual screen controls.');
  }
  const changes=buildWrites(actions,snapshot,input.proposalId,input.offset,Date.now(),input.offsets||{});
  if(changes.length>450)throw problem('Too many linked records would change. Confirm a smaller proposal.');
  const writes=changes.map(c=>({update:{name:`${parent}/${c.collection}/${c.id}`,fields:encode(c.data)},updateMask:{fieldPaths:Object.keys(c.data)}}));
  writes.push({update:{name:ledger,fields:encode({hash,appliedAt:Date.now(),count:changes.length})},currentDocument:{exists:false}});
  await call(`${root}:commit`,{transaction,writes});return {ok:true,count:changes.length};
 }catch(e){await call(`${root}:rollback`,{transaction}).catch(()=>{});throw e;}
}
