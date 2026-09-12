import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dateRange, shiftDate, weekDates, parseLocalDate } from '../src/utils/dates.js';
import { filterPeriod, sleepByDay, monthlyTransactions, percentage, nutritionStatus, dailySpending } from '../src/utils/analytics.js';

test('local calendar dates survive Indian midnight and month boundaries', () => {
  const result = execFileSync(process.execPath, ['--input-type=module', '-e', `import {localDateKey} from './src/utils/dates.js'; import {monthlyTransactions} from './src/utils/analytics.js'; console.log(JSON.stringify([localDateKey(new Date('2026-08-31T19:00:00Z')),monthlyTransactions([{date:'2026-09-01',type:'expense',amount:40}],'2026-09-12',1)[0]]));`], {cwd: new URL('..', import.meta.url), env: {...process.env, TZ:'Asia/Kolkata'}, encoding:'utf8'});
  const [date, month] = JSON.parse(result);
  assert.equal(date, '2026-09-01'); assert.equal(month.key,'2026-09'); assert.equal(month.spent,40);
});
test('seven days include today, exclude future, old and invalid records', () => {
  assert.deepEqual(dateRange(7,'2026-09-12'),{start:'2026-09-06',end:'2026-09-12'});
  const dates=['2026-09-05','2026-09-06','2026-09-12','2026-09-13','invalid'];
  assert.deepEqual(filterPeriod(dates.map(date=>({date})),7,'2026-09-12').map(x=>x.date), dates.slice(1,3));
  assert.equal(parseLocalDate('2026-02-30'),null);
  assert.equal(shiftDate('2026-03-01',-1),'2026-02-28');
  assert.deepEqual(weekDates('2026-09-13'),['2026-09-07','2026-09-08','2026-09-09','2026-09-10','2026-09-11','2026-09-12','2026-09-13']);
});
test('calendar arithmetic remains stable across DST', () => {
 const result=execFileSync(process.execPath,['--input-type=module','-e',`import {shiftDate} from './src/utils/dates.js'; console.log(shiftDate('2026-03-08',1),shiftDate('2026-11-01',1));`],{cwd:new URL('..',import.meta.url),env:{...process.env,TZ:'America/New_York'},encoding:'utf8'});
 assert.equal(result.trim(),'2026-03-09 2026-11-02');
});
test('sleep dates sort, legacy duplicates average, saved night takes precedence', () => {
 const records=[{date:'2026-09-12',hours:6},{date:'2026-09-11',hours:7},{date:'2026-09-12',hours:8},{date:'2026-09-10',hours:null}];
 assert.deepEqual(sleepByDay(records),[{date:'2026-09-11',hours:7,entries:1},{date:'2026-09-12',hours:7,entries:2}]);
 assert.equal(sleepByDay([...records,{id:'2026-09-12',date:'2026-09-12',hours:9}])[1].hours,9);
});
test('month totals and daily spending reflect actual transactions', () => {
 const records=[{date:'2026-09-12',type:'expense',amount:'40'},{date:'2026-09-12',type:'income',amount:100},{date:'2026-09-13',type:'expense',amount:80},{date:'2026-08-31',type:'expense',amount:20}];
 const months=monthlyTransactions(records,'2026-09-12',2);
 assert.deepEqual(months.map(x=>[x.key,x.spent,x.income]),[['2026-08',20,0],['2026-09',40,100]]);
 assert.deepEqual(dailySpending(records.slice(0,2)),[{date:'2026-09-12',amount:40}]);
});
test('small progress remains visible and no meal logs mean unknown progress', () => {
 assert.equal(percentage(40,10000),'0.4'); assert.equal(percentage(1,10000),'<0.1');
 assert.equal(nutritionStatus([],2000,'2026-09-12').hasLogs,false);
 assert.equal(nutritionStatus([{date:'2026-09-12',cal:500}],2000,'2026-09-12').badge,'Logged so far');
});
