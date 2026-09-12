import {createRemoteJWKSet,jwtVerify} from 'jose';
export const projectId=process.env.FIREBASE_PROJECT_ID||'lifeos-61443';
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),{timeoutDuration:10000});
export const bearerToken=req=>/^Bearer (.+)$/.exec(req.headers?.authorization||'')?.[1];
export async function verifyFirebaseToken(token,key=googleKeys,now=new Date()){
  const {payload}=await jwtVerify(token,key,{
    algorithms:['RS256'],issuer:`https://securetoken.google.com/${projectId}`,
    audience:projectId,requiredClaims:['sub','exp','iat','auth_time'],currentDate:now,
  });
  const seconds=Math.floor(now.getTime()/1000);
  if(typeof payload.sub!=='string'||!payload.sub.length||payload.sub.length>128||payload.sub.includes('/')||['.','..'].includes(payload.sub)||!Number.isInteger(payload.iat)||payload.iat>seconds||!Number.isInteger(payload.auth_time)||payload.auth_time>seconds)throw new Error('Invalid Firebase token claims.');
  return {...payload,uid:payload.sub};
}
export async function requireUser(req){
  const token=bearerToken(req);
  if(!token)throw Object.assign(new Error('Sign in to continue.'),{status:401});
  try{return await verifyFirebaseToken(token);}catch(error){
    if(error.code==='ERR_JWKS_TIMEOUT'||error instanceof TypeError)throw Object.assign(new Error('Sign-in verification is temporarily unavailable. Please try again.'),{status:503});
    throw Object.assign(new Error('Please sign in again.'),{status:401});
  }
}
export function fail(res,error){return res.status(error.status||500).json({error:error.status?error.message:'The service could not complete this request.'});}
