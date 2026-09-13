import {transport} from '../server/delivery.js';
import {dbRequest} from '../server/push-delivery.js';
import {createHash} from 'node:crypto';
import {mailReady,adminToken,reminderDocuments,reminderRecipients} from '../server/reminder-mail.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.query?.status==='1')return res.json({configured:mailReady(),enabled:mailReady()&&process.env.REMINDER_EMAILS_ENABLED==='true'});
 if(!process.env.CRON_SECRET||req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).json({error:'Unauthorized'});
 if(!mailReady()||process.env.REMINDER_EMAILS_ENABLED!=='true')return res.status(503).json({error:'Reminder email setup is incomplete or disabled.'});
 try{
  const token=await adminToken(),day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date()),jobs=[];
  for(const collection of ['loans','billSplits'])for(const r of await reminderDocuments(token,collection))for(const recipient of reminderRecipients(collection,r))jobs.push({...recipient,path:r.path});
  if(jobs.length>20)throw Error('Daily sender capacity exceeded. Increase capacity before sending.');
  let accepted=0;
  for(const job of jobs){
   const key=createHash('sha256').update(`${day}:${job.path}:${job.email}`).digest('hex');
   const userBase=job.path.split('/documents')[1].split('/').slice(0,3).join('/');
   const receipt=userBase+'/notificationReceipts/'+key;
   const claim=await dbRequest(token,receipt+'?currentDocument.exists=false',{method:'PATCH',body:JSON.stringify({fields:{createdAt:{integerValue:String(Date.now())},channel:{stringValue:'daily-email'}}})});
   if(claim?.conflict)continue;
   try{await transport({channel:'email',to:job.email,idempotencyKey:key,subject:'Life OS · repayment reminder',text:job.text+'\n\nIf paid or incorrect, contact the person who recorded this balance so they can mark it settled or disable reminders. No payment is taken automatically.'});accepted++;}
   catch(error){await dbRequest(token,receipt,{method:'DELETE'});throw error;}
  }
  return res.json({accepted});
 }catch(e){console.error('[reminder-email]',e.message);return res.status(502).json({error:'Reminder delivery did not complete. Check server logs.'});}
}
