import {createHmac,timingSafeEqual} from 'node:crypto';
const root='https://lifeos53.vercel.app/api/reminder-emails';
function key(){if(!process.env.CRON_SECRET)throw Error('Reminder signing is unavailable.');return process.env.CRON_SECRET;}
export function reminderPreferenceId(uid,email){return createHmac('sha256',key()).update(`payment-recipient:${uid}:${email.trim().toLowerCase()}`).digest('hex');}
export function unsubscribeToken(id){return id+'.'+createHmac('sha256',key()).update('payment-unsubscribe:'+id).digest('hex');}
export function verifyUnsubscribeToken(token){
 if(typeof token!=='string'||!/^([a-f0-9]{64})\.([a-f0-9]{64})$/.test(token))return null;
 const [id,sig]=token.split('.');const expected=unsubscribeToken(id).split('.')[1];
 return timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(expected,'hex'))?id:null;
}
export function unsubscribeUrl(id){return `${root}?unsubscribe=${unsubscribeToken(id)}`;}
export async function handleUnsubscribe(req,res,{adminToken,dbRequest}){
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");
 try {
  const id=verifyUnsubscribeToken(req.query?.unsubscribe);
  if(!id)return res.status(400).send('This reminder preferences link is invalid.');
  if(req.method==='POST'){
   const token=await adminToken();
   await dbRequest(token,`/emailSuppressions/${id}`,{method:'PATCH',body:JSON.stringify({fields:{blocked:{booleanValue:true},updatedAt:{integerValue:String(Date.now())}}})});
   res.setHeader('Content-Type','text/html; charset=utf-8');
   return res.status(200).send('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reminders stopped · LIFE OS</title><body style="font:17px system-ui;max-width:540px;margin:60px auto;padding:24px"><h1>Payment reminders stopped</h1><p>You will no longer receive payment reminders from this LIFE OS account. This does not change any balance or mark a payment as settled.</p></body></html>');
  }
  if(req.method!=='GET')return res.status(405).send('Method not supported.');
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.status(200).send(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reminder preferences · LIFE OS</title><body style="font:17px system-ui;max-width:540px;margin:60px auto;padding:24px"><h1>Stop payment reminders?</h1><p>This stops payment reminders from the account that sent this email. It does not change your balance or other LIFE OS emails.</p><form method="post" action="${unsubscribeUrl(id)}"><button style="padding:14px 20px;font:inherit">Stop these reminders</button></form></body></html>`);
 }catch{return res.status(503).send('Could not update your reminder preference. Please try again.');}
}
