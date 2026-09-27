import test from 'node:test';
import assert from 'node:assert/strict';
import {reminderOwner} from '../server/reminder-mail.js';
import {reminderPreferenceId,unsubscribeToken,verifyUnsubscribeToken,handleUnsubscribe} from '../server/reminder-preferences.js';
test('owner identity is resolved by record UID; reply email comes only from verified Auth account',async()=>{
 const call=async(url,options)=>url.includes('firestore')?{ok:true,json:async()=>({fields:{displayName:{stringValue:'Profile Name'},email:{stringValue:'spoof@example.com'}}})}:{ok:true,json:async()=>({users:[{localId:'owner',displayName:'Auth Name',email:'verified@example.com',emailVerified:true}]})};
 assert.deepEqual(await reminderOwner('token','owner',call),{name:'Profile Name',email:'verified@example.com',uid:'owner'});
 const unverified=async(url)=>url.includes('firestore')?{ok:false,status:404}:{ok:true,json:async()=>({users:[{localId:'owner',displayName:'Auth Name',email:'unchecked@example.com',emailVerified:false}]})};
 assert.deepEqual(await reminderOwner('token','owner',unverified),{name:'Auth Name',email:'',uid:'owner'});
 const disabled=async()=>({ok:true,json:async()=>({users:[{localId:'owner',disabled:true}]})});
 assert.equal(await reminderOwner('token','owner',disabled),null);
 await assert.rejects(reminderOwner('token','a/b',call));
});
test('recipient opt-out is signed, does not leak addresses and GET never changes preferences',async()=>{
 const old=process.env.CRON_SECRET;process.env.CRON_SECRET='test-only-key';
 try{
 const id=reminderPreferenceId('owner','Contact@example.com');
 assert.equal(id,reminderPreferenceId('owner','contact@example.com'));
 assert.notEqual(id,reminderPreferenceId('another-owner','contact@example.com'));
 const token=unsubscribeToken(id);assert.equal(verifyUnsubscribeToken(token),id);assert.equal(verifyUnsubscribeToken(token.slice(0,-1)+'z'),null);
 let writes=0;const deps={adminToken:async()=>'token',dbRequest:async(_,path,options)=>{writes++;assert.equal(path,`/emailSuppressions/${id}`);assert.equal(JSON.parse(options.body).fields.blocked.booleanValue,true);}};
 const res=()=>({code:200,setHeader(){},status(v){this.code=v;return this;},send(v){this.body=v;return this;}});
 const get=res();await handleUnsubscribe({method:'GET',query:{unsubscribe:token}},get,deps);assert.equal(writes,0);assert.match(get.body,/Stop these reminders/);
 const post=res();await handleUnsubscribe({method:'POST',query:{unsubscribe:token}},post,deps);assert.equal(writes,1);assert.match(post.body,/reminders stopped/);
 const invalid=res();await handleUnsubscribe({method:'POST',query:{unsubscribe:'bad'}},invalid,deps);assert.equal(invalid.code,400);assert.equal(writes,1);
 }finally{if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;}
});
