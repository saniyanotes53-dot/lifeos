import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseStatementCsv,statementAmount,statementDate,prepareImportRows,transactionIssues} from '../src/utils/statement-import.js';
import {saveImport} from '../src/utils/import-save.js';
import {extractStatement} from '../server/statement-import.js';
import handler from '../api/statement-import.js';

test('CSV reads Indian bank headers, preamble, quoted commas, debit/credit and UTRs without using balances',()=>{
  const result=parseStatementCsv('Statement for September\nDate,Description,Debit,Credit,Balance,UTR\n21/09/2026,"Shop, Mumbai","1,250.50",,"50,000",abc\n22/09/2026,Salary,,15000,65000,def');
  assert.equal(result.rows.length,2);assert.equal(result.rows[0].amount,1250.5);assert.equal(result.rows[0].note,'Shop, Mumbai');assert.equal(result.rows[0].date,'2026-09-21');assert.equal(result.rows[0].reference,'abc');assert.equal(result.rows[1].type,'income');
});
test('Google Pay CSV skips failed, pending and reversed transactions',()=>{
  const {rows,warnings}=parseStatementCsv('Transaction Date,Description,Amount (INR),Transaction Type,Status,UPI Transaction ID\n21 Sep 2026,Tea,40,Paid,Success,111\nSep 22 2026,Refund,20,Received,Completed,112\n22/09/2026,Shop,60,Paid,Failed,113\n22/09/2026,Taxi,80,Paid,Pending,114\n22/09/2026,Taxi,80,Paid,Reversed,115');
  assert.deepEqual(rows.map(r=>[r.type,r.amount,r.date]),[['expense',40,'2026-09-21'],['income',20,'2026-09-22']]);assert.equal(warnings.length,3);
});
test('signed amounts, BOM, CR/DR and alternate date order',()=>{
  assert.equal(statementAmount('Rs. 1,250.50'),1250.5);
  assert.equal(statementAmount('₹ 25.00 DR'),-25);
  assert.equal(statementAmount('(100.00)'),-100);
  assert.equal(statementAmount('1,500 CR'),1500);
  assert.ok(Number.isNaN(statementAmount('USD 50')));
  assert.equal(statementDate('09/21/2026','MDY'),'2026-09-21');
  assert.equal(statementDate('31/02/2026'),'');assert.equal(statementDate('2026-02-29'),'');
  const {rows}=parseStatementCsv('\uFEFFDate,Note,Amount\n2026-09-21,Tea,-50\n2026-09-22,Client,+1500');
  assert.deepEqual(rows.map(r=>r.type),['expense','income']);
});
test('unknown direction and invalid dates must be corrected, never replaced with today',()=>{
  const {rows}=parseStatementCsv('Date,Amount,Description\n31/02/2026,300,Unknown\n21/09/2026,100,Unclear');
  const review=prepareImportRows(rows);
  assert.equal(review[0].date,'');assert.equal(review[1].type,'');assert.ok(review.every(r=>!r.selected));
  assert.equal(transactionIssues({...rows[1],type:'income'}).length,0);
});
test('debit and credit on the same row are not guessed; malformed CSV rejects',()=>{
  const {rows}=parseStatementCsv('Date,Debit,Credit\n21/09/2026,100,200');
  assert.ok(transactionIssues(rows[0]).length);
  assert.throws(()=>parseStatementCsv('Date,Amount,Note\n21/09/2026,100,"broken'),/unclosed/);
  assert.throws(()=>parseStatementCsv('Merchant,Balance\nShop,200'),/headers/);
});
test('duplicate detection recognizes UTR across changed descriptions and existing manual entries',()=>{
  const a={date:'2026-09-21',amount:50,type:'expense',note:'Tea',reference:'123'},b={...a,note:'Changed merchant name'};
  const review=prepareImportRows([a,b],[]);assert.equal(review[0].selected,true);assert.equal(review[1].duplicate,true);
  assert.equal(prepareImportRows([b],[a])[0].duplicate,true);
  assert.equal(prepareImportRows([{...a,reference:''}],[{...a,reference:''}])[0].duplicate,true);
});
test('import retries after a failed second batch without duplicating the first or overwriting edited records',async()=>{
  const db=new Map();let fail=true,calls=0;
  const rows=Array.from({length:105},(_,i)=>({date:'2026-09-21',type:'expense',amount:i+1,note:`Test ${i}`}));
  const adapter={hash:async value=>createHash('sha256').update(value).digest('hex'),commit:async entries=>{
    calls++;if(calls===2&&fail)throw Error('Connection dropped');let saved=0;
    for(const e of entries)if(!db.has(e.id)){db.set(e.id,e.data);saved++;}
    return {saved,skipped:entries.length-saved};
  }};
  await assert.rejects(saveImport(rows,adapter),/Connection/);assert.equal(db.size,100);
  const first=db.keys().next().value;db.get(first).note='User correction';
  fail=false;const retry=await saveImport(rows,adapter);assert.equal(db.size,105);assert.deepEqual(retry,{saved:5,skipped:100});assert.equal(db.get(first).note,'User correction');
});
test('invalid import data never reaches storage',async()=>{
  let wrote=false;await assert.rejects(saveImport([{date:'',amount:50,type:'expense'}],{commit:()=>{wrote=true;}}),/Fix/);assert.equal(wrote,false);
});
test('PDF extraction uses structured data, preserves uncertainty and excludes provider thoughts',async()=>{
  const previous=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-only';
  try{
    const result=await extractStatement({text:'Example statement'},async(url,options)=>{
      const body=JSON.parse(options.body);assert.equal(body.generationConfig.temperature,0);assert.equal(body.contents[0].parts[1].text,'Example statement');
      return new Response(JSON.stringify({candidates:[{content:{parts:[{thought:true,text:'hidden'},{text:JSON.stringify({rows:[{date:'21/09/2026',amount:50,type:'expense',note:'Tea'},{date:'unknown',amount:0,type:'unknown',note:'Unreadable'}],warnings:['Check unreadable entry']})}]}}]}),{status:200});
    });
    assert.equal(result.rows[0].date,'2026-09-21');assert.equal(result.rows[1].date,'');assert.equal(result.rows[1].type,'');assert.equal(result.warnings.length,1);
  }finally{if(previous===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previous;}
});
test('statement API rejects unauthenticated uploads',async()=>{
  const response={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};
  await handler({method:'POST',headers:{},body:{text:'Sample'}},response);assert.equal(response.code,401);
});
