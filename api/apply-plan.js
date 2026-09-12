import {requireUser,services,fail} from '../server/firebase.js';
import {minutes,interval,overlaps} from '../src/assistant/planner.js';
import {parseLocalDate} from '../src/utils/dates.js';
import {createHash} from 'node:crypto';
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).end();
  try{
    const user=await requireUser(req),{db}=services(),blocks=req.body?.blocks;
    if(!Array.isArray(blocks)||!blocks.length||blocks.length>50)return res.status(400).json({error:'Choose between 1 and 50 blocks.'});
    const date=blocks[0]?.date;
    if(new Set(blocks.map(b=>b.taskId)).size!==blocks.length||!parseLocalDate(date)||blocks.some(b=>b.date!==date||!Number.isFinite(minutes(b.time))||minutes(b.time)+b.durationMinutes>1440||![15,30,45,60,90].includes(b.durationMinutes)||typeof b.taskId!=='string'||b.taskId.length>128||b.taskId.includes('/')||!Number.isFinite(b.remindAt)||b.remindAt<Date.now()||b.remindAt>Date.now()+366*86400000))return res.status(400).json({error:'The plan contains an invalid or past block. Generate a new plan.'});
    const collection=db.collection('users').doc(user.uid).collection('timetable');
    const refs=blocks.map(b=>collection.doc('assistant_'+createHash('sha256').update(`${date}:${b.taskId}`).digest('hex').slice(0,32)));
    await db.runTransaction(async transaction=>{
      const existing=await transaction.get(collection.where('date','==',date));
      const taskRefs=blocks.map(b=>db.collection('users').doc(user.uid).collection('tasks').doc(b.taskId));
      const tasks=await transaction.getAll(...taskRefs);
      const known=new Map(existing.docs.map(d=>[d.id,d.data()]));
      const busy=existing.docs.map(d=>interval(d.data()));
      if(busy.some(x=>!Number.isFinite(x.start)))throw Object.assign(new Error('Correct invalid timetable times before applying a plan.'),{status:409});
      for(let i=0;i<blocks.length;i++){
        const block=blocks[i];
        if(known.has(refs[i].id))continue; // Idempotent retry; never overwrite existing entries.
        if(!tasks[i].exists||tasks[i].data().done||existing.docs.some(d=>d.data().taskId===block.taskId)||busy.some(b=>overlaps(interval(block),b)))throw Object.assign(new Error('Your tasks or timetable changed. Generate a fresh plan.'),{status:409});
        busy.push(interval(block));
        transaction.set(refs[i],{date,time:block.time,durationMinutes:block.durationMinutes,taskId:block.taskId,label:String(tasks[i].data().title||'Task').slice(0,200),done:false,source:'assistant',remindAt:block.remindAt});
      }
    });
    return res.json({ok:true});
  }catch(error){return fail(res,error);}
}
