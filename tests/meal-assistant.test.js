import test from 'node:test';
import assert from 'node:assert/strict';
import {isMealRequest,mealReply} from '../server/meal-assistant.js';
const context={healthShared:true,localDate:'2026-09-30',localTime:'08:00'};
const req={headers:{authorization:'Bearer owner-token'},body:{text:'Suggest dinner'}};
test('routine meal requests use the planner while task operations remain Gemini actions',()=>{
 for(const text of ['What should I eat next?','Suggest dinner','Plan my daily meals','I need a meal plan','nutritionist does not work'])assert.equal(isMealRequest(text),true,text);
 for(const text of ['Add a task to cook dinner','Log dinner expense','Read my blood test report','Move my timetable'])assert.equal(isMealRequest(text),false,text);
});
test('meal chat requires explicit health sharing before reading any saved health data',async()=>{
 const result=await mealReply(req,{uid:'owner'},{...context,healthShared:false},()=>assert.fail('no consent'));
 assert.match(result.reply,/Enable/);assert.deepEqual(result.actions,[]);
});
test('meal chat reads authenticated records through planner and cannot demand uploaded reports',async()=>{
 const meal={name:'Chickpea bowl',slot:'dinner',ingredients:[{name:'Chickpeas',grams:200}],method:'Warm and serve.'};
 const result=await mealReply(req,{uid:'owner'},context,async(r,u)=>{
 assert.equal(u.uid,'owner');assert.equal(r.headers.authorization,'Bearer owner-token');assert.deepEqual(r.body,{date:'2026-09-30',hour:19});
 return {nextMeal:meal,plan:[meal],selection:'AI-assisted selection'};
 });
 assert.match(result.reply,/Next meal: Chickpea bowl/);assert.match(result.reply,/200 g Chickpeas/);assert.doesNotMatch(result.reply,/upload|health report/i);assert.deepEqual(result.actions,[]);
});
test('incomplete preferences identify missing fields without blocking on reports or food logs',async()=>{
 const result=await mealReply(req,{uid:'owner'},context,async()=>({blocked:true,needsSetup:true,message:'Complete age and health considerations in Health preferences.'}));
 assert.match(result.reply,/Complete age and health considerations/);assert.match(result.reply,/No report upload is required/);
});
