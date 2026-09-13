import React,{useEffect,useState} from 'react';
import {updateItem} from '../firestore';
export default function EmailReminderToggle({userId,collection,record}){
 const [ready,R]=useState(false),[busy,B]=useState(false),[error,E]=useState('');
 useEffect(()=>{fetch('/api/reminder-emails?status=1').then(r=>r.json()).then(x=>R(x.enabled)).catch(()=>R(false));},[]);
 return <div><label><input type="checkbox" checked={Boolean(record.emailReminders)} disabled={busy||record.settled||(!ready&&!record.emailReminders)} onChange={async e=>{B(true);E('');try{await updateItem(userId,collection,record.id,{emailReminders:e.target.checked});}catch(err){E(err.message);}finally{B(false);}}}/> Daily email reminders until marked paid</label>{!ready&&<p style={{fontSize:12}}>Email sender setup is pending. Automatic reminders are inactive.</p>}{error&&<p role="alert">{error}</p>}</div>;
}
