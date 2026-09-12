import {requireUser,services,fail} from '../server/firebase.js';
import {generateReply,deliverReply} from '../server/bot.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).end();
  try{
    const user=await requireUser(req),{db}=services(),text=req.body?.text,history=req.body?.history||[];
    if(typeof text!=='string'||!text.trim()||text.length>2000||!Array.isArray(history)||history.length>12||history.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.text!=='string'||m.text.length>4000))return res.status(400).json({error:'Invalid chat message.'});
    const bucket=Math.floor(Date.now()/60000),ref=db.collection('_chatLimits').doc(user.uid);
    await db.runTransaction(async t=>{const snap=await t.get(ref),count=snap.data()?.bucket===bucket?snap.data().count:0;if(count>=10)throw Object.assign(new Error('Please wait a minute before sending more messages.'),{status:429});t.set(ref,{bucket,count:count+1});});
    const reply=await generateReply(text,history);
    await deliverReply(user.uid,reply);
    return res.json({ok:true});
  }catch(error){return fail(res,error);}
}
