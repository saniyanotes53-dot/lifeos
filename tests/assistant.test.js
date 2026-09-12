import test from 'node:test';
import assert from 'node:assert/strict';
import {proposePlan,intent,reportSummary} from '../src/assistant/planner.js';
import chatSession from '../api/chat-session.js';
import applyPlan from '../api/apply-plan.js';
import pushDevice from '../api/push-device.js';
import reminders from '../api/reminders.js';
import botReply from '../api/bot-reply.js';
import {chatUserId,generateReply,deliverReply} from '../server/bot.js';
const now=new Date(2026,8,12,8,0),date='2026-09-12';
const tasks=[{id:'low',title:'Read',priority:'Low'},{id:'high',title:'Prepare presentation',priority:'High'},{id:'done',title:'Complete',done:true}];
test('planner prioritizes tasks, respects existing blocks and takes breaks',()=>{
 const result=proposePlan({tasks,date,now,start:'09:00',end:'12:00',duration:30,blocks:[{date,time:'09:00',durationMinutes:45}]});
 assert.deepEqual(result.blocks.map(b=>[b.taskId,b.time]),[['high','09:45'],['low','10:20']]);
});
test('planner reports unplaced tasks and leaves the original data unchanged',()=>{
 const original=JSON.stringify(tasks);const result=proposePlan({tasks,date,now,start:'09:00',end:'09:30'});
 assert.equal(result.blocks.length,1);assert.deepEqual(result.unplaced,['Read']);assert.equal(JSON.stringify(tasks),original);
});
test('planner excludes already scheduled tasks and reserves legacy durations',()=>{
 const result=proposePlan({tasks,date,now,blocks:[{date,time:'09:00',taskId:'high'}]});
 assert.equal(result.blocks[0].taskId,'low');assert.equal(result.blocks[0].time,'09:30');
});
test('planner never schedules in the past and rejects invalid windows',()=>{
 const result=proposePlan({tasks,date,now:new Date(2026,8,12,9,17)});assert.equal(result.blocks[0].time,'09:20');
 assert.throws(()=>proposePlan({tasks,date:'2026-09-11',now}),/future/);
 assert.throws(()=>proposePlan({tasks,date,now,start:'25:00'}),/valid/);
 assert.throws(()=>proposePlan({tasks,date,now,end:'08:00'}),/valid/);
 assert.throws(()=>proposePlan({tasks,date,now,blocks:[{date,time:'bad'}]}),/invalid time/);
});
test('summaries do not fabricate missing health data and intents are bounded',()=>{
 assert.match(reportSummary({tasks:[],sleep:[],tx:[],workouts:[]},date),/unknown/);
 assert.equal(intent('plan my day'),'plan');assert.equal(intent('Analyze my report'),'report');assert.equal(intent('delete all my records'),'help');
});
function response(){return {statusCode:200,body:null,setHeader(){},status(n){this.statusCode=n;return this;},json(x){this.body=x;return this;},end(){return this;}};}
test('all user APIs reject missing authentication before touching Firebase',async()=>{
 for(const handler of [chatSession,applyPlan,pushDevice,botReply]){const res=response();await handler({method:'POST',headers:{},body:{}},res);assert.equal(res.statusCode,401);}
});
test('reminder dispatcher rejects unauthenticated requests',async()=>{
 const res=response();await reminders({method:'GET',headers:{}},res);assert.equal(res.statusCode,401);
});
test('Tencent user identities are stable, distinct and contain no email address',()=>{
 assert.equal(chatUserId('one'),chatUserId('one'));assert.notEqual(chatUserId('one'),chatUserId('two'));assert.match(chatUserId('email@example.test'),/^lifeos_[a-f0-9]{40}$/);
});
test('AI request contains only supplied conversation; no account records or execution tools',async()=>{
 process.env.GEMINI_API_KEY='test-placeholder';process.env.GEMINI_MODEL='test-model';
 try{const text=await generateReply('Help me focus',[],async(url,options)=>{
  const payload=JSON.parse(options.body);assert.equal(payload.contents.length,1);assert.equal(payload.contents[0].parts[0].text,'Help me focus');assert.equal(payload.tools,undefined);assert.match(payload.systemInstruction.parts[0].text,/cannot see saved records/);
  return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Try a short focus session.'}]}}]})};
 });assert.equal(text,'Try a short focus session.');}finally{delete process.env.GEMINI_API_KEY;delete process.env.GEMINI_MODEL;}
});
test('Tencent bot replies are addressed only to the authenticated derived user',async()=>{
 const values={TENCENT_SDK_APP_ID:'12345',TENCENT_ADMIN_USER_ID:'test-admin',TENCENT_CHAT_SECRET_KEY:'test-only-key',TENCENT_BOT_USER_ID:'test-bot'};Object.assign(process.env,values);
 try{await deliverReply('user-a','Hello',async(url,options)=>{const body=JSON.parse(options.body);assert.equal(body.To_Account,chatUserId('user-a'));assert.equal(body.From_Account,'test-bot');assert.equal(body.MsgBody[0].MsgContent.Text,'Hello');return {ok:true,json:async()=>({ActionStatus:'OK'})};});}finally{for(const key of Object.keys(values))delete process.env[key];}
});
