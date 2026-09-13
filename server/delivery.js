export const smtpReady=()=>Boolean(process.env.GMAIL_ADDRESS&&process.env.GMAIL_APP_PASSWORD);
export const webPushReady=()=>Boolean(process.env.WEB_PUSH_PUBLIC_KEY&&process.env.WEB_PUSH_PRIVATE_KEY&&process.env.WEB_PUSH_CONTACT);
export async function transport(payload){
 const response=await fetch('https://lifeos53.vercel.app/api/deliver',{method:'POST',headers:{Authorization:`Bearer ${process.env.CRON_SECRET}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(`Python delivery failed (${response.status}). Check Gmail/Web Push configuration.`);
 return result;
}
