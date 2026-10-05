import test from 'node:test';
import assert from 'node:assert/strict';
import {geminiRequest} from '../server/gemini-request.js';
test('recovers from temporary overload with bounded backoff',async()=>{
 let calls=0;const waits=[];
 const result=await geminiRequest('test',{},async()=>new Response('',{status:++calls<3?503:200}),async ms=>waits.push(ms));
 assert.equal(result.status,200);assert.equal(calls,3);assert.equal(waits.length,2);assert.ok(waits[1]>waits[0]);
});
test('does not retry credentials, quota or invalid requests and bounds persistent outage',async()=>{
 for(const status of [400,401,403,404,429,503]){
 let calls=0;const result=await geminiRequest('test',{},async()=>{calls++;return new Response('',{status});},async()=>{});
 assert.equal(result.status,status);assert.equal(calls,status===503?3:1);
 }
});
test('assistant recovers broken streaming JSON using the same deadline without executing actions',async()=>{
 const {proposeActions}=await import('../server/agent.js');
 const previous=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-only';
 try{
 const calls=[],drafts=[];
 const result=await proposeActions('Hello',[],{},async(url,options)=>{
 calls.push({url,signal:options.signal});
 return calls.length===1?new Response('data: {broken}\n'):Response.json({candidates:[{content:{parts:[{text:JSON.stringify({reply:'Hello there',actions:[]})}]}}]});
 },text=>drafts.push(text));
 assert.equal(result.reply,'Hello there');assert.deepEqual(result.actions,[]);
 assert.equal(calls.length,2);assert.equal(calls[0].signal,calls[1].signal);assert.ok(calls[1].url.endsWith(':generateContent'));assert.deepEqual(drafts,['']);
 }finally{if(previous===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previous;}
});
