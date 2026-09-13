import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {commitProposal} from '../src/assistant/commit.js';
import {buildWrites} from '../src/assistant/build-writes.js';
import {validateActions} from '../src/assistant/actions.js';
import {normalizeTag,eventTotals} from '../src/assistant/event-tags.js';
import {session,updateSession,clearSession} from '../src/assistant/session.js';
const empty=()=>({tasks:[],timetable:[],categoryBudgets:[],transactions:[]});
const proposalId='test-confirmation-123456',task={type:'create_task',ref:'task',title:'Revise',priority:'Med',done:false};
function mock(initial=empty(),deny=false){
 let profile={},db=structuredClone(initial),commits=0,reads=[];
 return {get db(){return db;},get commits(){return commits;},reads,adapter:{hash:async v=>createHash('sha256').update(v).digest('hex'),records:async name=>{reads.push(name);return db[name];},transaction:async fn=>{const pending=[],tx={profile:async()=>profile,write:c=>pending.push(c),saveProfile:p=>pending.push({profile:p})};const result=await fn(tx);if(deny)throw Object.assign(new Error('denied'),{code:'permission-denied'});for(const c of pending){if(c.profile)profile={...profile,...c.profile};else {db[c.collection]=db[c.collection].filter(r=>r.id!==c.id);if(!c.delete)db[c.collection].push({id:c.id,...c.data});}}if(pending.length)commits++;return result;}}};
}
test('client confirmation saves task and receipt atomically and retries without duplicates',async()=>{
 const m=mock(),input={proposalId,actions:[task],offset:0};await commitProposal('alice',input,m.adapter);assert.equal(m.db.tasks.length,1);assert.deepEqual(m.reads,['tasks']);const retry=await commitProposal('alice',input,m.adapter);assert.equal(retry.alreadyApplied,true);assert.equal(m.commits,1);
 await assert.rejects(commitProposal('alice',{...input,actions:[{...task,title:'Changed'}]},m.adapter),/already used/);
});
test('permission failures cannot leave partial tasks or receipts',async()=>{const m=mock(empty(),true);await assert.rejects(commitProposal('alice',{proposalId,actions:[task],offset:0},m.adapter),/denied/);assert.equal(m.db.tasks.length,0);assert.equal(m.commits,0);});
test('deleting a task removes only its linked blocks; stale deletes fail',()=>{
 const s=empty(),before={id:'a',title:'Read',done:false,priority:'High'};s.tasks=[before,{id:'b',title:'Keep'}];s.timetable=[{id:'a-block',taskId:'a'},{id:'b-block',taskId:'b'}];
 const actions=validateActions([{type:'delete_task',ref:'del',id:'a',before}]);const writes=buildWrites(actions,s,proposalId,0);assert.deepEqual(writes.map(w=>w.id),['a','a-block']);assert.ok(writes.every(w=>w.delete));assert.throws(()=>buildWrites(actions,{...s,tasks:[{...before,done:true}]},proposalId,0),/record changed/);
});
test('deleting a timetable block keeps its task and cannot be combined with a move of that block',()=>{
 const before={id:'block',date:'2099-01-01',time:'10:00',label:'Read',taskId:'task'};const s=empty();s.timetable=[before];s.tasks=[{id:'task'}];const a={type:'delete_block',id:'block',ref:'delete',before};assert.equal(buildWrites(validateActions([a]),s,proposalId,0)[0].collection,'timetable');assert.throws(()=>buildWrites(validateActions([a,{...a,ref:'again'}]),s,proposalId,0),/same record/);
});
test('event tags normalize names and preserve totals across dates and transaction types',()=>{
 assert.equal(normalizeTag('#Summer Vacation'),'summer-vacation');assert.throws(()=>normalizeTag('../bad'));assert.equal(normalizeTag('#رحلة الصيف'),'رحلة-الصيف');assert.deepEqual(eventTotals([{eventTag:'trip',type:'expense',amount:50,date:'2025-01-01'},{eventTag:'trip',type:'income',amount:10,date:'2026-01-01'}]),[{tag:'trip',income:10,expenses:50,count:2}]);
});
test('Gemini can log a tagged expense and tag an existing entry without changing its amount',()=>{
 const s=empty(),before={id:'tx',date:'2026-09-13',amount:100,type:'expense',category:'Food',note:'Lunch'};s.transactions=[before];const a=validateActions([{type:'create_transaction',ref:'expense',date:'2026-09-13',amount:250.55,transactionType:'expense',category:'Travel',eventTag:'#Summer Vacation'},{type:'tag_transaction',ref:'tag',id:'tx',before,eventTag:'#Summer Vacation'}]);const writes=buildWrites(a,s,proposalId,0);assert.equal(writes[0].data.eventTag,'summer-vacation');assert.deepEqual(writes[1].data,{eventTag:'summer-vacation'});assert.throws(()=>buildWrites(a,{...s,transactions:[{...before,amount:150}]},proposalId,0),/record changed/);
});
test('conversation sessions retain proposals across views and isolate users',()=>{
 clearSession('a');clearSession('b');updateSession('a',{memory:'Study after 7',messages:[{role:'user',text:'Hello'}],proposal:{proposalId}});assert.equal(session('a').memory,'Study after 7');assert.equal(session('b').memory,'');clearSession('a');assert.equal(session('a').proposal,null);
});
import {readGeminiStream} from '../server/gemini-stream.js';
test('streamed Gemini text appears before the full validated proposal, including split transport chunks',async()=>{
 const output=JSON.stringify({reply:'Read at 7 pm.\nThen rest.',actions:[]}),cut=18,events=[output.slice(0,cut),output.slice(cut)].map(text=>'data: '+JSON.stringify({candidates:[{content:{parts:[{text}]}}]})+'\n\n').join('');
 const bytes=new TextEncoder().encode(events),seen=[];const stream=new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=7)c.enqueue(bytes.slice(i,i+7));c.close();}});
 assert.equal(await readGeminiStream(stream,text=>seen.push(text)),output);assert.ok(seen.length>1);assert.equal(seen.at(-1),'Read at 7 pm.\nThen rest.');
});
import {dateContext} from '../src/assistant/date-context.js';
test('date hints resolve Indian dates, tomorrow and 12-hour times using the device day',()=>{
 const c={localDate:'2026-09-13',localTime:'23:50'};
 assert.equal(dateContext('tomorrow at 7 pm',c).interpretedRequest.date,'2026-09-14');
 assert.equal(dateContext('tomorrow at 7 pm',c).interpretedRequest.time,'19:00');
 assert.equal(dateContext('day after tomorrow at 12 am',c).interpretedRequest.time,'00:00');
 assert.equal(dateContext('next Monday at 09:30',c).interpretedRequest.date,'2026-09-14');
 assert.equal(dateContext('14/09/2026 at 7 in the evening for 1 hour',c).interpretedRequest.durationMinutes,60);
 assert.equal(dateContext('14/09/2026 at 7 in the evening',c).interpretedRequest.time,'19:00');
 assert.equal(dateContext('tomorrow',{localDate:'2026-12-31'}).interpretedRequest.date,'2027-01-01');
});
test('budget and transaction deletion is limited to the reviewed current records',()=>{
 const s=empty(),budget={id:'b',category:'Food',limit:1000},expense={id:'e',date:'2026-09-13',type:'expense',category:'Food',amount:20,note:'Tea'};s.categoryBudgets=[budget];s.transactions=[expense];const actions=validateActions([{type:'delete_budget',ref:'b',id:'b',before:budget},{type:'delete_transaction',ref:'e',id:'e',before:expense}]);assert.deepEqual(buildWrites(actions,s,proposalId,0).map(w=>[w.collection,w.delete]),[['categoryBudgets',true],['transactions',true]]);assert.throws(()=>buildWrites(actions,{...s,transactions:[{...expense,amount:30}]},proposalId,0),/record changed/);
});
