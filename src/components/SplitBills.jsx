import EmailReminderToggle from './EmailReminderToggle';
import React,{useState} from 'react';
import {Card,Field,PrimaryButton,GhostButton} from './primitives';
import {inputStyle,todayStr} from '../theme';
import {addItem,updateItem,deleteItem} from '../firestore';
import {splitBill,billLedger,validEmail} from '../assistant/budget-tools';
export default function SplitBills({t,userId,billSplits=[]}){
 const [title,T]=useState(''),[total,A]=useState(''),[people,P]=useState(''),[contributions,C]=useState({}),[emails,E]=useState({}),[error,X]=useState(''),[busy,B]=useState(false);
 let shares=[];try{shares=splitBill(total,people);}catch{}
 async function run(fn){if(busy)return;B(true);X('');try{await fn();}catch(e){X(e.message);}finally{B(false);}}
 async function save(e){e.preventDefault();await run(async()=>{if(!title.trim())throw Error('Enter a bill title.');const names=splitBill(total,people).map(s=>s.name);const c=Object.fromEntries(names.map(n=>[n,Number(contributions[n]||0)])),mail=Object.fromEntries(names.map(n=>[n,(emails[n]||'').trim()]));if(Object.values(mail).some(v=>v&&!validEmail(v)))throw Error('Check participant email addresses.');const record={title:title.trim(),total:Number(total),people:names.join(', '),contributions:c,emails:mail,date:todayStr(),settled:false};billLedger(record);await addItem(userId,'billSplits',record);T('');A('');P('');C({});E({});});}
 return <div style={{display:'grid',gap:12}}><Card t={t}><h2>Split a bill</h2><p>Enter what each person paid. Shares are equal; remaining dues account for every payer.</p><form onSubmit={save}>
 <Field t={t} label="Bill title"><input required maxLength={200} style={inputStyle(t)} value={title} onChange={e=>T(e.target.value)}/></Field>
 <Field t={t} label="Total (₹)"><input required type="number" min="0.01" step="0.01" style={inputStyle(t)} value={total} onChange={e=>A(e.target.value)}/></Field>
 <Field t={t} label="Participants separated by commas"><input required style={inputStyle(t)} value={people} onChange={e=>P(e.target.value)} placeholder="Me, Ali, Ahmed"/></Field>
 {shares.map(s=><fieldset key={s.name} style={{border:`1px solid ${t.line}`,borderRadius:10,marginBottom:12}}><legend>{s.name} · share ₹{s.amount.toFixed(2)}</legend><Field t={t} label="Amount already paid (₹)"><input type="number" min="0" step="0.01" style={inputStyle(t)} value={contributions[s.name]||''} onChange={e=>C({...contributions,[s.name]:e.target.value})}/></Field><Field t={t} label="Email (optional)"><input type="email" style={inputStyle(t)} value={emails[s.name]||''} onChange={e=>E({...emails,[s.name]:e.target.value})}/></Field></fieldset>)}
 <PrimaryButton t={t} type="submit" disabled={busy}>Save bill split</PrimaryButton></form></Card>{error&&<p role="alert">{error}</p>}
 {billSplits.map(r=>{let ledger;try{ledger=billLedger(r);}catch(e){return <Card t={t} key={r.id}>{r.title}: {e.message}</Card>;}return <Card t={t} key={r.id}><h3>{r.title} · ₹{r.total}</h3>{ledger.rows.map(p=><p key={p.name}>{p.name}: paid ₹{p.paid.toFixed(2)} · share ₹{p.amount.toFixed(2)}</p>)}{ledger.transfers.map((d,i)=><p key={i}>{d.from} owes {d.to} ₹{d.amount.toFixed(2)}</p>)}{!ledger.transfers.length&&<p>No remaining dues.</p>}<EmailReminderToggle userId={userId} collection="billSplits" record={r}/><GhostButton t={t} disabled={busy} onClick={()=>run(()=>updateItem(userId,'billSplits',r.id,{settled:!r.settled}))}>{r.settled?'Reopen bill':'Mark all dues paid'}</GhostButton><GhostButton t={t} disabled={busy} onClick={()=>run(()=>deleteItem(userId,'billSplits',r.id))}>Remove</GhostButton></Card>;})}</div>;
}
