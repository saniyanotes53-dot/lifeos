// Retry generation requests only. No database writes are performed here.
export async function geminiRequest(url, options, request=fetch, pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))) {
  for(let attempt=0;attempt<3;attempt++){
    const response=await request(url,options);
    if(![500,502,503,504].includes(response.status)||attempt===2)return response;
    console.warn('[gemini.retry]',{status:response.status,attempt:attempt+1});
    await response.body?.cancel().catch(()=>{});
    await pause(600*2**attempt+Math.floor(Math.random()*200));
    options.signal?.throwIfAborted();
  }
}
