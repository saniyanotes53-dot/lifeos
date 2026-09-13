export async function userRequest(user,path,method='GET',body){
  if(!user)throw new Error('Sign in to continue.');
  const token=await user.getIdToken();
  const response=await fetch(path,{method,signal:AbortSignal.timeout(60000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json().catch(()=>({}));
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('The assistant API is unavailable. Deploy this project with Vercel, including its api folder.');
  if(!response.ok)throw new Error(result.error||'This service is not configured yet. Please try again later.');
  return result;
}

export async function streamAssistant(user,body,onReply){
 const token=await user.getIdToken();
 const response=await fetch('/api/assistant',{method:'POST',signal:AbortSignal.timeout(60000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({...body,stream:true})});
 if(!response.ok){const result=await response.json().catch(()=>({}));throw new Error(result.error||'The assistant is unavailable. Please try again.');}
 if(!response.headers.get('content-type')?.includes('application/x-ndjson'))throw new Error('Please refresh the website to load the updated assistant.');
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',result;
 const line=value=>{if(!value.trim())return;const event=JSON.parse(value);if(event.type==='error')throw new Error(event.error);if(event.type==='reply')onReply(event.text);if(event.type==='done')result=event.result;};
 while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});const lines=buffer.split('\n');buffer=lines.pop();for(const item of lines)line(item);if(done){if(buffer.trim())line(buffer);break;}}
 if(!result)throw new Error('The connection ended before the proposal was complete. Nothing was saved.');
 return result;
}
