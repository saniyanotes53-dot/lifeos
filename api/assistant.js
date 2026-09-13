import {requireUser,fail} from '../server/firebase.js';
import {createLimiter} from '../server/rate-limit.js';
import {proposeActions} from '../server/agent.js';
const limit=createLimiter();
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).end();
 try{
  const user=await requireUser(req),{text,history=[],context={}}=req.body||{};
  if(typeof text!=='string'||!text.trim()||text.length>6000||!Array.isArray(history)||history.length>12||history.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.text!=='string'||m.text.length>12000)||!context||typeof context!=='object'||JSON.stringify(context).length>80000)return res.status(400).json({error:'The conversation is too large or invalid. Share fewer records.'});
  limit(user.uid);return res.json(await proposeActions(text,history,context));
 }catch(e){return fail(res,e);}
}
