export async function userRequest(user,path,method='GET',body){
  const token=await user.getIdToken();
  const response=await fetch(path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||'This service is not configured yet. Please try again later.');
  return result;
}
