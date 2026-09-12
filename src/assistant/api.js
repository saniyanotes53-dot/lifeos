export async function userRequest(user,path,method='GET',body){
  if(!user)throw new Error('Sign in to continue.');
  const token=await user.getIdToken();
  const response=await fetch(path,{method,signal:AbortSignal.timeout(60000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json().catch(()=>({}));
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('The assistant API is unavailable. Deploy this project with Vercel, including its api folder.');
  if(!response.ok)throw new Error(result.error||'This service is not configured yet. Please try again later.');
  return result;
}
