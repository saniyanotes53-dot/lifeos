import React,{useState} from 'react';
import {Card,PrimaryButton,GhostButton} from './primitives';
import {inputStyle} from '../theme';
import {eventTotals,normalizeTag} from '../assistant/event-tags';
import {updateItem} from '../firestore';
export default function EventBudget({t,tx,userId,onAskAssistant}){
 const [filter,setFilter]=useState(''),[editing,setEditing]=useState(null),[tag,setTag]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[count,setCount]=useState(50);
 const groups=eventTotals(tx),rows=[...tx].filter(x=>!filter||(filter==='__untagged'?!x.eventTag:x.eventTag===filter)).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
 async function save(){if(!editing||busy)return;setBusy(true);setError('');try{await updateItem(userId,'transactions',editing,{eventTag:normalizeTag(tag)});setEditing(null);}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <div style={{display:'grid',gap:12}}>
  <Card t={t}><h3 style={{marginTop:0}}>Organize spending by event</h3><p style={{color:t.muted}}>Use #summer-vacation, #wedding or any event name. Totals below include every tagged entry across all months.</p>
   <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{groups.map(g=><GhostButton t={t} key={g.tag} style={{width:'auto',textAlign:'left'}} onClick={()=>setFilter(g.tag)}>#{g.tag} · ₹{g.expenses.toLocaleString('en-IN')} spent · ₹{g.income.toLocaleString('en-IN')} received · {g.count} entries</GhostButton>)}</div>
   {!groups.length&&<p>No events yet. Tag an existing entry below, or add a transaction with a new event tag.</p>}
   <GhostButton t={t} onClick={()=>onAskAssistant?.(filter&&filter!=='__untagged'?`Analyze my recorded spending for #${filter}. Give totals and practical suggestions.`:'Help me organize my expenses using event tags. Ask which event I want to organize.')}>Ask Gemini about this event</GhostButton>
  </Card>
  <label>Show event<select aria-label="Filter by event tag" style={inputStyle(t)} value={filter} onChange={e=>{setFilter(e.target.value);setCount(50);}}><option value="">All transactions</option><option value="__untagged">Untagged</option>{groups.map(g=><option key={g.tag} value={g.tag}>#{g.tag}</option>)}</select></label>
  {error&&<p role="alert">{error}</p>}
  {rows.slice(0,count).map(x=><Card t={t} key={x.id} style={{padding:14}}><strong>{x.note||x.category} · ₹{Number(x.amount).toLocaleString('en-IN')}</strong><p style={{color:t.muted,margin:'4px 0'}}>{x.date} · {x.type} {x.eventTag?`· #${x.eventTag}`:''}</p>
   {editing===x.id?<div style={{display:'flex',gap:8,flexWrap:'wrap'}}><input aria-label="Edit event tag" placeholder="#summer-vacation (blank removes tag)" maxLength={60} value={tag} onChange={e=>setTag(e.target.value)} style={{...inputStyle(t),flex:1,minWidth:180}} list="existing-event-tags"/><PrimaryButton t={t} disabled={busy} style={{width:'auto'}} onClick={save}>Save tag</PrimaryButton><GhostButton t={t} disabled={busy} style={{width:'auto'}} onClick={()=>setEditing(null)}>Cancel</GhostButton></div>:<GhostButton t={t} disabled={busy} style={{width:'auto'}} onClick={()=>{setEditing(x.id);setTag(x.eventTag||'');}}> {x.eventTag?'Edit tag':'Add event tag'}</GhostButton>}
  </Card>)}
  <datalist id="existing-event-tags">{groups.map(g=><option key={g.tag} value={g.tag}/>)}</datalist>
  {rows.length>count&&<GhostButton t={t} onClick={()=>setCount(v=>v+50)}>Show more entries</GhostButton>}
  {!rows.length&&<p>No matching transactions.</p>}
 </div>;
}
