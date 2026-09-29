import {requireUser,fail} from './firebase.js';
import {ownerUid} from './owner-config.js';
import {readIntegration,saveIntegration,sealKey,privatePython} from './integration-vault.js';
import {assertSameOrigin} from './product-admin.js';
import {persistentLimit} from './security-store.js';
export function createConnectionsHandler(overrides={}){
 const d={requireUser,ownerUid,readIntegration,saveIntegration,sealKey,privatePython,limit:req=>persistentLimit(req,'ai-key-config',6,60000,process.env.CRON_SECRET),...overrides};
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
   const user=await d.requireUser(req);
   if(!d.ownerUid){if(req.method==='GET')return res.json({ownerConfigured:false,accountUid:user.uid});throw Object.assign(Error('Owner access has not been configured yet.'),{status:403});}
   if(user.uid!==d.ownerUid||!user.email_verified)throw Object.assign(Error('Only the verified Life OS owner can manage AI connections.'),{status:403});
   if(req.method==='GET'){const {sealedKey,...safe}=await d.readIntegration();return res.json({...safe,configured:!!sealedKey,ownerConfigured:true});}
   if(!['PUT','DELETE'].includes(req.method))return res.status(405).end();
   assertSameOrigin(req);
   if(!Number.isInteger(user.auth_time)||Date.now()/1000-user.auth_time>300)throw Object.assign(Error('Sign out and sign in again before changing the API key.'),{status:401});
   await d.limit(req);
   const {key,revision,model='openai/gpt-oss-20b'}=req.body||{};
   if(typeof revision!=='string'||revision.length>100)throw Object.assign(Error('Reload connection settings before saving.'),{status:400});
   if(!['openai/gpt-oss-20b','openai/gpt-oss-120b'].includes(model))throw Object.assign(Error('Choose a supported operator model.'),{status:400});
   let sealedKey='';
   if(req.method==='PUT'){
    if(typeof key!=='string'||!/^gsk_[A-Za-z0-9_-]{16,252}$/.test(key))throw Object.assign(Error('Enter a valid Groq API key.'),{status:400});
    sealedKey=d.sealKey(key);
    await d.privatePython({channel:'groq-test',sealedKey,model});
   }
   return res.json(await d.saveIntegration({sealedKey,model,revision}));
  }catch(e){return fail(res,e);}
 };
}
export default createConnectionsHandler();
