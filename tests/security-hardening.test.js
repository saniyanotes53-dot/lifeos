import test from 'node:test';
import assert from 'node:assert/strict';
import {atomicRecord,persistentLimit} from '../server/security-store.js';
import {verifyPasswordReset,confirmPasswordReset,hashEmail,hashOTP,hashResetToken} from '../server/password-reset.js';
import {checkAccountState} from '../server/firebase.js';
import {validScreenshot} from '../server/upload-validation.js';
function database(){
 const docs=new Map();let revision=0;
 const read=async path=>docs.get(path)||null;
 const write=async(path,fields,expected)=>{if(docs.get(path)?.updateTime!==expected)throw Object.assign(Error('conflict'),{status:409});docs.set(path,{fields,updateTime:String(++revision)});};
 return {atomic:(path,fn)=>atomicRecord(path,fn,{read,write,token:'test'}),set:async(path,data)=>atomicRecord(path,()=>data,{read,write,token:'test'}),del:async path=>docs.delete(path)};
}
test('concurrent OTP consumption issues exactly one authorization',async()=>{
 const db=database(),secret='test-secret-long-enough-for-reset-tests',email='test@example.test',now=Date.now(),emailHash=hashEmail(email,secret);
 await db.set('passwordResetRequests/'+emailHash,{uid:'owner',otpHash:hashOTP(emailHash,'123456',secret),expiresAt:now+10000,attemptCount:0,used:false,verified:false});
 const results=await Promise.allSettled(Array.from({length:3},()=>verifyPasswordReset(email,'123456',{db,secret,now})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
});
test('concurrent reset-token replay changes password once',async()=>{
 const db=database(),secret='test-secret-long-enough-for-reset-tests',token='a'.repeat(64);let changes=0;
 await db.set('passwordResetTokens/'+hashResetToken(token,secret),{uid:'owner',expiresAt:Date.now()+10000,used:false});
 const results=await Promise.allSettled(Array.from({length:3},()=>confirmPasswordReset(token,'new-password',{db,secret,updateUserPassword:async()=>{changes++;}})));
 assert.equal(changes,1);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
});
test('persistent IP quota survives concurrent requests',async()=>{
 const db=database(),req={headers:{'x-vercel-forwarded-for':'192.0.2.1'}};
 const results=await Promise.allSettled(Array.from({length:5},()=>persistentLimit(req,'request',3,3600000,'test-secret',db.atomic)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,3);
});
test('deleted, disabled and revoked Firebase accounts fail closed',async()=>{
 const user={uid:'owner',auth_time:100};
 for(const account of [null,{localId:'other'},{localId:'owner',disabled:true},{localId:'owner',validSince:'101'}])await assert.rejects(checkAccountState(user,async()=>Response.json({users:account?[account]:[]}),async()=>'test'));
 await checkAccountState(user,async()=>Response.json({users:[{localId:'owner',validSince:'99'}]}),async()=>'test');
});
test('screenshot validation rejects disguised files and oversized payloads',()=>{
 assert.equal(validScreenshot(Buffer.from('<svg onload="alert(1)">').toString('base64')),false);
 assert.equal(validScreenshot('a'.repeat(2200004)),false);
 assert.equal(validScreenshot(Buffer.from([255,216,255,217]).toString('base64')),true);
 assert.equal(validScreenshot('/9j/2Q==extra'),false);
});
