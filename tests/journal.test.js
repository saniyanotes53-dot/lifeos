import test from 'node:test';
import assert from 'node:assert/strict';
import {NAMAZ,namazTaskId,validateHifz,mergedOptions} from '../src/journal/model.js';
import {paymentToken,readPayment,upiUri} from '../server/upi.js';
import {reminderRecipients} from '../server/reminder-mail.js';
import {renderPaymentEmail} from '../server/payment-email.js';
test('make-up task IDs are stable and distinct across dates and three slots',()=>{
 assert.equal(namazTaskId('2026-10-18','Fajr'),namazTaskId('2026-10-18','Fajr'));
 assert.equal(new Set(NAMAZ.map(s=>namazTaskId('2026-10-18',s))).size,3);
 assert.notEqual(namazTaskId('2026-10-18','Fajr'),namazTaskId('2026-10-19','Fajr'));
 assert.throws(()=>namazTaskId('2026-02-31','Fajr'));
});
test('custom options override defaults and preserve hidden options',()=>{
 const all=mergedOptions([{id:'namaz-2',kind:'namaz-status',label:'Make up later',hidden:false,behavior:'missed'}]);
 assert.equal(all.filter(o=>o.id==='namaz-2').length,1);assert.equal(all.find(o=>o.id==='namaz-2').behavior,'missed');
});
test('Hifz validates actual surah ayah limits and ordered ranges',()=>{
 assert.equal(validateHifz({surah:1,fromAyah:1,toAyah:7,juz:1}),true);
 for(const x of [{surah:1,fromAyah:1,toAyah:8,juz:1},{surah:115,fromAyah:1,toAyah:1,juz:1},{surah:2,fromAyah:8,toAyah:3,juz:1},{surah:2,fromAyah:1,toAyah:2,juz:31}])assert.throws(()=>validateHifz(x));
});
test('payment links reject tampering, expiry, invalid payees and amounts',()=>{
 const p={upi:'name@bank',name:'Name',amount:80},secret='test-key',now=100;
 const token=paymentToken(p,secret,now);assert.equal(readPayment(token,secret,now).amount,80);
 assert.equal(readPayment(token,'wrong',now),null);assert.equal(readPayment(token,secret,now+31*86400000),null);
 assert.equal(readPayment(token+'x',secret,now),null);assert.equal(paymentToken({...p,amount:-1},secret),null);
 assert.match(upiUri(p),/^upi:\/\/pay\?pa=name%40bank/);
});
test('Pay Now only appears when the verified record owner is the lender and opted in',()=>{
 const old=process.env.CRON_SECRET;process.env.CRON_SECRET='test';
 try{const owner={name:'Lender',email:'l@example.com',payment:{upi:'name@bank',name:'Lender'}};
 const record={person:'Borrower',email:'b@example.com',amount:80,emailReminders:true,type:'lend'};
 assert.match(renderPaymentEmail(reminderRecipients('loans',record,owner)[0]).html,/Pay Now/);
 assert.doesNotMatch(renderPaymentEmail(reminderRecipients('loans',{...record,type:'borrow'},owner)[0]).html,/Pay Now/);
 assert.doesNotMatch(renderPaymentEmail(reminderRecipients('loans',record,{name:'Lender'})[0]).html,/Pay Now/);
 }finally{if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;}
});

 test('payment landing page renders QR and UPI intent; refuses invalid token',async()=>{
  const {default:page}=await import('../server/payment-page.js');
  const old=process.env.CRON_SECRET;process.env.CRON_SECRET='test-page-secret';
  const response=()=>({headers:{},code:200,setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},send(body){this.body=body;return this;}});
  try {
   const res=response();await page({method:'GET',query:{pay:paymentToken({upi:'test@bank',name:'Test Lender',amount:80},process.env.CRON_SECRET)}},res);
   assert.equal(res.code,200);assert.match(res.body,/data:image\/png;base64,/);assert.match(res.body,/upi:\/\/pay/);assert.match(res.body,/Test Lender/);assert.equal(res.headers['Cache-Control'],'no-store');
   const invalid=response();await page({method:'GET',query:{pay:'altered'}},invalid);assert.equal(invalid.code,400);assert.doesNotMatch(invalid.body,/upi:\/\/pay/);
  }finally{if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;}
 });
