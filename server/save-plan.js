import {createHash} from 'node:crypto';
import {projectId} from './firebase.js';
import {interval,overlaps} from '../src/assistant/planner.js';
const conflict=()=>Object.assign(new Error('Your tasks or timetable changed. Generate a fresh plan.'),{status:409});
const decode=fields=>Object.fromEntries(Object.entries(fields||{}).map(([key,v])=>[key,v.stringValue??v.booleanValue??(v.integerValue!==undefined?Number(v.integerValue):v.doubleValue)]));
const encode=data=>Object.fromEntries(Object.entries(data).map(([key,v])=>[key,typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:{integerValue:String(v)}]));
export async function savePlan(uid,token,blocks,request=fetch){
  const root=`projects/${projectId}/databases/(default)/documents`,parent=`${root}/users/${uid}`;
  // All requests carry the user's token: Firestore Security Rules still apply.
  async function call(path,body){
    const url='https://firestore.googleapis.com/v1/'+path.split('/').map(part=>encodeURIComponent(part).replace(/%3A/g,':')).join('/');
    const res=await request(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    if(!res.ok){
      if(res.status===409)throw conflict();
      throw Object.assign(new Error(res.status===401?'Please sign in again.':res.status===403?'Saving was blocked by Firestore. Check that your rules allow users to manage their own records.':'Could not save the plan. Please try again.'),{status:res.status===401?401:res.status===403?403:502});
    }
    return res.json();
  }
  const {transaction}=await call(`${root}:beginTransaction`,{options:{readWrite:{}}});
  try{
    const rows=await call(`${parent}:runQuery`,{transaction,structuredQuery:{from:[{collectionId:'timetable'}],where:{fieldFilter:{field:{fieldPath:'date'},op:'EQUAL',value:{stringValue:blocks[0].date}}}}});
    const existing=rows.filter(r=>r.document).map(r=>({id:r.document.name.split('/').pop(),...decode(r.document.fields)}));
    const taskNames=blocks.map(b=>`${parent}/tasks/${b.taskId}`);
    const taskRows=await call(`${root}:batchGet`,{transaction,documents:taskNames});
    const tasks=new Map(taskRows.filter(r=>r.found).map(r=>[r.found.name,decode(r.found.fields)]));
    const busy=existing.map(interval),known=new Set(existing.map(b=>b.id)),writes=[];
    if(busy.some(b=>!Number.isFinite(b.start)))throw conflict();
    for(let i=0;i<blocks.length;i++){
      const block=blocks[i],id='assistant_'+createHash('sha256').update(`${block.date}:${block.taskId}`).digest('hex').slice(0,32);
      if(known.has(id))continue; // A retry must never overwrite or duplicate a plan.
      const task=tasks.get(taskNames[i]);
      if(!task||task.done||existing.some(b=>b.taskId===block.taskId)||busy.some(b=>overlaps(interval(block),b)))throw conflict();
      busy.push(interval(block));
      writes.push({update:{name:`${parent}/timetable/${id}`,fields:encode({date:block.date,time:block.time,durationMinutes:block.durationMinutes,taskId:block.taskId,label:String(task.title||'Task').slice(0,200),done:false,source:'assistant',remindAt:block.remindAt})},currentDocument:{exists:false}});
    }
    await call(`${root}:commit`,{transaction,writes});
  }catch(error){
    await call(`${root}:rollback`,{transaction}).catch(()=>{});
    throw error;
  }
}
