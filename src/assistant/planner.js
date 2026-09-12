import { localDateKey, parseLocalDate } from '../utils/dates.js';
import { filterPeriod, sleepByDay, money } from '../utils/analytics.js';
export function minutes(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return NaN;
  const [h,m]=value.split(':').map(Number); return h*60+m;
}
export const clock = value => `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
export function overlaps(a,b) { return a.start < b.end && b.start < a.end; }
export function interval(block) {
  const start=minutes(block.time);
  const duration=Number(block.durationMinutes);
  return {start,end:start+(duration>0&&duration<=1440?duration:30)};
}
export function proposePlan({tasks=[],blocks=[],date=localDateKey(),start='09:00',end='18:00',duration=30,now=new Date()}) {
  if(!parseLocalDate(date)||date<localDateKey(now)) throw new Error('Choose today or a future date.');
  let cursor=minutes(start);const finish=minutes(end);duration=Number(duration);
  if(!Number.isFinite(cursor)||!Number.isFinite(finish)||finish<=cursor||![15,30,45,60,90].includes(duration)) throw new Error('Choose a valid time window and session length.');
  if(date===localDateKey(now))cursor=Math.max(cursor,Math.ceil((now.getHours()*60+now.getMinutes()+1)/5)*5);
  const existing=blocks.filter(b=>b.date===date);
  if(existing.some(b=>!Number.isFinite(minutes(b.time))))throw new Error('An existing block has an invalid time. Correct it before planning.');
  const busy=existing.map(interval);
  const scheduled=new Set(blocks.filter(b=>b.date>=date&&b.taskId&&!b.done).map(b=>b.taskId));
  const rank={High:0,Med:1,Low:2};
  const pending=tasks.filter(t=>!t.done&&t.id&&!scheduled.has(t.id)).sort((a,b)=>(rank[a.priority]??3)-(rank[b.priority]??3)||String(a.date||'').localeCompare(String(b.date||''))||a.id.localeCompare(b.id));
  const proposed=[],unplaced=[];
  for(const task of pending){
    while(cursor+duration<=finish&&busy.some(b=>overlaps({start:cursor,end:cursor+duration},b)))cursor+=5;
    if(cursor+duration>finish||proposed.length>=50){unplaced.push(task);continue;}
    proposed.push({date,time:clock(cursor),durationMinutes:duration,label:String(task.title||'Untitled task').slice(0,200),taskId:task.id,done:false,source:'assistant'});
    busy.push({start:cursor,end:cursor+duration});cursor+=duration+5;
  }
  return {blocks:proposed,unplaced:unplaced.map(t=>t.title),date};
}
export function reportSummary({tasks=[],sleep=[],tx=[],workouts=[]},today=localDateKey()) {
  const recent=filterPeriod(tasks,7,today),nights=sleepByDay(filterPeriod(sleep,7,today)),transactions=filterPeriod(tx,7,today),exercise=filterPeriod(workouts,7,today);
  const spent=transactions.filter(x=>x.type==='expense').reduce((n,x)=>n+(Number(x.amount)||0),0);
  const income=transactions.filter(x=>x.type==='income').reduce((n,x)=>n+(Number(x.amount)||0),0);
  return `Past 7 days, including ${today}:\n• Tasks: ${recent.filter(x=>x.done).length} of ${recent.length} tasks added in this period are complete. ${tasks.filter(x=>!x.done).length} tasks remain open overall.\n• Sleep: ${nights.length?`${(nights.reduce((n,x)=>n+x.hours,0)/nights.length).toFixed(1)}h average across ${nights.length} logged dates.`:'Not logged; sleep progress is unknown.'}\n• Money: ${money(spent)} expenses and ${money(income)} income recorded.\n• Workouts: ${exercise.length} sessions recorded.\nThese summaries reflect saved records only, not unlogged activity.`;
}
export function intent(text){
  if(/\b(plan|schedule|timetable|organis[ez]|organiz[ez])\b/i.test(text))return 'plan';
  if(/\b(report|analys[ei]|summary|summari[sz]e|spending|sleep|progress)\b/i.test(text))return 'report';
  if(/\b(remind|reminder|notification|notifications|push)\b/i.test(text))return 'reminders';
  return 'help';
}
