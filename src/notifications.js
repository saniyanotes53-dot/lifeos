import {parseLocalDate} from './utils/dates.js';
const preference=uid=>`lifeos_reminders_${uid}`;
export function remindersEnabled(uid){
  try{return !!uid&&localStorage.getItem(preference(uid))==='true';}catch{return false;}
}
export async function enableReminders(user){
  if(!user?.uid)throw new Error('Sign in to enable reminders.');
  localStorage.setItem(preference(user.uid),'true');
  window.dispatchEvent(new Event('lifeos-reminders-change'));
  return true;
}
export async function disableReminders(user){
  if(user?.uid)localStorage.removeItem(preference(user.uid));
  window.dispatchEvent(new Event('lifeos-reminders-change'));
}
export function dueReminders(blocks,tasks,now,seen){
  const complete=new Set(tasks.filter(t=>t.done).map(t=>t.id));
  return blocks.filter(b=>{
    if(b.done||complete.has(b.taskId)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time||''))return false;
    const when=parseLocalDate(b.date);
    if(!when)return false;
    const [h,m]=b.time.split(':').map(Number);when.setHours(h,m,0,0);
    const key=`${b.id}:${when.getTime()}`;
    if(when.getTime()>now||now-when.getTime()>5*60000||seen.has(key))return false;
    seen.add(key);return true;
  });
}
export function watchReminders(uid,blocks,tasks,callback){
  if(!uid)return ()=>{};
  const key=`lifeos_reminders_seen_${uid}`;
  let seen;
  try{seen=new Set(JSON.parse(sessionStorage.getItem(key)||'[]'));}catch{seen=new Set();}
  function check(){
    if(!remindersEnabled(uid)||document.visibilityState==='hidden')return;
    const due=dueReminders(blocks,tasks,Date.now(),seen);
    if(!due.length)return;
    callback(due.map(b=>`${b.time} · ${b.label||'Scheduled block'}`).join(' / '));
    try{sessionStorage.setItem(key,JSON.stringify([...seen].slice(-500)));}catch{/* Memory still prevents duplicates during this subscription. */}
  }
  check();const timer=setInterval(check,15000);
  window.addEventListener('focus',check);
  window.addEventListener('lifeos-reminders-change',check);
  document.addEventListener('visibilitychange',check);
  return ()=>{clearInterval(timer);window.removeEventListener('focus',check);window.removeEventListener('lifeos-reminders-change',check);document.removeEventListener('visibilitychange',check);};
}
