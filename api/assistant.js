import {requireUser,fail} from '../server/firebase.js';
import {createLimiter} from '../server/rate-limit.js';
import {proposeActions} from '../server/agent.js';
const limit=createLimiter();
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).end();
 try{
  const user=await requireUser(req),{text,history=[],context={}}=req.body||{};
  if(typeof text!=='string'||!text.trim()||text.length>6000||!Array.isArray(history)||history.length>40||history.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.text!=='string'||m.text.length>12000)||!context||typeof context!=='object'||JSON.stringify(context).length>80000)return res.status(400).json({error:'The conversation is too large or invalid. Share fewer records.'});
  limit(user.uid);const started=Date.now();
  const streaming=req.body?.stream===true;
  const emit=event=>res.write(JSON.stringify(event)+'\n');
  if(streaming){res.setHeader('Content-Type','application/x-ndjson');res.setHeader('X-Accel-Buffering','no');res.flushHeaders?.();}
  const result=await proposeActions(text,history,context,fetch,streaming?reply=>emit({type:'reply',text:reply}):null);
  console.info('[assistant.reply]',{durationMs:Date.now()-started,actions:result.actions.length});
  if(streaming){emit({type:'done',result});return res.end();}return res.json(result);
 }catch(e){console.error('[assistant.reply.failed]',{status:e.status||500,code:e.name});if(res.headersSent){res.write(JSON.stringify({type:'error',status:e.status||502,error:e.status?e.message:'The reply was interrupted. Please try again.'})+'\n');return res.end();}return fail(res,e);}
}
