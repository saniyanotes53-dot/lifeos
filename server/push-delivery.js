import {decode} from './reminder-mail.js';
export const firestoreRoot='https://firestore.googleapis.com/v1/projects/lifeos-61443/databases/(default)/documents';
export const cloudReady=()=>Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON&&process.env.CRON_SECRET);
export async function dbRequest(token,path,options={}){
 const r=await fetch(firestoreRoot+path,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(10000)});
 if(r.status===404)return null;
 if(r.status===409||r.status===412)return {conflict:true};
 if(!r.ok){console.error('[notify.firestore]',{status:r.status});throw Error('Notification database request failed. Check credentials and the timetable collection-group index.');}
 if(r.status===204)return {};return r.json();
}
export async function readRecord(token,path){const r=await dbRequest(token,path);return r?decode({mapValue:{fields:r.fields}}):null;}
export function isDue(block,now){return !block.done&&Number.isFinite(block.remindAt)&&block.remindAt<=now&&block.remindAt>now-5*60000;}
export async function dueBlocks(token,now){
 const rows=await dbRequest(token,':runQuery',{method:'POST',body:JSON.stringify({structuredQuery:{from:[{collectionId:'timetable',allDescendants:true}],where:{compositeFilter:{op:'AND',filters:[{fieldFilter:{field:{fieldPath:'remindAt'},op:'GREATER_THAN',value:{integerValue:String(now-5*60000)}}},{fieldFilter:{field:{fieldPath:'remindAt'},op:'LESS_THAN_OR_EQUAL',value:{integerValue:String(now)}}}]}},limit:101}})});
 const docs=rows.filter(r=>r.document).map(r=>({...decode({mapValue:{fields:r.document.fields}}),path:r.document.name.split('/documents')[1]}));
 if(docs.length>100)throw Error('Too many simultaneous reminders; configure queueing.');return docs.filter(r=>/^\/users\/[^/]+\/timetable\/[^/]+$/.test(r.path)&&isDue(r,now));
}
export async function deliverPush(access,token,body,tag){
 const r=await fetch('https://fcm.googleapis.com/v1/projects/lifeos-61443/messages:send',{method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json'},body:JSON.stringify({message:{token,data:{title:'Life OS reminder',body,tag},webpush:{headers:{TTL:'300',Urgency:'high'}}}}),signal:AbortSignal.timeout(10000)});
 if(!r.ok){const error=await r.json().catch(()=>({}));const stale=error.error?.details?.some(d=>d.errorCode==='UNREGISTERED');if(stale)return {expired:true};throw Error(`Push provider rejected the message (${r.status}).`);}return {accepted:true};
}
