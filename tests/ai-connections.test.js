import test from 'node:test';
import assert from 'node:assert/strict';
import {sealKey,openKey} from '../server/integration-vault.js';
import {createConnectionsHandler} from '../server/ai-connections.js';
import {proposeOperator,validateNavigation} from '../server/groq-operator.js';
const headers={origin:'https://lifeos53.vercel.app','x-lifeos-admin':'1','content-type':'application/json'};
const res=()=>({code:200,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;},end(){}});
test('vault encryption authenticates content and uses unique nonces',()=>{
 const secret='s'.repeat(32),value='gsk_test_dummy_key_never_valid';
 const a=sealKey(value,secret),b=sealKey(value,secret);assert.notEqual(a,b);assert.equal(openKey(a,secret),value);assert.ok(!a.includes(value));assert.throws(()=>openKey(a,'t'.repeat(32)));assert.throws(()=>sealKey(value,'short'));
});
test('unconfigured ownership cannot be claimed by a visitor',async()=>{
 const handler=createConnectionsHandler({ownerUid:'',requireUser:async()=>({uid:'alice'})});let r=res();await handler({method:'GET',headers},r);assert.deepEqual(r.body,{ownerConfigured:false,accountUid:'alice'});
 r=res();await handler({method:'PUT',headers,body:{key:'gsk_test'}},r);assert.equal(r.code,403);
});
test('non-owner and unverified accounts cannot read or write connection',async()=>{
 for(const u of [{uid:'bob',email_verified:true},{uid:'alice',email_verified:false}]){
  const handler=createConnectionsHandler({ownerUid:'alice',requireUser:async()=>u,readIntegration:()=>assert.fail('must not read')});const r=res();await handler({method:'GET',headers},r);assert.equal(r.code,403);
 }
});
test('saving requires fresh authentication and sends only encrypted key to Python',async()=>{
 const secret='s'.repeat(32),key='gsk_test_dummy_key_never_valid';let saved;
 const d={ownerUid:'alice',requireUser:async()=>({uid:'alice',email_verified:true,auth_time:Math.floor(Date.now()/1000)}),limit:async()=>{},sealKey:k=>sealKey(k,secret),privatePython:async p=>{assert.equal(openKey(p.sealedKey,secret),key);assert.ok(!JSON.stringify(p).includes(key));},saveIntegration:async p=>{saved=p;return {configured:true,revision:'v2'};}};
 const r=res();await createConnectionsHandler(d)({method:'PUT',headers,body:{key,revision:'v1'}},r);assert.equal(r.code,200);assert.equal(saved.revision,'v1');assert.ok(!JSON.stringify(r.body).includes(key));
 const stale=res();await createConnectionsHandler({...d,requireUser:async()=>({uid:'alice',email_verified:true,auth_time:1})})({method:'PUT',headers,body:{key,revision:'v1'}},stale);assert.equal(stale.code,401);
 const cross=res();await createConnectionsHandler(d)({method:'PUT',headers:{...headers,origin:'https://evil.test'},body:{key,revision:'v1'}},cross);assert.equal(cross.code,403);
});
test('connection status never returns encrypted key',async()=>{
 const r=res();await createConnectionsHandler({ownerUid:'alice',requireUser:async()=>({uid:'alice',email_verified:true}),readIntegration:async()=>({sealedKey:'secretcipher',revision:'v1',model:'model'})})({method:'GET',headers},r);assert.equal(r.body.configured,true);assert.ok(!JSON.stringify(r.body).includes('secretcipher'));
});
test('operator validates model actions and restricts navigation',async()=>{
 assert.throws(()=>validateNavigation({screen:'https://evil.test'}));
 const old=process.env.CRON_SECRET;process.env.CRON_SECRET='s'.repeat(32);
 try{
 const result=await proposeOperator('Add reading',[],{localDate:'2026-09-29'},async(url,options)=>{assert.equal(url,'https://lifeos53.vercel.app/api/deliver');const body=JSON.parse(options.body);assert.equal(body.channel,'groq');return Response.json({content:JSON.stringify({reply:'Review',actions:[{type:'create_task',ref:'one',title:'Reading'}],navigation:{screen:'tasks'}})});},async()=>({sealedKey:'encrypted',model:'openai/gpt-oss-20b'}));
 assert.equal(result.actions[0].priority,'Med');assert.equal(result.navigation.screen,'tasks');
 await assert.rejects(proposeOperator('Hello',[],{},async()=>assert.fail(),async()=>({sealedKey:''})),/not connected/);
 }finally{if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;}
});
