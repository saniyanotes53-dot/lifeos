import {requireUser,fail} from '../server/firebase.js';
import {generateReply} from '../server/bot.js';
import {createLimiter} from '../server/rate-limit.js';
const limit=createLimiter();
export function createHandler(authenticate=requireUser,replyTo=generateReply,throttle=limit){
  return async function handler(req,res){
    res.setHeader('Cache-Control','no-store');
    if(req.method!=='POST')return res.status(405).end();
    try{
      const user=await authenticate(req),text=req.body?.text,history=req.body?.history||[];
      if(typeof text!=='string'||!text.trim()||text.length>2000||!Array.isArray(history)||history.length>12||history.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.text!=='string'||m.text.length>4000))return res.status(400).json({error:'Invalid chat message.'});
      throttle(user.uid);
      return res.json({reply:await replyTo(text.trim(),history)});
    }catch(error){return fail(res,error);}
  };
}
export default createHandler();
