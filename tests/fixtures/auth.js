const user={uid:'preview-only',displayName:'Example User',email:'example@example.test',providerData:[]};
export function onAuthChange(fn){fn(new URLSearchParams(location.search).has('signedOut')?null:user);return ()=>{};}
export async function logout(){location.href='/?signedOut=1';}
export async function loginWithEmail(){throw new Error('Authentication is disabled in the UI preview.');}
export const loginWithGoogle=loginWithEmail, registerWithEmail=loginWithEmail, resetPassword=loginWithEmail;
