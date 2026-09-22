const transient = new Set([408, 500, 502, 503, 504]);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Only use for read/proposal requests. Saving records has separate idempotency.
export async function withReadRetry(user, operation, {onRetry=()=>{}, wait=delay}={}) {
  if (!user) throw new Error('Sign in to continue.');
  let refresh = false;
  for (let attempt=0; attempt<2; attempt++) {
    try { return await operation(await user.getIdToken(refresh)); }
    catch (error) {
      const retryable = error.retryable ?? (transient.has(error.status) || error instanceof TypeError || ['TimeoutError','AbortError'].includes(error.name));
      if (attempt || (!retryable && error.status !== 401)) throw error;
      refresh = error.status === 401;
      onRetry();
      await wait(700);
    }
  }
}

export async function readResponseError(response) {
  const body = await response.json().catch(()=>({}));
  return Object.assign(new Error(body.error || (response.status===429?'The service is busy. Please wait a moment and try again.':'The service could not respond. Please try again.')), {status:response.status});
}
