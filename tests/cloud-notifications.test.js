import test from 'node:test';
import assert from 'node:assert/strict';
import {isDue} from '../server/push-delivery.js';
import handler from '../api/notify-due.js';
test('scheduled delivery ignores completed, stale, future and invalid blocks',()=>{
 const now=Date.now();assert.equal(isDue({remindAt:now-1000},now),true);
 for(const block of [{remindAt:now+1},{remindAt:now-300001},{remindAt:now,done:true},{remindAt:'invalid'}])assert.equal(isDue(block,now),false);
});
test('scheduler refuses unauthenticated requests before touching any service',async()=>{
 const before=process.env.CRON_SECRET;process.env.CRON_SECRET='scheduler-secret';let status;
 const res={setHeader(){},status(s){status=s;return this;},json(body){return body;}};
 try{await handler({headers:{},query:{}},res);assert.equal(status,401);}finally{if(before===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=before;}
});
test('Python transport forwards a private request and propagates failures',async()=>{
 const {transport}=await import('../server/delivery.js');const original=globalThis.fetch;
 try{globalThis.fetch=async(url,options)=>{assert.equal(url,'https://lifeos53.vercel.app/api/deliver');assert.equal(JSON.parse(options.body).channel,'push');return {ok:true,json:async()=>({expired:true})};};assert.deepEqual(await transport({channel:'push'}),{expired:true});globalThis.fetch=async()=>({ok:false,status:502,json:async()=>({})});await assert.rejects(()=>transport({channel:'email'}),/Python delivery failed/);}finally{globalThis.fetch=original;}
});
