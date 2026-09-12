import {requireUser,bearerToken,fail} from '../server/firebase.js';
import {minutes} from '../src/assistant/planner.js';
import {parseLocalDate} from '../src/utils/dates.js';
import {savePlan} from '../server/save-plan.js';
export function createHandler(authenticate=requireUser,save=savePlan){
return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).end();
  try{
    const user=await authenticate(req),blocks=req.body?.blocks;
    if(!Array.isArray(blocks)||!blocks.length||blocks.length>50)return res.status(400).json({error:'Choose between 1 and 50 blocks.'});
    const date=blocks[0]?.date;
    if(new Set(blocks.map(b=>b?.taskId)).size!==blocks.length||!parseLocalDate(date)||blocks.some(b=>!b||b.date!==date||!Number.isFinite(minutes(b.time))||minutes(b.time)+b.durationMinutes>1440||![15,30,45,60,90].includes(b.durationMinutes)||typeof b.taskId!=='string'||!b.taskId.length||b.taskId.length>128||['.','..'].includes(b.taskId)||b.taskId.includes('/')||!Number.isFinite(b.remindAt)||b.remindAt<Date.now()||b.remindAt>Date.now()+366*86400000))return res.status(400).json({error:'The plan contains an invalid or past block. Generate a new plan.'});
    await save(user.uid,bearerToken(req),blocks);
    return res.json({ok:true});
  }catch(error){return fail(res,error);}
}
};
export default createHandler();
