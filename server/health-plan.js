import {bearerToken,projectId} from './firebase.js';
import {decode} from './reminder-mail.js';
import {parseLocalDate,shiftDate} from '../src/utils/dates.js';
export async function healthPlan(req,user,request=fetch){
 const {date,hour}=req.body||{};
 if(!parseLocalDate(date)||!Number.isInteger(hour)||hour<0||hour>23)throw Object.assign(Error('Choose a valid local day and hour.'),{status:400});
 const base=`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(user.uid)}`;
 const headers={Authorization:`Bearer ${bearerToken(req)}`,'Content-Type':'application/json'};
 async function read(path){const r=await request(base+path,{headers,signal:AbortSignal.timeout(8000)});if(r.status===404)return {};if(!r.ok)throw Object.assign(Error('Could not read your saved health data. Please retry.'),{status:503});return r.json();}
 async function records(name){
  const r=await request(base+':runQuery',{method:'POST',headers,signal:AbortSignal.timeout(8000),body:JSON.stringify({structuredQuery:{from:[{collectionId:name}],where:{fieldFilter:{field:{fieldPath:'date'},op:'GREATER_THAN_OR_EQUAL',value:{stringValue:shiftDate(date,-6)}}},orderBy:[{field:{fieldPath:'date'},direction:'DESCENDING'}],limit:201}})});
  if(!r.ok)throw Object.assign(Error('Could not read recent health logs.'),{status:503});
  const rows=(await r.json()).filter(x=>x.document).map(x=>decode({mapValue:{fields:x.document.fields||{}}}));
  if(rows.length>200)throw Object.assign(Error('Too many recent health logs to analyze safely. Review duplicate entries first.'),{status:400});
  return rows.filter(x=>x.date<=date);
 }
 const [p,meals,workouts,sleep]=await Promise.all([read('/healthSettings/profile'),records('meals'),records('workouts'),records('sleep')]);
 const profile=decode({mapValue:{fields:p.fields||{}}});
 const payload={channel:'nutrition',context:{date,hour,profile,meals:meals.filter(m=>m.date===date),workouts,sleep}};
 if(JSON.stringify(payload).length>30000)throw Object.assign(Error('Health history is too large. Shorten notes and retry.'),{status:400});
 if(!process.env.CRON_SECRET)throw Object.assign(Error('The nutrition service needs server configuration.'),{status:503});
 const response=await request('https://lifeos53.vercel.app/api/deliver',{method:'POST',headers:{Authorization:`Bearer ${process.env.CRON_SECRET}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(27000)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(Error('Meal planning is temporarily unavailable. Your saved logs are unchanged.'),{status:502});
 return result;
}
