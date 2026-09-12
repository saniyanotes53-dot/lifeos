import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {verifyFirebaseToken,projectId} from '../server/firebase.js';
const now=new Date('2026-09-12T12:00:00Z'),seconds=now.getTime()/1000;
const keys=await generateKeyPair('RS256');
const base={sub:'alice',aud:projectId,iss:`https://securetoken.google.com/${projectId}`,iat:seconds-10,auth_time:seconds-20,exp:seconds+3600};
const sign=claims=>new SignJWT(claims).setProtectedHeader({alg:'RS256',kid:'test-key'}).sign(keys.privateKey);
test('Firebase verification accepts a signed token for this project',async()=>{
  const verified=await verifyFirebaseToken(await sign(base),keys.publicKey,now);assert.equal(verified.uid,'alice');
});
test('Firebase verification rejects forged signatures, wrong project, expiry and invalid claims',async()=>{
  const other=await generateKeyPair('RS256');
  await assert.rejects(verifyFirebaseToken(await sign(base),other.publicKey,now));
  for(const patch of [{aud:'other-project'},{iss:'https://attacker.test'},{exp:seconds-1},{iat:seconds+1},{auth_time:seconds+1},{auth_time:'yesterday'},{sub:''},{sub:'../bob'},{sub:'x'.repeat(129)}]){
    await assert.rejects(verifyFirebaseToken(await sign({...base,...patch}),keys.publicKey,now));
  }
  const {auth_time,...missing}=base;await assert.rejects(verifyFirebaseToken(await sign(missing),keys.publicKey,now));
});
