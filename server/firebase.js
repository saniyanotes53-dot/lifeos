import {getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
export const projectId=process.env.FIREBASE_PROJECT_ID||'lifeos-61443';
export const bearerToken=req=>/^Bearer (.+)$/.exec(req.headers?.authorization||'')?.[1];
export async function requireUser(req){
  const token=bearerToken(req);
  if(!token)throw Object.assign(new Error('Sign in to continue.'),{status:401});
  // Verification uses Google's public certificates, without an admin credential.
  // No account lookup or database bypass; ID tokens expire after about an hour.
  const app=getApps().find(a=>a.name==='lifeos-token-verifier')||initializeApp({projectId},'lifeos-token-verifier');
  try{return await getAuth(app).verifyIdToken(token);}catch{throw Object.assign(new Error('Please sign in again.'),{status:401});}
}
export function fail(res,error){return res.status(error.status||500).json({error:error.status?error.message:'The service could not complete this request.'});}
