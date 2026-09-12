import {createHash} from 'node:crypto';
import {requireUser,services,fail} from '../server/firebase.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['POST','DELETE','GET'].includes(req.method))return res.status(405).end();
  try{
    const user=await requireUser(req),{db}=services();
    if(process.env.REMINDERS_ENABLED!=='true')return res.status(503).json({error:'Scheduled push reminders are not enabled on the server yet.'});
    if(req.method==='GET')return res.json({enabled:true});
    const token=req.body?.token;
    if(typeof token!=='string'||token.length<20||token.length>4096)return res.status(400).json({error:'Invalid device token.'});
    const ref=db.collection('_pushDevices').doc(createHash('sha256').update(token).digest('hex'));
    await db.runTransaction(async transaction=>{
      const saved=await transaction.get(ref);
      if(req.method==='DELETE'){if(saved.data()?.uid===user.uid)transaction.delete(ref);}
      else transaction.set(ref,{uid:user.uid,token,updatedAt:Date.now()});
    });
    return res.json({ok:true});
  }catch(error){return fail(res,error);}
}
