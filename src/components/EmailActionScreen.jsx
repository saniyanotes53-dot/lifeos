import React,{useEffect,useState} from 'react';
import {verifyPasswordResetCode,confirmPasswordReset,applyActionCode} from 'firebase/auth';
import {auth} from '../firebase';
import {Card,PrimaryButton} from './primitives';
import {inputStyle} from '../theme';
export default function EmailActionScreen({t}){
 const [params]=useState(()=>new URLSearchParams(window.location.search));const mode=params.get('mode'),code=params.get('oobCode');
 const [ready,setReady]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[again,setAgain]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('Checking your link…'),[done,setDone]=useState(false);
 useEffect(()=>{let alive=true;if(!code||!['resetPassword','verifyEmail'].includes(mode)){setMessage('This link is incomplete or unsupported. Request a new email.');return;}
  if(mode==='verifyEmail'){setReady(true);setMessage('Confirm below to verify your email address.');return;}
  verifyPasswordResetCode(auth,code).then(value=>{if(alive){setEmail(value);setReady(true);setMessage('Choose a new password for your account.');}}).catch(()=>{if(alive)setMessage('This link has expired or was already used. Request a new reset email.');});return()=>{alive=false;};
 },[code,mode]);
 async function submit(e){e.preventDefault();if(busy)return;if(mode==='resetPassword'&&(password.length<6||password!==again)){setMessage('Use at least 6 characters and make both passwords match.');return;}setBusy(true);
  try{if(mode==='resetPassword')await confirmPasswordReset(auth,code,password);else await applyActionCode(auth,code);setDone(true);setPassword('');setAgain('');setMessage(mode==='resetPassword'?'Password changed. You can now sign in.':'Email verified. Welcome to Life OS.');window.history.replaceState({},'', '/auth/action');}
  catch(e){setMessage(e.code==='auth/weak-password'?'Choose a stronger password.':'This link could not be used. Request a new email and try the newest link.');}finally{setBusy(false);}
 }
 return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:20,background:t.bg,color:t.text}}><Card t={t} style={{width:'100%',maxWidth:440}}><h1>{mode==='verifyEmail'?'Verify your email':'Reset your password'}</h1><p role="status">{message}</p>{email&&!done&&<p>{email}</p>}
  {ready&&!done&&<form onSubmit={submit}>{mode==='resetPassword'&&<><label>New password<input style={inputStyle(t)} name="new-password" aria-label="New password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm password<input style={{...inputStyle(t),marginBottom:16}} name="confirm-password" aria-label="Confirm password" type="password" autoComplete="new-password" required minLength={6} value={again} onChange={e=>setAgain(e.target.value)}/></label></>}
  <PrimaryButton t={t} type="submit" disabled={busy}>{busy?'Saving…':mode==='verifyEmail'?'Verify email':'Save new password'}</PrimaryButton></form>}
  <p><a href={done?'/':'/reset'} style={{color:t.a1}}>{done?'Open Life OS':'Request a new reset link'}</a></p></Card></div>;
}
