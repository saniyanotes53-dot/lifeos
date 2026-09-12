import TLS from 'tls-sig-api-v2';
import {chatUserId} from '../server/bot.js';
import {requireUser,fail} from '../server/firebase.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).end();
  try{
    const user=await requireUser(req);
    const sdkAppId=Number(process.env.TENCENT_SDK_APP_ID),key=process.env.TENCENT_CHAT_SECRET_KEY,botUserId=process.env.TENCENT_BOT_USER_ID;
    if(!sdkAppId||!key||!botUserId||!process.env.TENCENT_ADMIN_USER_ID||!process.env.GEMINI_API_KEY||!process.env.GEMINI_MODEL)return res.status(503).json({error:'Cloud chat has not been enabled yet. The built-in planner is available.'});
    // Derive identity from verified Firebase auth; never sign a caller-supplied ID.
    const userId=chatUserId(user.uid);
    const signer=new TLS.Api(sdkAppId,key);
    return res.status(200).json({sdkAppId,userId,botUserId,userSig:signer.genSig(userId,3600)});
  }catch(error){return fail(res,error);}
}
