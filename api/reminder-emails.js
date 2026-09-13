import {createHash} from 'node:crypto';
import {mailReady,adminToken,reminderDocuments,reminderRecipients} from '../server/reminder-mail.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.query?.status==='1')return res.json({configured:mailReady(),enabled:mailReady()&&process.env.REMINDER_EMAILS_ENABLED==='true'});
 if(!process.env.CRON_SECRET||req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).json({error:'Unauthorized'});
 if(!mailReady()||process.env.REMINDER_EMAILS_ENABLED!=='true')return res.status(503).json({error:'Reminder email setup is incomplete or disabled.'});
 try{
  const token=await adminToken(),day=new Date().toISOString().slice(0,10),jobs=[];
  for(const collection of ['loans','billSplits'])for(const r of await reminderDocuments(token,collection))for(const recipient of reminderRecipients(collection,r))jobs.push({...recipient,path:r.path});
  if(jobs.length>20)throw Error('Daily sender capacity exceeded. Increase capacity before sending.');
  let accepted=0;
  for(const job of jobs){
   const key=createHash('sha256').update(`${day}:${job.path}:${job.email}`).digest('hex');
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[job.email],subject:'Life OS · repayment reminder',text:job.text+'\n\nThis is a recorded balance, not a payment request from Life OS. If paid or incorrect, contact the person who recorded it so they can mark it settled or disable reminders. No payment is taken automatically.'}),signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error(`Email provider rejected the send (${response.status}).`);accepted++;
   await new Promise(resolve=>setTimeout(resolve,550));
  }
  return res.json({accepted});
 }catch(e){console.error('[reminder-email]',e.message);return res.status(502).json({error:'Reminder delivery did not complete. Check server logs.'});}
}
