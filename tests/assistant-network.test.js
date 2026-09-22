import test from 'node:test';
import assert from 'node:assert/strict';
import {withReadRetry} from '../src/assistant/request.js';
import {streamAssistant} from '../src/assistant/api.js';

test('temporary first-request failures recover with one retry',async()=>{
  const tokens=[],retry=[];let calls=0;
  const value=await withReadRetry({getIdToken:async refresh=>{tokens.push(refresh);return 'token';}},async()=>{calls++;if(calls===1)throw Object.assign(Error('Temporary'),{status:503});return 'Ready';},{wait:async()=>{},onRetry:()=>retry.push(true)});
  assert.equal(value,'Ready');assert.equal(calls,2);assert.deepEqual(tokens,[false,false]);assert.equal(retry.length,1);
});
test('expired auth retries with a refreshed token, permanent failures and quota do not retry',async()=>{
  const refreshed=[];let calls=0;
  await withReadRetry({getIdToken:async force=>{refreshed.push(force);}},async()=>{if(++calls===1)throw Object.assign(Error('Expired'),{status:401});},{wait:async()=>{}});assert.deepEqual(refreshed,[false,true]);
  for(const status of [400,403,429]){let attempts=0;await assert.rejects(withReadRetry({getIdToken:async()=>''},async()=>{attempts++;throw Object.assign(Error('Permanent'),{status});},{wait:async()=>{}}));assert.equal(attempts,1);}
});
test('retries are bounded when the service stays unavailable',async()=>{
  let attempts=0;await assert.rejects(withReadRetry({getIdToken:async()=>''},async()=>{attempts++;throw new TypeError('Network failed');},{wait:async()=>{}}),/Network/);assert.equal(attempts,2);
});
test('interrupted streaming clears the draft and returns one completed proposal',async()=>{
  const original=global.fetch;let calls=0;const seen=[],retries=[];
  global.fetch=async()=>{calls++;return new Response(calls===1?JSON.stringify({type:'reply',text:'Incomplete draft'})+'\n':JSON.stringify({type:'reply',text:'Ready'})+'\n'+JSON.stringify({type:'done',result:{reply:'Ready',actions:[]}})+'\n',{headers:{'content-type':'application/x-ndjson'}});};
  try{const result=await streamAssistant({getIdToken:async()=>''},{text:'hello'},text=>seen.push(text),()=>retries.push(true));assert.equal(result.reply,'Ready');assert.equal(calls,2);assert.deepEqual(seen,['Incomplete draft','','Ready']);assert.equal(retries.length,1);}
  finally{global.fetch=original;}
});
