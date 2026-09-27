import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPaymentEmail} from '../server/payment-email.js';
import {reminderRecipients} from '../server/reminder-mail.js';
test('payment reminders identify debtors and creditors and omit settled participants',()=>{
 const jobs=reminderRecipients('billSplits',{title:'Dinner',total:300,people:'Ali, Bea, Cam',contributions:{Ali:200,Bea:0,Cam:100},emails:{Ali:'a@example.com',Bea:'b@example.com',Cam:'c@example.com'},emailReminders:true});
 assert.equal(jobs.length,2);
 assert.equal(jobs.find(x=>x.name==='Ali').kind,'receivable');
 assert.equal(jobs.find(x=>x.name==='Bea').kind,'payable');
 assert.match(renderPaymentEmail(jobs[0]).html,/money owed to you/);
 assert.match(renderPaymentEmail(jobs[1]).text,/outstanding payment/);
});
test('payment HTML escapes untrusted names and includes plain text fallback',()=>{
 const mail=renderPaymentEmail({name:'<img src=x>',title:'A & B',text:'<script>alert(1)</script>',kind:'payable',dueDate:'2026-10-01'});
 assert.ok(!mail.html.includes('<script>'));
 assert.match(mail.html,/&lt;img src=x&gt;/);
 assert.match(mail.html,/A &amp; B/);
 assert.match(mail.text,/2026-10-01/);
 assert.ok(mail.html.length<12000);
 assert.ok(!mail.html.includes('{{'));
});
test('loan contact receives the correct repayment perspective',()=>{
 const record={person:'Contact',email:'c@example.com',amount:200,emailReminders:true};
 assert.equal(reminderRecipients('loans',{...record,type:'lend'})[0].kind,'payable');
 assert.equal(reminderRecipients('loans',{...record,type:'borrow'})[0].kind,'receivable');
});

test('loan reminders name the account owner, borrower and lender in both directions',()=>{
 const owner={name:'Murtaza Bombaywala',email:'owner@example.com'};
 const record={person:'Taher Arsiwala',email:'taher@example.com',amount:80,emailReminders:true,dueDate:'2026-09-21'};
 const lent=reminderRecipients('loans',{...record,type:'lend'},owner)[0];
 assert.equal(lent.borrower,'Taher Arsiwala');assert.equal(lent.lender,owner.name);
 const mail=renderPaymentEmail(lent);
 assert.match(mail.text,/Taher Arsiwala owes Murtaza Bombaywala ₹80.00/);
 assert.match(mail.html,/Sent on behalf of/);assert.match(mail.html,/owner@example.com/);
 assert.equal(mail.replyTo,'owner@example.com');assert.match(mail.subject,/Murtaza Bombaywala/);
 const borrowed=reminderRecipients('loans',{...record,type:'borrow'},owner)[0];
 assert.equal(borrowed.borrower,owner.name);assert.equal(borrowed.lender,'Taher Arsiwala');
 assert.match(renderPaymentEmail(borrowed).text,/Murtaza Bombaywala owes Taher Arsiwala/);
 assert.equal(reminderRecipients('loans',{...record,type:'unknown'},owner).length,0);
});
