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
 const [profileRead,...logReads]=await Promise.allSettled([read('/healthSettings/profile'),records('meals'),records('workouts'),records('sleep')]);
 if(profileRead.status!=='fulfilled')throw profileRead.reason;
 const p=profileRead.value;
 const missingLogs=logReads.map((r,i)=>r.status==='rejected'?['food','workout','sleep'][i]:null).filter(Boolean);
 const [meals,workouts,sleep]=logReads.map(r=>r.status==='fulfilled'?r.value:[]);
 const profile=decode({mapValue:{fields:p.fields||{}}});
 const pick=(row,keys)=>Object.fromEntries(keys.filter(k=>row[k]!==undefined).map(k=>[k,row[k]]));
 const payload={channel:'nutrition',context:{date,hour,profile:pick(profile,['age','medicalStatus','otherAllergies','allergies','diet','goal','targets']),meals:meals.filter(m=>m.date===date).map(m=>pick(m,['cal','protein','fat','carbs','fiber','calcium','iron','potassium'])),workouts:workouts.map(w=>pick(w,['minutes'])),sleep:sleep.map(s=>pick(s,['hours']))}};
 if(JSON.stringify(payload).length>30000)throw Object.assign(Error('Health history is too large. Shorten notes and retry.'),{status:400});
 if(!process.env.CRON_SECRET)throw Object.assign(Error('The nutrition service needs server configuration.'),{status:503});
 const response=await request('https://lifeos53.vercel.app/api/deliver',{method:'POST',headers:{Authorization:`Bearer ${process.env.CRON_SECRET}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(27000)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(Error('Meal planning is temporarily unavailable. Your saved logs are unchanged.'),{status:502});
 if(missingLogs.length&&!result.blocked){
  result.notes=[`Some saved logs could not load (${missingLogs.join(', ')}). These ideas use your preferences only for those areas; retry later for a complete analysis.`,...(result.notes||[])];
  result.dataWarnings=missingLogs;
  if(result.summary&&missingLogs.includes('workout'))result.summary.workoutMinutesLast7Days=null;
  if(result.summary&&missingLogs.includes('food')){result.summary.recordedToday=null;result.summary.remainingToUserTargets={};}
 }
 return result;
}
