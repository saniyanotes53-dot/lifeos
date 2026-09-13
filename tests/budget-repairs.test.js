import test from 'node:test';
import assert from 'node:assert/strict';
import {transactionDefaults} from '../src/assistant/transaction-defaults.js';
import {validateActions} from '../src/assistant/actions.js';
import {billLedger} from '../src/assistant/budget-tools.js';
import {reminderRecipients} from '../server/reminder-mail.js';
test('expense omissions use device date and Other without inventing money',()=>{
 const a=transactionDefaults({type:'create_transaction',ref:'a',amount:350},{localDate:'2026-09-13'},'Log an expense of 350Rs for spectacles');
 assert.equal(validateActions([a])[0].date,'2026-09-13');assert.equal(a.category,'Other');assert.equal(a.transactionType,'expense');
 assert.throws(()=>validateActions([transactionDefaults({...a,amount:undefined},{},'hello')]));
 assert.throws(()=>validateActions([transactionDefaults({...a,date:'2026-02-31'},{localDate:'2026-09-13'})]));
});
test('multiple payers produce conserved balances and exact dues',()=>{
 const r={total:100,people:'A, B, C',contributions:{A:60,B:40,C:0}};
 const ledger=billLedger(r);assert.deepEqual(ledger.transfers,[{from:'C',to:'A',amount:26.66},{from:'C',to:'B',amount:6.67}]);
 assert.equal(Math.round(ledger.rows.reduce((s,r)=>s+r.net,0)*100),0);
 assert.throws(()=>billLedger({...r,contributions:{A:60,B:30}}));
 assert.deepEqual(billLedger({...r,settled:true}).transfers,[]);
});
test('legacy single payer records remain readable',()=>{
 assert.deepEqual(billLedger({total:100,people:'A, B',paidBy:'A'}).transfers,[{from:'B',to:'A',amount:50}]);
});
test('reminder emails require opt in and stop on settlement',()=>{
 const r={person:'A',amount:100,email:'a@example.com',type:'lend',emailReminders:true};
 assert.equal(reminderRecipients('loans',r).length,1);
 assert.equal(reminderRecipients('loans',{...r,settled:true}).length,0);
 assert.equal(reminderRecipients('loans',{...r,emailReminders:false}).length,0);
 const bill={total:100,people:'A, B',paidBy:'A',emails:{A:'a@example.com',B:'b@example.com'},emailReminders:true};
 assert.equal(reminderRecipients('billSplits',bill).length,2);
 assert.equal(reminderRecipients('billSplits',{...bill,settled:true}).length,0);
});
