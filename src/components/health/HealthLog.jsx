import React,{useState} from 'react';
import {Card,Field,PrimaryButton,GhostButton} from '../primitives';
import {inputStyle,todayStr} from '../../theme';
import {addItem,updateItem,deleteItem} from '../../firestore';
import {NumberField,NutrientLine,nutrients,grid} from './shared';
export default function HealthLog({t,userId,kind,records,run,busy}){
 const empty=()=>({name:'',date:todayStr()});const [form,setForm]=useState(empty),[edit,setEdit]=useState(null);
 const isMeal=kind==='meals',change=(k,v)=>setForm(f=>({...f,[k]:v}));
 async function save(){
  if(!form.name?.trim())throw Error('Enter a name.');
  const data={...form,name:form.name.trim()};delete data.id;
  for(const k of isMeal?nutrients.map(n=>n[0]):['minutes']){data[k]=form[k]==null||form[k]===''?null:Number(form[k]);if(data[k]!==null&&(!Number.isFinite(data[k])||data[k]<0||data[k]>100000))throw Error('Enter valid positive values.');}
  if(!isMeal&&(!data.minutes||data.minutes>1440))throw Error('Enter between 0 and 1,440 minutes.');
  if(edit)await updateItem(userId,kind,edit,data);else await addItem(userId,kind,data);
  setEdit(null);setForm(empty());
 }
 return <Card t={t}><h2>{edit?'Edit entry':isMeal?'Log what you ate':'Log completed activity'}</h2><form onSubmit={e=>{e.preventDefault();run(save,'Entry saved.');}}><fieldset disabled={busy} style={{border:0,padding:0}}><div style={grid}><Field t={t} label={isMeal?'Food / meal name':'Activity name'}><input required maxLength={120} style={inputStyle(t)} value={form.name} onChange={e=>change('name',e.target.value)}/></Field><Field t={t} label="Date"><input required style={inputStyle(t)} type="date" max={todayStr()} value={form.date} onChange={e=>change('date',e.target.value)}/></Field></div>
 {isMeal?<><p>Enter nutrients from a label or a known recipe. Leave unknown values blank.</p><div style={grid}>{nutrients.map(([k,label,unit])=><NumberField key={k} t={t} label={`${label} (${unit})`} value={form[k]} onChange={v=>change(k,v)}/>)}</div></>:<NumberField t={t} label="Completed minutes" value={form.minutes} min={.1} max={1440} required onChange={v=>change('minutes',v)}/>}
 <PrimaryButton t={t} type="submit" disabled={busy}>{edit?'Save changes':'Add to log'}</PrimaryButton>{edit&&<GhostButton t={t} onClick={()=>{setEdit(null);setForm(empty());}}>Cancel edit</GhostButton>}</fieldset></form>
 <h3>Recent {isMeal?'meals':'activity'}</h3>{!records.length&&<p>No entries yet. Your progress starts with your first log.</p>}
 {records.slice(0,20).map(r=><div key={r.id} style={{padding:'16px 0',borderBottom:`1px solid ${t.line}`}}><strong>{r.name}</strong><small style={{display:'block',color:t.muted}}>{r.date}{!isMeal?` · ${r.minutes} min`:''}</small>{isMeal&&<NutrientLine values={r}/>}{r.sets?.length>0&&<p>{r.sets.map(s=>`${s.name}${s.reps!=null?` ${s.reps} reps`:''}${s.load!=null?` × ${s.load} kg`:''}`).join(' · ')}</p>}<div style={{display:'flex',gap:10}}><GhostButton t={t} disabled={busy} onClick={()=>{setForm(r);setEdit(r.id);}}>Edit</GhostButton><GhostButton t={t} disabled={busy} onClick={()=>{if(window.confirm(`Delete ${r.name}?`))run(()=>deleteItem(userId,kind,r.id),'Entry deleted.');}}>Delete</GhostButton></div></div>)}
 </Card>;
}
