import {withReadRetry,readResponseError} from './request.js';
export async function userRequest(user,path,method='GET',body){
  if(!user)throw new Error('Sign in to continue.');
  const token=await user.getIdToken();
  const response=await fetch(path,{method,signal:AbortSignal.timeout(60000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json().catch(()=>({}));
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('The assistant API is unavailable. Deploy this project with Vercel, including its api folder.');
  if(!response.ok)throw new Error(result.error||'This service is not configured yet. Please try again later.');
  return result;
}

export async function streamAssistant(user,body,onReply,onRetry=()=>{}){
 return withReadRetry(user,async token=>{
  const response=await fetch('/api/assistant',{method:'POST',signal:AbortSignal.timeout(60000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({...body,stream:true})});
  if(!response.ok)throw await readResponseError(response);
  if(!response.headers.get('content-type')?.includes('application/x-ndjson'))throw new Error('The assistant service is unavailable. Please refresh and try again.');
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',result;
  const line=value=>{
   if(!value.trim())return;
   let event;try{event=JSON.parse(value);}catch{throw Object.assign(new Error('The reply was interrupted. Please try again.'),{retryable:true});}
   if(event.type==='error')throw Object.assign(new Error(event.error),{status:event.status||502,retryable:event.retryable});
   if(event.type==='reply')onReply(event.text);
   if(event.type==='done')result=event.result;
  };
  try{
   while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});const lines=buffer.split('\n');buffer=lines.pop();for(const item of lines)line(item);if(done){if(buffer.trim())line(buffer);break;}}
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  if(!result||typeof result.reply!=='string'||!Array.isArray(result.actions))throw Object.assign(new Error('The connection ended before the reply was complete. Please try again.'),{retryable:true});
  return result;
 },{onRetry:()=>{onReply('');onRetry();}});
}

export async function scanStatementPage(user,body){
 return withReadRetry(user,async token=>{
  const response=await fetch('/api/statement-import',{method:'POST',signal:AbortSignal.timeout(60000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok)throw await readResponseError(response);
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('PDF scanning is unavailable on this deployment. You can still import CSV files.');
  return response.json();
 });
}
