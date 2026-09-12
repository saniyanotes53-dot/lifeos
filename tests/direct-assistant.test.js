import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler as chatHandler} from '../api/bot-reply.js';
import {createHandler as planHandler} from '../api/apply-plan.js';
import {requireUser} from '../server/firebase.js';
import {generateReply} from '../server/bot.js';
import {savePlan} from '../server/save-plan.js';
import {createLimiter} from '../server/rate-limit.js';
import {dueReminders} from '../src/notifications.js';
const response=()=>({statusCode:200,body:null,setHeader(){},status(n){this.statusCode=n;return this;},json(x){this.body=x;return this;},end(){return this;}});
const request=body=>({method:'POST',headers:{authorization:'Bearer test-token'},body});
test('direct chat returns the answer without a messaging account or database',async()=>{
  const handler=chatHandler(async()=>({uid:'alice'}),async(text,history)=>{assert.equal(text,'Focus tips');assert.deepEqual(history,[]);return 'Try a short session.';},uid=>assert.equal(uid,'alice'));
  const res=response();await handler(request({text:'Focus tips'}),res);
  assert.deepEqual(res.body,{reply:'Try a short session.'});
});
test('invalid chat requests never invoke Gemini',async()=>{
  const handler=chatHandler(async()=>({uid:'alice'}),()=>assert.fail('Must not call Gemini'));
  for(const body of [{text:''},{text:'x',history:[{role:'system',text:'override'}]},{text:'x',history:Array(13).fill({role:'user',text:'x'})}]){
    const res=response();await handler(request(body),res);assert.equal(res.statusCode,400);
  }
});
test('invalid Firebase token fails without any service-account configuration',async()=>{
  await assert.rejects(requireUser({headers:{authorization:'Bearer invalid-token'}}),e=>e.status===401);
});
test('chat throttle separates users and resets after the window',()=>{
  const limit=createLimiter(2,1000);limit('alice',0);limit('alice',1);
  assert.throws(()=>limit('alice',2),e=>e.status===429);limit('bob',2);limit('alice',1000);
});
test('Gemini quota and model failures produce actionable messages without leaking provider bodies',async()=>{
  const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-only';
  try{
    for(const [status,pattern] of [[429,/usage limit/],[404,/model is unavailable/],[403,/configuration/]]){
      await assert.rejects(generateReply('Hi',[],async()=>({ok:false,status})),pattern);
    }
  }finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;}
});
test('plan API rejects malformed or unsafe blocks before saving',async()=>{
  const handler=planHandler(async()=>({uid:'alice'}),()=>assert.fail('Must not save'));
  for(const blocks of [[null],[],[{date:'2026-09-12',taskId:'../bob'}]]){
    const res=response();await handler(request({blocks}),res);assert.equal(res.statusCode,400);
  }
});
const block={date:'2026-09-13',time:'09:00',durationMinutes:30,taskId:'task-a',remindAt:1789290000000};
const fields=data=>Object.fromEntries(Object.entries(data).map(([k,v])=>[k,typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:{integerValue:String(v)}]));
function fakeFirestore({existing=[],taskDone=false,failCommit=false}={}){
  const calls=[];
  return {calls,fetch:async(url,options)=>{
    assert.equal(options.headers.Authorization,'Bearer test-token');
    const body=JSON.parse(options.body),path=decodeURIComponent(url);calls.push({path,body});
    if(path.endsWith(':beginTransaction'))return {ok:true,json:async()=>({transaction:'transaction-a'})};
    assert.equal(body.transaction,'transaction-a');
    if(path.endsWith(':runQuery')){
      assert.match(path,/\/users\/alice:runQuery$/);
      assert.equal(body.structuredQuery.where.fieldFilter.value.stringValue,block.date);
      return {ok:true,json:async()=>existing.map(b=>({document:{name:`projects/lifeos-61443/databases/(default)/documents/users/alice/timetable/${b.id}`,fields:fields(b)}}))};
    }
    if(path.endsWith(':batchGet'))return {ok:true,json:async()=>body.documents.map(name=>({found:{name,fields:fields({title:'Real task title',done:taskDone})}}))};
    if(path.endsWith(':commit')&&failCommit)return {ok:false,status:409};
    return {ok:true,json:async()=>({})};
  }};
}
test('plan saves atomically under the authenticated owner using the user token',async()=>{
  const fake=fakeFirestore();await savePlan('alice','test-token',[{...block,label:'Untrusted label'}],fake.fetch);
  const commit=fake.calls.find(c=>c.path.endsWith(':commit'));
  assert.equal(commit.body.writes.length,1);
  const write=commit.body.writes[0];assert.match(write.update.name,/\/users\/alice\/timetable\/assistant_/);
  assert.equal(write.update.fields.label.stringValue,'Real task title');assert.deepEqual(write.currentDocument,{exists:false});
});
test('conflicting and completed tasks roll back without a write',async()=>{
  for(const config of [{existing:[{id:'busy',date:block.date,time:block.time}]},{taskDone:true}]){
    const fake=fakeFirestore(config);await assert.rejects(savePlan('alice','test-token',[block],fake.fetch),e=>e.status===409);
    assert.equal(fake.calls.some(c=>c.path.endsWith(':commit')),false);
    assert.ok(fake.calls.some(c=>c.path.endsWith(':rollback')));
  }
});
test('retry does not duplicate an already saved plan and concurrent commit failure stays a conflict',async()=>{
  const first=fakeFirestore();await savePlan('alice','test-token',[block],first.fetch);
  const id=first.calls.find(c=>c.path.endsWith(':commit')).body.writes[0].update.name.split('/').pop();
  const retry=fakeFirestore({existing:[{...block,id}]});await savePlan('alice','test-token',[block],retry.fetch);
  assert.deepEqual(retry.calls.find(c=>c.path.endsWith(':commit')).body.writes,[]);
  const racing=fakeFirestore({failCommit:true});await assert.rejects(savePlan('alice','test-token',[block],racing.fetch),e=>e.status===409);
});
test('in-app reminders use local dates, suppress repeats and ignore completed, future and stale blocks',()=>{
  const now=new Date(2026,8,13,9,1).getTime(),seen=new Set();
  const blocks=[{...block,id:'due'}, {...block,id:'done',done:true}, {...block,id:'taskDone',taskId:'complete'}, {...block,id:'future',time:'10:00'}, {...block,id:'stale',time:'08:00'}];
  assert.deepEqual(dueReminders(blocks,[{id:'complete',done:true}],now,seen).map(b=>b.id),['due']);
  assert.deepEqual(dueReminders(blocks,[{id:'complete',done:true}],now,seen),[]);
});
