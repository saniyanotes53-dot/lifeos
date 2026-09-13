import React,{useEffect,useState} from 'react';
import {GhostButton} from './primitives';
import {notificationSettings,readDeliveryPreferences,setEmailDelivery,registerPush,unregisterPush,pushRegistered} from '../cloud-notifications';
export default function CloudNotifications({t,user}){
 const [config,C]=useState(null),[email,E]=useState(false),[push,P]=useState(()=>pushRegistered(user.uid)),[busy,B]=useState(false),[message,M]=useState('');
 useEffect(()=>{let active=true;Promise.all([notificationSettings(),readDeliveryPreferences(user.uid)]).then(([c,p])=>{if(active){C(c);E(Boolean(p.emailEnabled));}}).catch(e=>{if(active)M(e.message);});return()=>{active=false;};},[user.uid]);
 async function run(fn){if(busy)return;B(true);M('');try{await fn();}catch(e){M(e.message);}finally{B(false);}}
 return <section style={{borderTop:`1px solid ${t.line}`,paddingTop:14,display:'grid',gap:12}}><strong>Reminders outside Life OS</strong>
 <label><input type="checkbox" checked={email} disabled={busy||!config?.emailConfigured&&!email} onChange={e=>{const value=e.target.checked;run(async()=>{await setEmailDelivery(user,value);E(value);M(value?'Email preference saved.':'Email reminders disabled.');});}}/> Email my scheduled reminders to {user.email}</label>
 <GhostButton t={t} disabled={busy||!config?.vapidKey&&!push} onClick={()=>run(async()=>{if(push){await unregisterPush(user);P(false);M('Background push disabled on this browser.');}else{M(await registerPush(user));P(true);}})}>{push?'Disable background browser push':'Enable background browser push'}</GhostButton>
 <p style={{fontSize:12,color:t.muted,margin:0}}>Background push can arrive with the Life OS tab closed. Chrome and your phone must allow notifications. Delivery may be delayed by device or battery settings. Disable push before sharing this browser with someone else.</p>
 {config&&<p style={{fontSize:12,margin:0}}>Browser push: {config.pushConfigured?'server configured':'setup needed'} · Email: {config.emailConfigured?'sender configured':'setup needed'} · Scheduler: {config.schedulerEnabled?'enabled':'setup needed'}</p>}
 {config&&(!config.pushConfigured||!config.emailConfigured||!config.schedulerEnabled)&&<p style={{fontSize:12,margin:0}}>Background delivery is not fully activated yet. Your site administrator needs to complete sender and scheduler setup.</p>}
 {message&&<p role="status">{message}</p>}
 </section>;
}
