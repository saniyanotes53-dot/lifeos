import {localDateKey,shiftDate} from '../../src/utils/dates.js';
const today=localDateKey();
const data={tasks:[{id:'task1',title:'Review weekly priorities',date:today,priority:'High',done:false}],sleep:[{id:'old1',date:shiftDate(today,-1),hours:7},{id:'old2',date:shiftDate(today,-1),hours:8}],transactions:[{id:'expense1',date:today,type:'expense',amount:40,category:'Food',note:'Sample lunch'}],categoryBudgets:[{id:'budget1',category:'Food',limit:10000,month:today.slice(0,7)}],timetable:[{id:'block1',date:today,time:'18:00',label:'Sample planning block',done:false}]};
const subscribers=new Map();
function emit(name){for(const fn of subscribers.get(name)||[])fn([...(data[name]||[])]);}
export function watchCollection(uid,name,fn){if(!subscribers.has(name))subscribers.set(name,new Set());subscribers.get(name).add(fn);fn([...(data[name]||[])]);return ()=>subscribers.get(name).delete(fn);}
export async function ensureUserProfile(){}
export async function addItem(uid,name,item){const id=crypto.randomUUID();data[name]=[...(data[name]||[]),{...item,id}];emit(name);return {id};}
export async function updateItem(uid,name,id,patch){data[name]=(data[name]||[]).map(x=>x.id===id?{...x,...patch}:x);emit(name);}
export async function deleteItem(uid,name,id){data[name]=(data[name]||[]).filter(x=>x.id!==id);emit(name);}
export async function saveSleep(uid,date,item){data.sleep=[...(data.sleep||[]).filter(x=>x.id!==date),{...item,date,id:date}];emit('sleep');}
// Exercise the same proposal executor against isolated sample data only.
export async function confirmAssistantProposal(user,input){
 const {commitProposal}=await import('../../src/assistant/commit.js');
 let profile=previewProfile;
 return commitProposal(user.uid,input,{hash:async value=>value,records:async name=>data[name]||[],transaction:async callback=>{
  const pending=[];const result=await callback({profile:async()=>profile,write:c=>pending.push(c),saveProfile:p=>pending.push({profile:p})});
  for(const c of pending){if(c.profile){previewProfile={...previewProfile,...c.profile};continue;}if(c.delete)await deleteItem(user.uid,c.collection,c.id);else{const existing=(data[c.collection]||[]).find(r=>r.id===c.id);if(existing)await updateItem(user.uid,c.collection,c.id,c.data);else{data[c.collection]=[...(data[c.collection]||[]),{id:c.id,...c.data}];emit(c.collection);}}}return result;
 }});
}
let previewProfile={};
