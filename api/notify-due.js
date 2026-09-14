import {smtpReady,webPushReady,transport} from '../server/delivery.js';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {adminToken,decode} from '../server/reminder-mail.js';
import {cloudReady,dbRequest,readRecord,dueBlocks,isDue} from '../server/push-delivery.js';

const hash=value=>createHash('sha256').update(value).digest('hex');

const reminderTemplate = readFileSync(
  new URL('../email-templates/reminder.html', import.meta.url),
  'utf8'
);

export const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export function renderReminderHtml({ task, time, date, url }) {
  return reminderTemplate
    .replaceAll('{{TASK}}', escapeHtml(task))
    .replaceAll('{{TIME}}', escapeHtml(time))
    .replaceAll('{{DATE}}', escapeHtml(date))
    .replaceAll('{{TIMETABLE_URL}}', url);
}

export function formatReminderDate(remindAt, timeZone) {
  const timestamp = Number(remindAt);
  const date = Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp) : new Date();
  let zone = 'Asia/Kolkata';
  if (timeZone && typeof timeZone === 'string') {
    try {
      new Intl.DateTimeFormat('en-IN', { timeZone }).format(date);
      zone = timeZone;
    } catch {
      zone = 'Asia/Kolkata';
    }
  }
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: zone,
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(date);
  }
}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.query?.status==='1')return res.json({vapidKey:process.env.WEB_PUSH_PUBLIC_KEY||'',pushConfigured:cloudReady()&&webPushReady(),emailConfigured:cloudReady()&&smtpReady(),schedulerEnabled:cloudReady()&&process.env.NOTIFICATION_SCHEDULER_ENABLED==='true'});
 if(!process.env.CRON_SECRET||req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).json({error:'Unauthorized'});
 if(!cloudReady()||process.env.NOTIFICATION_SCHEDULER_ENABLED!=='true')return res.status(503).json({error:'Scheduled notification setup is incomplete.'});
 let accepted=0;
 try{
  const token=await adminToken(),now=Date.now();
  for(const original of await dueBlocks(token,now)){
   const block=await readRecord(token,original.path);if(!block||!isDue(block,now))continue;
   const uid=original.path.split('/')[2],base='/users/'+encodeURIComponent(uid);
   if(block.taskId&&(await readRecord(token,base+'/tasks/'+encodeURIComponent(block.taskId)))?.done)continue;
   const prefs=await readRecord(token,base+'/notificationSettings/delivery');
   const subscriptions=await dbRequest(token,base+'/pushSubscriptions?pageSize=20');
   const jobs=(subscriptions?.documents||[]).map(d=>({id:d.name.split('/').pop(),...decode({mapValue:{fields:d.fields}})})).filter(d=>d.enabled&&d.subscription&&d.provider==='webpush').map(d=>({channel:'push',...d}));
   if(prefs?.emailEnabled&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prefs.email||'')&&smtpReady())jobs.push({channel:'email',id:hash(prefs.email),email:prefs.email});
   const body=`${block.time} · ${String(block.label||'Scheduled task').slice(0,200)}`;
   for(const job of jobs){
    if(accepted>=20)throw Error('Delivery batch limit reached; remaining due jobs will retry on the next scheduler run.');
    const key=hash(original.path+':'+block.remindAt+':'+job.channel+':'+job.id),receipt=base+'/notificationReceipts/'+key;
    const claim=await dbRequest(token,receipt+'?currentDocument.exists=false',{method:'PATCH',body:JSON.stringify({fields:{createdAt:{integerValue:String(now)},channel:{stringValue:job.channel}}})});if(claim?.conflict)continue;
    try{
     if(job.channel==='push'){
      const sent=await transport({channel:'push',subscription:job.subscription,body,tag:key});if(sent.expired){await dbRequest(token,base+'/pushSubscriptions/'+encodeURIComponent(job.id),{method:'DELETE'});continue;}
     }else{
      const label = String(block.label || 'Scheduled task').slice(0, 200);
      const timetableUrl = 'https://lifeos53.vercel.app/?view=timetable';
      const dateLabel = formatReminderDate(block.remindAt, prefs?.timeZone);
      const html = renderReminderHtml({
        task: label,
        time: block.time || '',
        date: dateLabel,
        url: timetableUrl
      });
      const cleanSubjectLabel = label.replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
      await transport({
        channel: 'email',
        to: job.email,
        idempotencyKey: key,
        subject: `Life OS · ${cleanSubjectLabel || 'scheduled reminder'}`,
        text:
          `${block.time} · ${label}\n\n` +
          `Open your timetable: ${timetableUrl}\n\n` +
          `Turn off email reminders in Profile → Notifications.`,
        html
      });
     }
     accepted++;
    }catch(error){await dbRequest(token,receipt,{method:'DELETE'});throw error;}
   }
  }
  return res.json({accepted});
 }catch(error){console.error('[notify.due]',{accepted,message:error.message});return res.status(502).json({error:'Some reminders were not delivered. Check server logs.',accepted});}
}
