import {getApps,initializeApp,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {getMessaging} from 'firebase-admin/messaging';
export function services(){
  if(!getApps().length){
    if(!process.env.FIREBASE_SERVICE_ACCOUNT_JSON)throw Object.assign(new Error('Server setup is incomplete.'),{status:503});
    initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))});
  }
  return {auth:getAuth(),db:getFirestore(),messaging:getMessaging()};
}
export async function requireUser(req){
  const token=/^Bearer (.+)$/.exec(req.headers.authorization||'')?.[1];
  if(!token)throw Object.assign(new Error('Sign in to continue.'),{status:401});
  const {auth}=services();
  try{return await auth.verifyIdToken(token,true);}catch{throw Object.assign(new Error('Please sign in again.'),{status:401});}
}
export function fail(res,error){return res.status(error.status||500).json({error:error.status?error.message:'The service could not complete this request.'});}
