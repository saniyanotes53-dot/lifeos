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
export async function enableBrowserAlerts(user){
 if(!user?.uid)throw new Error('Sign in to enable alerts.');
 if(!('Notification' in window))throw new Error('This browser does not support system notifications. In-app reminders are still available.');
 const permission=await Notification.requestPermission();
 if(permission!=='granted')throw new Error('Browser notifications are blocked. You can allow them in site settings; in-app reminders still work.');
 if('serviceWorker' in navigator)await navigator.serviceWorker.register('/notifications-sw.js');
 localStorage.setItem('lifeos_browser_alerts_'+user.uid,'true');
 await enableReminders(user);
}
export function browserAlertsEnabled(uid){try{return localStorage.getItem('lifeos_browser_alerts_'+uid)==='true';}catch{return false;}}
export function disableBrowserAlerts(uid){localStorage.removeItem('lifeos_browser_alerts_'+uid);}
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
    if(!remindersEnabled(uid))return;
    const system=browserAlertsEnabled(uid)&&typeof Notification!=='undefined'&&Notification.permission==='granted';
    if(document.visibilityState==='hidden'&&!system)return;
    const due=dueReminders(blocks,tasks,Date.now(),seen);
    if(!due.length)return;
    if(system){const body=due.map(b=>`${b.time} · ${b.label||'Scheduled block'}`).join(' / ');
      if('serviceWorker' in navigator)navigator.serviceWorker.ready.then(reg=>reg.showNotification('Life OS reminder',{body,tag:'lifeos-timetable',data:{url:'/?view=timetable'}})).catch(()=>{});
      else try{new Notification('Life OS reminder',{body,tag:'lifeos-timetable'});}catch{}
    }
    callback(due.map(b=>`${b.time} · ${b.label||'Scheduled block'}`).join(' / '));
    try{sessionStorage.setItem(key,JSON.stringify([...seen].slice(-500)));}catch{/* Memory still prevents duplicates during this subscription. */}
  }
  check();const timer=setInterval(check,15000);
  window.addEventListener('focus',check);
  window.addEventListener('lifeos-reminders-change',check);
  document.addEventListener('visibilitychange',check);
  return ()=>{clearInterval(timer);window.removeEventListener('focus',check);window.removeEventListener('lifeos-reminders-change',check);document.removeEventListener('visibilitychange',check);};
}
