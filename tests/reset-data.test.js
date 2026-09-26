import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReset,RESET_SCOPES} from '../server/reset-data.js';
test('reset requires recent authentication and an exact allowlisted section',()=>{
 const now=Date.now(),user={auth_time:Math.floor(now/1000)};
 assert.deepEqual(validateReset({scope:'tasks',confirmation:'RESET TASKS'},user,now),['tasks','timetable']);
 assert.throws(()=>validateReset({scope:'users',confirmation:'RESET USERS'},user,now));
 assert.throws(()=>validateReset({scope:'budget',confirmation:'RESET HEALTH'},user,now));
 assert.throws(()=>validateReset({scope:'budget',confirmation:'RESET BUDGET'},{auth_time:user.auth_time-121},now));
 assert.throws(()=>validateReset({scope:'budget',confirmation:'RESET BUDGET'},{},now));
 assert.ok(!Object.values(RESET_SCOPES).flat().includes('users'));
});
