import test from 'node:test';
import assert from 'node:assert/strict';
import {planDayCopy} from '../src/utils/timetable-copy.js';
const source={id:'a',date:'2026-10-16',time:'09:00',label:'Study',done:true,taskId:'task-a'};
test('copy is independent, incomplete and has deterministic destination identity',()=>{
 const [copy]=planDayCopy([source],source.date,'2026-10-17');
 assert.equal(copy.done,false);assert.equal(copy.taskId,null);assert.equal(copy.date,'2026-10-17');assert.equal(copy.id,'copy_2026-10-17_a');assert.equal(source.done,true);
});
test('rejects same day, invalid dates, empty source and overlapping destination blocks',()=>{
 assert.throws(()=>planDayCopy([source],source.date,source.date));
 assert.throws(()=>planDayCopy([source],source.date,'2026-02-30'));
 assert.throws(()=>planDayCopy([],source.date,'2026-10-17'));
 assert.throws(()=>planDayCopy([source,{...source,id:'b',date:'2026-10-17',time:'09:15'}],source.date,'2026-10-17'),/conflict/);
 assert.equal(planDayCopy([source,{...source,id:'b',date:'2026-10-17',time:'09:30'}],source.date,'2026-10-17').length,1);
});
