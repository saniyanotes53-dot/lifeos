import {validateActions} from './actions.js';
import {buildWrites} from './build-writes.js';

// Use the same authenticated Web SDK as manual controls. The profile revision
// serializes assistant proposals with manual edits and other assistant sessions.
export async function commitProposal(uid,input,adapter){
 const actions=validateActions(input.actions);
 if(!uid||!actions.length||!/^[-a-zA-Z0-9]{16,80}$/.test(input.proposalId)||!Number.isInteger(input.offset)||Math.abs(input.offset)>840)throw new Error('Invalid confirmation. Ask for a fresh proposal.');
 if(input.offsets&&(!Object.values(input.offsets).every(v=>Number.isInteger(v)&&Math.abs(v)<=840)||Object.keys(input.offsets).length>20))throw new Error('Invalid timezone information.');
 const hash=JSON.stringify(actions),types=actions.map(a=>a.type);
 const required=new Set();
 if(types.some(t=>['create_task','update_task','delete_task','schedule_task'].includes(t)))required.add('tasks');
 if(types.some(t=>['update_task','delete_task','schedule_task','move_block','delete_block'].includes(t)))required.add('timetable');
 if(types.some(t=>['set_budget','delete_budget'].includes(t)))required.add('categoryBudgets');
 if(types.some(t=>['tag_transaction','delete_transaction'].includes(t)))required.add('transactions');
 const digest=await adapter.hash(hash);
 return adapter.transaction(async tx=>{
  const profile=await tx.profile();
  const receipts=profile.assistantReceipts||{};
  if(receipts[input.proposalId]){if(receipts[input.proposalId].hash!==digest)throw new Error('This confirmation was already used for another proposal.');return {ok:true,alreadyApplied:true};}
  if(input.createdAt&&Date.now()-input.createdAt>86400000)throw new Error('This proposal is over a day old. Ask for a fresh one.');
  const snapshot={tasks:[],timetable:[],categoryBudgets:[],transactions:[]};
  await Promise.all([...required].map(async collection=>{snapshot[collection]=await adapter.records(collection);if(snapshot[collection].length>1000)throw new Error('This collection is too large for one assistant edit. Use the individual screen controls.');}));
  const changes=buildWrites(actions,snapshot,input.proposalId,input.offset,Date.now(),input.offsets||{});
  if(changes.length>450)throw new Error('Too many linked records. Confirm a smaller proposal.');
  for(const c of changes)tx.write(c);
  const retained=Object.fromEntries(Object.entries(receipts).sort((a,b)=>b[1].at-a[1].at).slice(0,99));
  retained[input.proposalId]={hash:digest,at:Date.now()};
  tx.saveProfile({assistantRevision:(profile.assistantRevision||0)+1,assistantReceipts:retained});
  return {ok:true,count:changes.length};
 });
}
