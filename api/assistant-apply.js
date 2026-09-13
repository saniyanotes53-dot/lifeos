import {requireUser,bearerToken,fail} from '../server/firebase.js';
import {applyActions} from '../server/apply-actions.js';
import {createLimiter} from '../server/rate-limit.js';
const limit=createLimiter();
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).end();
 try{const user=await requireUser(req);limit(user.uid);return res.json(await applyActions(user.uid,bearerToken(req),req.body||{}));}catch(e){return fail(res,e);}
}
