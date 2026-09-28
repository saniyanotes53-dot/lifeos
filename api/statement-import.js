import {validScreenshot} from '../server/upload-validation.js';
import {requireUser,fail} from '../server/firebase.js';
import {createLimiter} from '../server/rate-limit.js';
import {extractStatement} from '../server/statement-import.js';
const limit=createLimiter(35);
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).end();
  try{
    const user=await requireUser(req),input=req.body||{};
    const validText=typeof input.text==='string'&&input.text.trim().length>0&&input.text.length<=40000;
    const validImage=validScreenshot(input.imageBase64);
    if((!validText&&!validImage)||(input.text&&input.imageBase64))return res.status(400).json({error:'Choose a readable screenshot or PDF page or paste up to 40,000 characters.'});
    limit(user.uid);
    return res.json(await extractStatement(input));
  }catch(error){console.error('[statement.scan]',{status:error.status||500,name:error.name});return fail(res,error);}
}
