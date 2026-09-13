import React,{useState,useRef} from 'react';
import {Card,Field,PrimaryButton,GhostButton} from './primitives';
import {inputStyle,todayStr} from '../theme';
import {addItem,deleteItem,updateItem} from '../firestore';
import {splitBill} from '../assistant/budget-tools';
import {parseLocalDate} from '../utils/dates';
export default function BudgetTools({t,userId,mode,subscriptions=[],billSplits=[],onAskAssistant}){
 const [name,setName]=useState(''),[amount,setAmount]=useState(''),[date,setDate]=useState(todayStr),[cycle,setCycle]=useState('monthly'),[people,setPeople]=useState(''),[paidBy,setPaidBy]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const lock=useRef(false),isSub=mode==='subscriptions';
 let shares=[];try{if(!isSub&&amount&&people)shares=splitBill(amount,people);}catch{}
 async function run(action){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await action();}catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}}
 async function save(e){e.preventDefault();await run(async()=>{
  if(!name.trim()||name.length>200||!Number.isFinite(Number(amount))||Number(amount)<=0||Number(amount)>100000000)throw new Error('Enter a name and a valid positive amount.');
  if(isSub){if(!parseLocalDate(date))throw new Error('Choose a renewal date.');await addItem(userId,'subscriptions',{name:name.trim(),amount:Math.round(Number(amount)*100)/100,cycle,nextDate:date});}
  else{const result=splitBill(amount,people);if(!result.some(x=>x.name===paidBy.trim()))throw new Error('The payer must be one of the participant names.');await addItem(userId,'billSplits',{title:name.trim(),total:Math.round(Number(amount)*100)/100,people:result.map(x=>x.name).join(', '),paidBy:paidBy.trim(),date:todayStr(),settled:false});}
  setName('');setAmount('');setPeople('');setPaidBy('');
 });}
 return <div style={{display:'grid',gap:12}}><Card t={t}><h2>{isSub?'Recurring subscriptions':'Split a bill'}</h2><p style={{color:t.muted,fontSize:13}}>{isSub?'Keep a record of renewals and recurring costs. This tracker does not charge your account or create payments automatically.':'Calculate equal shares and keep a settlement record. Friends are not contacted and no money is transferred.'}</p>
 <form onSubmit={save}><Field t={t} label={isSub?'Subscription name':'Bill title'}><input required maxLength={200} value={name} onChange={e=>setName(e.target.value)} style={inputStyle(t)}/></Field><Field t={t} label={isSub?'Recurring amount (₹)':'Total paid (₹)'}><input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} style={inputStyle(t)}/></Field>
 {isSub?<><Field t={t} label="Renewal cycle"><select value={cycle} onChange={e=>setCycle(e.target.value)} style={inputStyle(t)}>{['weekly','monthly','yearly'].map(c=><option key={c}>{c}</option>)}</select></Field><Field t={t} label="Next renewal date"><input type="date" required value={date} onChange={e=>setDate(e.target.value)} style={inputStyle(t)}/></Field></>:<><Field t={t} label="Participants, separated by commas"><input required value={people} onChange={e=>setPeople(e.target.value)} placeholder="Me, Ali, Ahmed" style={inputStyle(t)}/></Field><Field t={t} label="Who paid? Enter one participant’s name"><input required value={paidBy} onChange={e=>setPaidBy(e.target.value)} style={inputStyle(t)}/></Field>{shares.length>0&&<ul>{shares.map(s=><li key={s.name}>{s.name}: ₹{s.amount.toFixed(2)}</li>)}</ul>}</>}
 {error&&<p role="alert">{error}</p>}<PrimaryButton t={t} type="submit" disabled={busy}>Save {isSub?'subscription':'bill split'}</PrimaryButton></form>
 <GhostButton t={t} style={{marginTop:10}} onClick={()=>onAskAssistant?.(isSub?'Review my recurring subscriptions and suggest where I could reduce costs.':'Explain my saved bill splits and outstanding settlements.')}>Ask Gemini about these records</GhostButton></Card>
 {(isSub?subscriptions:billSplits).map(record=><Card key={record.id} t={t}><strong>{isSub?record.name:record.title}</strong><p>{isSub?`₹${record.amount} · ${record.cycle} · renews ${record.nextDate}`:`₹${record.total} paid by ${record.paidBy} · ${record.settled?'settled':'outstanding'}`}</p>{!isSub&&<p style={{fontSize:13}}>{(()=>{try{return splitBill(record.total,record.people).map(s=>`${s.name}: ₹${s.amount.toFixed(2)}`).join(' · ');}catch{return 'Review participant names.';}})()}</p>}<div style={{display:'flex',gap:8}}>{!isSub&&<GhostButton t={t} disabled={busy} onClick={()=>run(()=>updateItem(userId,'billSplits',record.id,{settled:!record.settled}))}>{record.settled?'Mark outstanding':'Mark settled'}</GhostButton>}<GhostButton t={t} disabled={busy} onClick={()=>run(()=>deleteItem(userId,isSub?'subscriptions':'billSplits',record.id))}>Remove</GhostButton></div></Card>)}
 </div>;
}
