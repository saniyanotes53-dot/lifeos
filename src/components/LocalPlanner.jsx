import React,{useState} from 'react';
import {Field,PrimaryButton} from './primitives';
import {inputStyle} from '../theme';
import {localDateKey,parseLocalDate} from '../utils/dates';
import {proposePlan,reportSummary} from '../assistant/planner';
import {userRequest} from '../assistant/api';
export default function LocalPlanner({t,user,tasks=[],blocks=[],sleep=[],tx=[],workouts=[]}){
 const [date,setDate]=useState(localDateKey),[start,setStart]=useState('09:00'),[end,setEnd]=useState('18:00'),[plan,setPlan]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 function suggest(){try{setPlan(proposePlan({tasks,blocks,date,start,end,duration:30}));setMessage('');}catch(e){setMessage(e.message);}}
 async function apply(){setBusy(true);try{await userRequest(user,'/api/apply-plan','POST',{blocks:plan.blocks.map(b=>{const d=parseLocalDate(b.date),[h,m]=b.time.split(':').map(Number);d.setHours(h,m,0,0);return {...b,remindAt:d.getTime()};})});setPlan(null);setMessage('Saved to timetable.');}catch(e){setMessage(e.message);}finally{setBusy(false);}}
 return <details style={{marginTop:20}}><summary style={{cursor:'pointer'}}>Local planner & weekly summary (no Gemini request)</summary><p style={{whiteSpace:'pre-wrap',fontSize:13}}>{reportSummary({tasks,sleep,tx,workouts})}</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{[['Date',date,setDate,'date'],['Start',start,setStart,'time'],['Finish',end,setEnd,'time']].map(([label,value,set,type])=><Field key={label} t={t} label={label}><input type={type} value={value} disabled={busy} onChange={e=>{set(e.target.value);setPlan(null);}} style={inputStyle(t)}/></Field>)}</div><PrimaryButton t={t} disabled={busy} onClick={suggest}>Suggest 30-minute task blocks</PrimaryButton>{plan&&<><ol>{plan.blocks.map(b=><li key={b.taskId}>{b.date} {b.time} · {b.label}</li>)}</ol><p>{plan.unplaced.length} tasks did not fit this window.</p>{plan.blocks.length>0&&<PrimaryButton t={t} disabled={busy} onClick={apply}>Confirm local plan</PrimaryButton>}</>}{message&&<p role="status">{message}</p>}</details>;
}
