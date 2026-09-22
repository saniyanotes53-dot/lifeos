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
    const validImage=typeof input.imageBase64==='string'&&input.imageBase64.length<=2200000&&/^[A-Za-z0-9+/]+={0,2}$/.test(input.imageBase64);
    if((!validText&&!validImage)||(input.text&&input.imageBase64))return res.status(400).json({error:'Choose a readable PDF page or paste up to 40,000 characters.'});
    limit(user.uid);
    return res.json(await extractStatement(input));
  }catch(error){console.error('[statement.scan]',{status:error.status||500,name:error.name});return fail(res,error);}
}
