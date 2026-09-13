import test from 'node:test';
import assert from 'node:assert/strict';
import {isDue,deliverPush} from '../server/push-delivery.js';
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
test('background push uses data-only payload and expires obsolete subscriptions',async()=>{
 const original=globalThis.fetch;
 try{globalThis.fetch=async(url,options)=>{const data=JSON.parse(options.body);assert.equal(data.message.data.body,'Due task');assert.equal(data.message.notification,undefined);assert.equal(data.message.webpush.headers.TTL,'300');return {ok:false,json:async()=>({error:{details:[{errorCode:'UNREGISTERED'}]}})};};assert.deepEqual(await deliverPush('access','device-token','Due task','event-key'),{expired:true});}finally{globalThis.fetch=original;}
});
