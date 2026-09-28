import {reminderPreferenceId,unsubscribeUrl,handleUnsubscribe} from '../server/reminder-preferences.js';
import {renderPaymentEmail} from '../server/payment-email.js';
import {transport} from '../server/delivery.js';
import {dbRequest,readRecord} from '../server/push-delivery.js';
import {createHash} from 'node:crypto';
import {mailReady,adminToken,reminderDocuments,reminderRecipients,reminderOwner} from '../server/reminder-mail.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.query?.unsubscribe)return handleUnsubscribe(req,res,{adminToken,dbRequest});
 if(req.query?.status==='1')return res.json({configured:mailReady(),enabled:mailReady()&&process.env.REMINDER_EMAILS_ENABLED==='true'});
 if(!process.env.CRON_SECRET||req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).json({error:'Unauthorized'});
 if(!mailReady()||process.env.REMINDER_EMAILS_ENABLED!=='true')return res.status(503).json({error:'Reminder email setup is incomplete or disabled.'});
 try{
  const token=await adminToken(),day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date()),jobs=[];
  const owners=new Map(),preferences=new Map();let skippedMissingOwner=0;
  for(const collection of ['loans','billSplits'])for(const r of await reminderDocuments(token,collection)){
   if(!r.emailReminders||r.settled)continue;
   const uid=r.path.match(/\/documents\/users\/([^/]+)\//)?.[1];
   if(!uid)continue;
   if(!owners.has(uid))owners.set(uid,await reminderOwner(token,uid));
   const owner=owners.get(uid);
   if(!owner){skippedMissingOwner++;continue;}
   for(const recipient of reminderRecipients(collection,r,owner)){
    const preferenceId=reminderPreferenceId(uid,recipient.email);
    if(!preferences.has(preferenceId))preferences.set(preferenceId,await readRecord(token,`/emailSuppressions/${preferenceId}`));
    if(preferences.get(preferenceId)?.blocked)continue;
    jobs.push({...recipient,path:r.path,unsubscribeUrl:unsubscribeUrl(preferenceId)});
   }
  }
  if(jobs.length>20)throw Error('Daily sender capacity exceeded. Increase capacity before sending.');
  let accepted=0;
  for(const job of jobs){
   const key=createHash('sha256').update(`${day}:${job.path}:${job.email}`).digest('hex');
   const userBase=job.path.split('/documents')[1].split('/').slice(0,3).join('/');
   const receipt=userBase+'/notificationReceipts/'+key;
   const claim=await dbRequest(token,receipt+'?currentDocument.exists=false',{method:'PATCH',body:JSON.stringify({fields:{createdAt:{integerValue:String(Date.now())},channel:{stringValue:'daily-email'}}})});
   if(claim?.conflict)continue;
   try{await transport({channel:'email',to:job.email,idempotencyKey:key,...renderPaymentEmail(job)});accepted++;}
   catch(error){await dbRequest(token,receipt,{method:'DELETE'});throw error;}
  }
  return res.json({accepted,skippedMissingOwner});
 }catch(e){console.error('[reminder-email]',{code:e.code||'delivery-failed'});return res.status(502).json({error:'Reminder delivery did not complete. Check server logs.'});}
}
