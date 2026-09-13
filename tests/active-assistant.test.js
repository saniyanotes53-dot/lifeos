import test from 'node:test';
import assert from 'node:assert/strict';
import {validateActions} from '../src/assistant/actions.js';
import {buildWrites,applyActions} from '../server/apply-actions.js';
import {proposeActions} from '../server/agent.js';
import assistant from '../api/assistant.js';
import apply from '../api/assistant-apply.js';
import {splitBill} from '../src/assistant/budget-tools.js';
const empty=()=>({tasks:[],timetable:[],categoryBudgets:[]});
const now=Date.UTC(2026,8,12,0),proposal='proposal-1234567890';
const task={type:'create_task',ref:'new-task',title:'Revision',priority:'High',done:false};
const schedule={type:'schedule_task',ref:'new-block',taskId:'new-task',title:'Revision',date:'2026-09-13',time:'19:00',durationMinutes:30};
test('confirmed proposal creates a task and a linked timetable block in one write set',()=>{
 const result=buildWrites(validateActions([task,schedule]),empty(),proposal,-330,now);
 const t=result.find(x=>x.collection==='tasks'),b=result.find(x=>x.collection==='timetable');
 assert.equal(b.data.taskId,t.id);assert.equal(b.data.remindAt,Date.UTC(2026,8,13,13,30));
 assert.deepEqual(buildWrites(validateActions([task,schedule]),empty(),proposal,-330,now),result);
});
test('an updated task synchronizes completion with linked timetable blocks',()=>{
 const before={id:'saved',title:'Read',priority:'Med',done:false};
 const s=empty();s.tasks=[before];s.timetable=[{id:'block',taskId:'saved',date:'2026-09-13',time:'09:00',done:false}];
 const actions=validateActions([{type:'update_task',ref:'edit',id:'saved',title:'Read book',priority:'High',done:true,before}]);
 const writes=buildWrites(actions,s,proposal,0,now);assert.equal(writes.find(w=>w.collection==='timetable').data.done,true);
 assert.deepEqual(Object.keys(writes.find(w=>w.collection==='tasks').data).sort(),['done','priority','title']);
 assert.throws(()=>buildWrites(actions,{...s,tasks:[{...before,title:'Changed elsewhere'}]},proposal,0,now),/record changed/);
});
test('moves preserve existing block linkage and support a non-overlapping swap',()=>{
 const s=empty();s.timetable=[{id:'one',label:'A',time:'09:00',date:'2026-09-13',durationMinutes:30,done:false,taskId:'a'},{id:'two',label:'B',time:'10:00',date:'2026-09-13',durationMinutes:30,done:false,taskId:'b'}];
 const actions=s.timetable.map((b,i)=>({type:'move_block',ref:'move'+i,id:b.id,before:b,title:b.label,date:b.date,time:i?'09:00':'10:00',durationMinutes:30}));
 const writes=buildWrites(validateActions(actions),s,proposal,0,now);assert.equal(writes[0].data.taskId,'a');assert.equal(writes[0].data.time,'10:00');
});
test('overlapping, past and completed-task schedules are rejected',()=>{
 const s=empty();s.tasks=[{id:'saved',title:'Saved',done:false}];s.timetable=[{id:'busy',date:schedule.date,time:schedule.time}];
 assert.throws(()=>buildWrites(validateActions([{...schedule,taskId:'saved'}]),s,proposal,0,now),/conflicting/);
 assert.throws(()=>buildWrites(validateActions([task,{...schedule,date:'2026-09-11'}]),empty(),proposal,0,now),/past/);
 s.timetable=[];s.tasks[0].done=true;assert.throws(()=>buildWrites(validateActions([{...schedule,taskId:'saved'}]),s,proposal,0,now),/completed/);
});
test('budget updates preserve the approved limit and reject stale or duplicate categories',()=>{
 const s=empty(),before={id:'budget',category:'Food',limit:2000};s.categoryBudgets=[before];
 const a={type:'set_budget',ref:'limit',id:'budget',before,category:'Food',limit:1800.25};
 assert.equal(buildWrites(validateActions([a]),s,proposal,0,now)[0].data.limit,1800.25);
 assert.throws(()=>buildWrites(validateActions([{...a,before:{...before,limit:1500}}]),s,proposal,0,now),/record changed/);
 assert.throws(()=>buildWrites(validateActions([{type:'set_budget',ref:'new',category:'food',limit:1800}]),s,proposal,0,now),/already/);
});
test('unknown actions, paths, invalid amounts and excessive action counts never validate',()=>{
 for(const a of [{type:'delete_everything',ref:'bad'},{...task,ref:'../other'},{type:'set_budget',ref:'bad',category:'Food',limit:-1},{...schedule,durationMinutes:10000}])assert.throws(()=>validateActions([a]));
 assert.throws(()=>validateActions(Array.from({length:21},(_,i)=>({...task,ref:'task'+i}))));
});
test('Gemini only proposes structured actions and attaches original values for review',async()=>{
 const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-only';
 try{
 const original={id:'existing',title:'Read',priority:'Med',done:false};
 const result=await proposeActions('Raise priority',[],{tasks:[original]},async(url,options)=>{
  const body=JSON.parse(options.body);assert.equal(body.generationConfig.responseMimeType,'application/json');assert.match(body.systemInstruction.parts[0].text,/must click Confirm changes/);
  return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({reply:'Review this priority change.',actions:[{type:'update_task',ref:'edit',id:'existing',title:'Read',priority:'High',done:false}]})}]}}]})};
 });assert.deepEqual(result.actions[0].before,original);
 }finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;}
});
const res=()=>({statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(x){this.body=x;return this;},end(){return this;}});
test('new assistant endpoints require authentication',async()=>{
 for(const handler of [assistant,apply]){const response=res();await handler({method:'POST',headers:{},body:{}},response);assert.equal(response.statusCode,401);}
});
test('bill splits allocate every paisa once and reject ambiguous participants',()=>{
 const split=splitBill(100,'Me, Ali, Ahmed');assert.deepEqual(split.map(s=>s.amount),[33.34,33.33,33.33]);assert.equal(split.reduce((sum,s)=>sum+Math.round(s.amount*100),0),10000);
 assert.throws(()=>splitBill(100,'Ali, ali'));assert.throws(()=>splitBill(100,'Me'));assert.throws(()=>splitBill(-5,'A, B'));
});
test('confirmation writes a receipt atomically and retry performs no second commit',async()=>{
 let receipt=null,commits=0;const calls=[];
 const fake=async(url,options)=>{
  const path=decodeURIComponent(url),body=JSON.parse(options.body);calls.push({path,body});assert.equal(options.headers.Authorization,'Bearer user-token');
  let result={};
  if(path.endsWith(':beginTransaction'))result={transaction:'tx'};
  else if(path.endsWith(':batchGet'))result=receipt?[{found:{fields:receipt}}]:[{missing:body.documents[0]}];
  else if(path.endsWith(':runQuery'))result=[];
  else if(path.endsWith(':commit')){commits++;receipt=body.writes.at(-1).update.fields;assert.equal(body.writes.length,2);assert.match(body.writes[0].update.name,/\/users\/alice\/tasks\//);assert.ok(body.writes[0].updateMask);}
  return {ok:true,json:async()=>result};
 };
 const input={proposalId:proposal,actions:[task],offset:0};
 await applyActions('alice','user-token',input,fake);const retry=await applyActions('alice','user-token',input,fake);assert.equal(retry.alreadyApplied,true);assert.equal(commits,1);
 await assert.rejects(applyActions('alice','user-token',{...input,actions:[{...task,title:'Different'}]},fake),/different proposal/);
});
