import React,{useState} from 'react';
import {EmailAuthProvider,GoogleAuthProvider,reauthenticateWithCredential,reauthenticateWithPopup} from 'firebase/auth';
import {auth} from '../firebase';
import {clearSession} from '../assistant/session';
import {Modal,GhostButton,PrimaryButton} from './primitives';
import {inputStyle} from '../theme';
const descriptions={tasks:'All tasks and timetable blocks, including their scheduled task reminders.',budget:'All transactions, wallets, category budgets, loans, subscriptions and bill splits. Associated repayment reminders stop when those records are removed.',health:'All sleep logs, workouts, meals and body measurements.'};
export default function SectionReset({t,scope}){
 const [open,setOpen]=useState(false),[password,setPassword]=useState(''),[phrase,setPhrase]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const hasPassword=auth.currentUser?.providerData?.some(p=>p.providerId==='password');
 const hasGoogle=auth.currentUser?.providerData?.some(p=>p.providerId==='google.com');
 async function reset(e){e.preventDefault();setBusy(true);setMessage('');try{
 const user=auth.currentUser;if(!user)throw Error('Sign in again.');
 if(hasPassword)await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,password));
 else if(hasGoogle)await reauthenticateWithPopup(user,new GoogleAuthProvider());
 else throw Error('This sign-in provider is not supported for reset.');
 setPassword('');
 const response=await fetch('/api/auth/welcome?action=reset-data',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${await user.getIdToken(true)}`},body:JSON.stringify({scope,confirmation:phrase})});
 const result=await response.json();clearSession(user.uid);if(!response.ok)throw Error(result.error||'Reset failed.');
 setMessage(result.complete?`${scope} reset complete. ${result.deleted} records removed.`:result.message);setPhrase('');
 }catch(error){setPassword('');setMessage(error.code?'Identity verification failed. Please retry.':error.message);}finally{setBusy(false);}}
 return <div style={{margin:'24px 0'}}><GhostButton t={t} style={{width:'auto'}} onClick={()=>{setMessage('');setOpen(true);}}>Reset {scope} data</GhostButton>
 {open&&<Modal title={`Reset ${scope}`} onClose={()=>{if(!busy){setPassword('');setOpen(false);}}}><form onSubmit={reset} style={{background:t.surface,color:t.text,padding:24,borderRadius:24,maxWidth:460,width:'100%'}}><h2>Reset {scope}</h2><p>{descriptions[scope]}</p><p><strong>This permanently deletes these records. It cannot be undone.</strong> Your login and other sections remain.</p>
 <label>Type RESET {scope.toUpperCase()}<input style={inputStyle(t)} value={phrase} onChange={e=>setPhrase(e.target.value)} autoComplete="off" required/></label>
 {hasPassword&&<label>Confirm your password<input type="password" autoComplete="current-password" style={inputStyle(t)} value={password} onChange={e=>setPassword(e.target.value)} required/></label>}
 {!hasPassword&&hasGoogle&&<p>Confirm using your Google account. LIFE OS does not ask for your Google password.</p>}
 <p role="status">{message}</p><PrimaryButton t={t} type="submit" disabled={busy||phrase!==`RESET ${scope.toUpperCase()}`||(!hasPassword&&!hasGoogle)}>{busy?'Resetting…':hasPassword?'Verify password & permanently reset':'Verify with Google & permanently reset'}</PrimaryButton><GhostButton t={t} disabled={busy} style={{marginTop:12}} onClick={()=>{setPassword('');setOpen(false);}}>Close</GhostButton></form></Modal>}
 </div>;
}
