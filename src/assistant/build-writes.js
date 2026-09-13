import {interval,overlaps} from './planner.js';
const problem=message=>Object.assign(new Error(message),{status:409});
export function buildWrites(actions,snapshot,proposalId,offset,now=Date.now(),offsets={}){
 const changes=new Map(),created=new Map();
 const tasks=new Map(snapshot.tasks.map(d=>[d.id,{...d}])),blocks=new Map(snapshot.timetable.map(d=>[d.id,{...d}])),budgets=new Map(snapshot.categoryBudgets.map(d=>[d.id,{...d}])),transactions=new Map((snapshot.transactions||[]).map(d=>[d.id,{...d}]));
 const unique=(kind,id)=>`${kind}/${id}`;
 const newId=ref=>`ai_${proposalId}_${ref}`;
 function write(collection,id,data){const key=unique(collection,id);changes.set(key,{collection,id,data:{...changes.get(key)?.data,...data}});}
 function unchanged(current,before,keys){
  if(!current||keys.some(k=>(current[k]??null)!==(before[k]??null)))throw problem('A record changed since this proposal. Ask for a fresh plan.');
 }
 const updated=new Set();
 for(const a of actions){
  if(a.id){const target=(['update_task','delete_task'].includes(a.type)?'tasks':['move_block','delete_block'].includes(a.type)?'timetable':['tag_transaction','delete_transaction'].includes(a.type)?'transactions':'categoryBudgets')+'/'+a.id;if(updated.has(target))throw problem('The plan changes the same record twice. Ask for a simpler plan.');updated.add(target);}
  if(a.type==='delete_transaction'){unchanged(transactions.get(a.id),a.before,['date','amount','type','category','note','eventTag']);changes.set(unique('transactions',a.id),{collection:'transactions',id:a.id,delete:true});}
  if(a.type==='delete_budget'){unchanged(budgets.get(a.id),a.before,['category','limit']);budgets.delete(a.id);changes.set(unique('categoryBudgets',a.id),{collection:'categoryBudgets',id:a.id,delete:true});}
  if(a.type==='delete_task'){
   unchanged(tasks.get(a.id),a.before,['title','priority','done']);tasks.delete(a.id);changes.set(unique('tasks',a.id),{collection:'tasks',id:a.id,delete:true});
   for(const b of blocks.values())if(b.taskId===a.id){blocks.delete(b.id);changes.set(unique('timetable',b.id),{collection:'timetable',id:b.id,delete:true});}
  }
  if(a.type==='delete_block'){
   unchanged(blocks.get(a.id),a.before,['label','date','time','durationMinutes','done','taskId']);blocks.delete(a.id);changes.set(unique('timetable',a.id),{collection:'timetable',id:a.id,delete:true});
  }
  if(a.type==='create_transaction')write('transactions',newId(a.ref),{date:a.date,amount:a.amount,type:a.transactionType,category:a.category,note:a.note,eventTag:a.eventTag,wallet:'Unassigned',source:'assistant'});
  if(a.type==='tag_transaction'){
   unchanged(transactions.get(a.id),a.before,['date','amount','type','category','note','eventTag']);write('transactions',a.id,{eventTag:a.eventTag});
  }
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
   id=a.id;taskId=current.taskId;data={done:Boolean(current.done)};if(taskId)data.taskId=taskId;
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
