import React,{useEffect,useState} from 'react';
import {updateItem} from '../firestore';
import {billLedger,validEmail} from '../assistant/budget-tools';
export default function EmailReminderToggle({userId,collection,record}){
 const [ready,R]=useState(null),[busy,B]=useState(false),[error,E]=useState('');
 useEffect(()=>{let active=true;fetch('/api/reminder-emails?status=1').then(r=>{if(!r.ok)throw Error();return r.json();}).then(x=>{if(active)R(Boolean(x.enabled));}).catch(()=>{if(active)R(false);});return()=>{active=false;};},[]);
 let recipients=[];
 if(collection==='loans'){if(validEmail(record.email))recipients=[record.email];}
 else {try{const {transfers}=billLedger(record);recipients=Object.entries(record.emails||{}).filter(([name,email])=>validEmail(email)&&transfers.some(d=>d.from===name||d.to===name)).map(([,email])=>email);}catch{}}
 return <div style={{margin:'14px 0'}}><label style={{display:'flex',alignItems:'center',gap:10,minHeight:44}}><input type="checkbox" checked={Boolean(record.emailReminders)} disabled={busy||record.settled||((!ready||!recipients.length)&&!record.emailReminders)} onChange={async e=>{const enabled=e.target.checked;B(true);E('');try{await updateItem(userId,collection,record.id,{emailReminders:enabled});}catch(err){E(err.message);}finally{B(false);}}}/> Daily payment reminder emails</label>
 {recipients.length>0&&<p style={{fontSize:12,lineHeight:1.6,overflowWrap:'anywhere'}}>Recipients: {recipients.join(', ')}. Sends a private balance summary to each contact until marked paid.</p>}
 {!recipients.length&&!record.settled&&<p style={{fontSize:12}}>Add a contact email when creating the record. Only participants with unpaid balances receive reminders.</p>}
 {ready===null?<p style={{fontSize:12}}>Checking email availability…</p>:!ready&&<p style={{fontSize:12}}>Email availability could not be confirmed. Automatic reminders may be inactive.</p>}
 {error&&<p role="alert">{error}</p>}</div>;
}
