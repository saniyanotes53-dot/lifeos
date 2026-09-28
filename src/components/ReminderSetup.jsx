import React,{useEffect,useState} from 'react';
import {Bell,Mail,MessageCircle,Check,Monitor} from 'lucide-react';
import {Modal,GhostButton} from './primitives';
import {notificationSettings,readDeliveryPreferences,setEmailDelivery,registerPush,getPushState} from '../cloud-notifications';
import {enableReminders,remindersEnabled} from '../notifications';
import {sendWelcomeEmail} from '../auth';

export default function ReminderSetup({t,user}) {
 const [open,setOpen]=useState(false),[stamp,setStamp]=useState('');
 const [config,setConfig]=useState(null),[email,setEmail]=useState(false),[inApp,setInApp]=useState(()=>remindersEnabled(user.uid));
 const [push,setPush]=useState(()=>getPushState(user.uid)),[busy,setBusy]=useState(''),[notice,setNotice]=useState(''),[loadError,setLoadError]=useState('');
 const [welcome,setWelcome]=useState(null),[welcomeBusy,setWelcomeBusy]=useState(false);
 const key=`lifeos_reminder_setup_v1_${user.uid}`;
 useEffect(()=>{
  let active=true;
  user.getIdTokenResult().then(result=>{
   if(!active)return;const login=String(result.claims.auth_time||'session');setStamp(login);
   let seen;try{seen=sessionStorage.getItem(key);}catch{}
   setOpen(seen!==login);
  }).catch(()=>{if(active){setStamp('session');setOpen(true);}});
  Promise.all([notificationSettings(),readDeliveryPreferences(user.uid)]).then(([c,p])=>{if(active){setConfig(c);setEmail(Boolean(p.emailEnabled));}}).catch(e=>{if(active)setLoadError(e.message);});
  sendWelcomeEmail(user).then(result=>{if(active)setWelcome(result);});
  const sync=()=>{setPush(getPushState(user.uid));setInApp(remindersEnabled(user.uid));};
  window.addEventListener('lifeos-push-status-change',sync);window.addEventListener('focus',sync);
  return()=>{active=false;window.removeEventListener('lifeos-push-status-change',sync);window.removeEventListener('focus',sync);};
 },[user.uid]);
 const close=()=>{if(busy)return;try{sessionStorage.setItem(key,stamp);}catch{}setOpen(false);};
 const run=async(channel,fn)=>{if(busy)return;setBusy(channel);setNotice('');try{await fn();}catch(e){setNotice(e.message);}finally{setBusy('');}};
 if(!open)return null;
 const row={padding:16,borderRadius:16,background:t.surface2,display:'grid',gap:9};
 return <Modal title="Set up your reminders" onClose={close}><section style={{background:t.surface,color:t.text,border:`1px solid ${t.line}`,borderRadius:26,padding:24,width:'min(520px,100%)',maxHeight:'88dvh',overflowY:'auto'}}>
  <small style={{color:t.a1,fontWeight:700,letterSpacing:2}}>LIFE OS</small>
  <h2 style={{margin:'10px 0'}}>Stay on track, your way</h2>
  <p style={{color:t.muted,lineHeight:1.6}}>Choose how you receive reminders. Each option is yours to enable; you can change it later in Profile.</p>
  <div style={{display:'grid',gap:12}}>
   <section style={row}><strong><Bell size={17}/> In-app reminders</strong><small>Due-time alerts while LIFE OS is open.</small><GhostButton t={t} disabled={Boolean(busy)||inApp} onClick={()=>run('in-app',async()=>{await enableReminders(user);setInApp(true);setNotice('In-app reminders enabled.');})}>{inApp?'✓ Enabled':busy==='in-app'?'Enabling…':'Enable in-app reminders'}</GhostButton></section>
   <section style={row}><strong><Mail size={17}/> Email reminders</strong><small>Send scheduled reminders to {user.email}. Welcome and account-security emails are separate.</small><GhostButton t={t} disabled={Boolean(busy)||email||!config?.emailConfigured} onClick={()=>run('email',async()=>{await setEmailDelivery(user,true);setEmail(true);setNotice(config.schedulerEnabled?'Email reminders enabled.':'Email preference saved. Scheduled delivery still needs administrator setup.');})}>{email?'✓ Enabled':busy==='email'?'Saving…':'Enable email reminders'}</GhostButton></section>
   <section style={row}><strong><Monitor size={17}/> Browser push · this device</strong><small>Receive reminders with the tab closed, where supported. Your browser asks for permission only when you choose Enable.</small><GhostButton t={t} disabled={Boolean(busy)||push==='on'||push==='unsupported'||push==='denied'||!config?.pushConfigured} onClick={()=>run('push',async()=>{setNotice(await registerPush(user));setPush(getPushState(user.uid));})}>{push==='on'?'✓ Enabled':push==='unsupported'?'Not supported on this browser':push==='denied'?'Blocked in browser settings':busy==='push'?'Connecting…':'Enable browser push'}</GhostButton>{push==='denied'&&<small>Allow notifications in your browser’s site settings, then reopen LIFE OS.</small>}{push==='unsupported'&&<small>Try a supported browser. On iPhone or iPad, install LIFE OS to the Home Screen and open it there.</small>}</section>
   <section style={{...row,opacity:.65}}><strong><MessageCircle size={17}/> WhatsApp</strong><small>Coming soon. No phone number or permission is needed yet.</small></section>
  </div>
  {config&&!config.schedulerEnabled&&<p role="status">Background delivery is awaiting scheduler setup. In-app reminders can still work.</p>}
  {loadError&&<p role="alert">Could not load reminder settings: {loadError} Reopen LIFE OS to retry, or use Profile.</p>}
  {notice&&<p role="status">{notice}</p>}
  <div style={{fontSize:12,color:t.muted,marginTop:16}}>
   {welcome?.ok&&!welcome.inProgress?<p>Welcome email: submitted to the mail server previously or just now. Inbox delivery is controlled by your email provider.</p>:welcome?.inProgress?<p>Welcome email: a request is pending. Check again in two minutes.</p>:welcome&&!welcome.ok?<p role="status">Welcome email: {welcome.error}</p>:<p>Checking your welcome email…</p>}
   {welcome&&(!welcome.ok||welcome.inProgress)&&<GhostButton t={t} disabled={welcomeBusy} onClick={async()=>{setWelcomeBusy(true);try{setWelcome(await sendWelcomeEmail(user));}finally{setWelcomeBusy(false);}}}>{welcomeBusy?'Checking…':'Retry welcome email'}</GhostButton>}
   <p>School email missing? Check Spam or your institution’s quarantine. Browser push is an independent option.</p>
  </div>
  <div style={{display:'flex',gap:10,marginTop:18}}><GhostButton t={t} disabled={Boolean(busy)} onClick={close}>Not now</GhostButton><GhostButton t={t} disabled={Boolean(busy)} onClick={close}><Check size={16}/> Done</GhostButton></div>
 </section></Modal>;
}
