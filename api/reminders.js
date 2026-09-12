import {createHash,timingSafeEqual} from 'node:crypto';
import {services,fail} from '../server/firebase.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).end();
  const expected=Buffer.from(`Bearer ${process.env.CRON_SECRET||''}`),actual=Buffer.from(req.headers.authorization||'');
  if(!process.env.CRON_SECRET||actual.length!==expected.length||!timingSafeEqual(actual,expected))return res.status(401).end();
  if(process.env.REMINDERS_ENABLED!=='true')return res.status(503).json({error:'Reminders disabled.'});
  try{
    const {db,messaging}=services(),now=Date.now();
    const due=await db.collectionGroup('timetable').where('remindAt','>',now-5*60_000).where('remindAt','<=',now).limit(200).get();
    let sent=0;
    for(const snapshot of due.docs){
      const block=snapshot.data(),parts=snapshot.ref.path.split('/');
      if(parts.length!==4||parts[0]!=='users'||block.done)continue;
      const claim=db.collection('_reminderDeliveries').doc(createHash('sha256').update(`${snapshot.ref.path}:${block.remindAt}`).digest('hex'));
      const acquired=await db.runTransaction(async t=>{
        const [state,current]=await Promise.all([t.get(claim),t.get(snapshot.ref)]);
        if(state.data()?.sent||state.data()?.leaseUntil>now||!current.exists||current.data().done||current.data().remindAt!==block.remindAt)return false;
        t.set(claim,{leaseUntil:now+60000,expiresAt:new Date(now+7*86400000)});return true;
      });
      if(!acquired)continue;
      try{
        const devices=await db.collection('_pushDevices').where('uid','==',parts[1]).limit(500).get();
        if(devices.empty){await claim.set({sent:true,reason:'no_devices'});continue;}
        const result=await messaging.sendEachForMulticast({tokens:devices.docs.map(d=>d.data().token),data:{title:'Life OS reminder',body:'Your scheduled activity is starting.',url:'/?view=timetable',tag:claim.id},webpush:{headers:{TTL:'300'}}});
        for(let i=0;i<result.responses.length;i++)if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(result.responses[i].error?.code))await devices.docs[i].ref.delete();
        // A successful device must not receive duplicate retries. Failed devices can retry only when all sends fail.
        await claim.set({sent:result.successCount>0||result.responses.every(r=>['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(r.error?.code)),leaseUntil:0,expiresAt:new Date(now+7*86400000)});sent+=result.successCount;
      }catch{await claim.set({leaseUntil:0},{merge:true});}
    }
    return res.json({processed:due.size,sent});
  }catch(error){return fail(res,error);}
}
