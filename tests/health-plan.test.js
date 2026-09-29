import test from 'node:test';
import assert from 'node:assert/strict';
import {healthPlan} from '../server/health-plan.js';
test('health planning reads only verified owner records and relays server-fetched context',async()=>{
 const old=process.env.CRON_SECRET;process.env.CRON_SECRET='test';const urls=[];
 try{
 const result=await healthPlan({headers:{authorization:'Bearer user-token'},body:{date:'2026-09-28',hour:12,uid:'victim',profile:{age:99}}},{uid:'owner'},async(url,options)=>{
  urls.push(url);
  if(url.includes('/api/deliver')){const p=JSON.parse(options.body);assert.equal(p.channel,'nutrition');assert.equal(p.context.profile.age,25);assert.ok(!JSON.stringify(p).includes('victim'));return Response.json({plan:[]});}
  assert.match(url,/users\/owner/);assert.equal(options.headers.Authorization,'Bearer user-token');
  return Response.json(url.endsWith(':runQuery')?[]:{fields:{age:{integerValue:'25'}}});
 });assert.deepEqual(result,{plan:[]});assert.equal(urls.length,5);
 }finally{if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;}
});
test('invalid local day is rejected before reading health records',async()=>{
 await assert.rejects(healthPlan({body:{date:'2026-02-31',hour:12}},{uid:'u'},()=>assert.fail('unexpected request')),/valid local/);
});
test('optional log failures still return meal ideas without pretending the logs are empty',async()=>{
 const old=process.env.CRON_SECRET;process.env.CRON_SECRET='test';
 try{
 const result=await healthPlan({headers:{authorization:'Bearer user'},body:{date:'2026-09-29',hour:12}},{uid:'owner'},async(url)=>{
 if(url.includes('/api/deliver'))return Response.json({plan:[],summary:{recordedToday:{cal:0},remainingToUserTargets:{},workoutMinutesLast7Days:0},notes:[]});
 if(url.endsWith(':runQuery'))return new Response('',{status:503});
 return Response.json({fields:{age:{integerValue:'25'}}});
 });assert.deepEqual(result.dataWarnings,['food','workout','sleep']);assert.equal(result.summary.recordedToday,null);assert.equal(result.summary.workoutMinutesLast7Days,null);
 }finally{if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;}
});
