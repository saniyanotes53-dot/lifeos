import React,{useEffect,useRef,useState} from 'react';
import {Card,Field,PrimaryButton,GhostButton} from '../primitives';
import {inputStyle,todayStr} from '../../theme';
import {addItem,saveHealthRecord} from '../../firestore';
import {NumberField,grid} from './shared';
const templates=[{name:'Gentle full-body practice',exercises:['Chair squat','Wall push-up','Standing calf raise'],minutes:20},{name:'Walk and mobility',exercises:['Comfortable walk','Gentle shoulder mobility','Gentle ankle mobility'],minutes:20}];
export default function WorkoutStudio({t,userId,profile,workouts,sleep,run,busy}){
 const [template,setTemplate]=useState(0),[session,setSession]=useState(null),[clock,setClock]=useState(Date.now()),[date,setDate]=useState(todayStr()),[time,setTime]=useState('18:00');
 const ref=useRef(null),[ready,setReady]=useState(false);
 useEffect(()=>{try{const s=JSON.parse(localStorage.getItem(`lifeos_workout_v1_${userId}`)||'null');if(s?.id&&Array.isArray(s.sets))setSession(s);}catch{}setReady(true);},[userId]);
 useEffect(()=>{ref.current=session;if(!ready)return;try{if(session)localStorage.setItem(`lifeos_workout_v1_${userId}`,JSON.stringify(session));else localStorage.removeItem(`lifeos_workout_v1_${userId}`);}catch{}},[session,userId,ready]);
 useEffect(()=>{if(!session?.runningSince)return;const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[session?.runningSince]);
 const elapsed=session?Math.max(0,(session.elapsed||0)+(session.runningSince?clock-session.runningSince:0)):0;
 const blocked=profile.injury||profile.medicalStatus!=='none'||Number(profile.age)<18||!profile.age;
 const latestSleep=[...sleep].sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
 const previous=workouts.find(w=>w.name===(session?.name||templates[template].name));
 function start(){const p=templates[template];setClock(Date.now());setSession({id:crypto.randomUUID(),name:p.name,date:todayStr(),runningSince:Date.now(),elapsed:0,sets:p.exercises.map(name=>({name,reps:'',load:'',done:false})),effort:5});}
 function change(i,k,v){setSession(s=>({...s,sets:s.sets.map((r,j)=>j===i?{...r,[k]:v}:r)}));}
 async function finish(){const s=ref.current;if(!s)return;const ms=(s.elapsed||0)+(s.runningSince?Date.now()-s.runningSince:0);if(ms>86400000)throw Error('This session exceeds 24 hours. Discard it and enter the actual completed minutes below.');if(ms<10000)throw Error('Complete some activity before saving this session.');const done=s.sets.filter(x=>x.done);if(done.some(x=>['reps','load'].some(k=>x[k]!==''&&(!Number.isFinite(Number(x[k]))||Number(x[k])<0||Number(x[k])>500))))throw Error('Reps and load must be between 0 and 500.');if(!done.length)throw Error('Tick the exercises you completed first.');
  await saveHealthRecord(userId,'workouts',s.id,{date:s.date,name:s.name,minutes:Math.round(ms/6000)/10,effort:Number(s.effort),sets:done.map(x=>({name:x.name,reps:x.reps===''?null:Number(x.reps),load:x.load===''?null:Number(x.load)}))});setSession(null);
 }
 return <Card t={t}><h2>Move, record, reflect</h2><p>Choose a comfortable session. Stop if you feel pain, dizziness or unusual breathlessness. These starter sessions do not replace a trainer or rehabilitation plan.</p>
 {latestSleep&&<p style={{color:t.muted}}>Last recorded sleep: {latestSleep.hours} h on {latestSleep.date}. Adjust today’s effort to how rested you feel.</p>}
 {blocked&&!session&&<p>Save an adult health profile with no exercise restrictions to use guided sessions. You can still record activity you have safely completed below.</p>}
 {!session?<><Field t={t} label="Starter session"><select style={inputStyle(t)} value={template} onChange={e=>setTemplate(Number(e.target.value))}>{templates.map((p,i)=><option key={p.name} value={i}>{p.name}</option>)}</select></Field><div style={grid}><PrimaryButton t={t} disabled={busy||blocked||!ready} onClick={start}>Start session</PrimaryButton><div><Field t={t} label="Workout date"><input style={inputStyle(t)} type="date" min={todayStr()} value={date} onChange={e=>setDate(e.target.value)}/></Field><Field t={t} label="Workout time"><input style={inputStyle(t)} type="time" value={time} onChange={e=>setTime(e.target.value)}/></Field><GhostButton t={t} disabled={busy||blocked} onClick={()=>run(async()=>{if(new Date(`${date}T${time}`).getTime()<=Date.now()||!date||!time)throw Error('Choose a future date and time.');await addItem(userId,'timetable',{date,time,label:`Workout: ${templates[template].name}`,done:false});},'Workout added to your timetable. Reminder delivery follows your notification settings.')}>Schedule in timetable</GhostButton></div></div></>:<>
 <h3>{session.name}</h3><p aria-live="off" style={{fontSize:28,fontVariantNumeric:'tabular-nums'}}>{Math.floor(elapsed/60000)}:{String(Math.floor(elapsed/1000)%60).padStart(2,'0')} <small style={{fontSize:12}}>{session.runningSince?'active':'paused'}</small></p>
 <GhostButton t={t} disabled={busy} onClick={()=>{const now=Date.now();setClock(now);setSession(s=>({...s,elapsed:(s.elapsed||0)+(s.runningSince?now-s.runningSince:0),runningSince:s.runningSince?null:now}));}}>{session.runningSince?'Pause timer':'Resume timer'}</GhostButton>
 {session.sets.map((s,i)=><div key={i} style={{marginTop:16,padding:14,borderRadius:12,background:t.surface2}}><label><input type="checkbox" checked={s.done} disabled={busy} onChange={e=>change(i,'done',e.target.checked)}/> {s.name}</label><div style={grid}><NumberField t={t} label={`Reps · ${s.name} ${i+1} (optional)`} value={s.reps} max={500} step={1} onChange={v=>change(i,'reps',v)}/><NumberField t={t} label={`Load kg · ${s.name} ${i+1} (optional)`} value={s.load} max={500} onChange={v=>change(i,'load',v)}/></div><GhostButton t={t} disabled={busy} onClick={()=>setSession(x=>({...x,sets:[...x.sets,{...s,done:false}]}))}>Add another set</GhostButton></div>)}
 <Field t={t} label={`Effort felt: ${session.effort} / 10`}><input style={{width:'100%'}} type="range" min={1} max={10} value={session.effort} onChange={e=>setSession(s=>({...s,effort:Number(e.target.value)}))}/></Field>
 <div style={grid}><PrimaryButton t={t} disabled={busy} onClick={()=>run(finish,'Workout saved. Your activity progress updated.')}>Finish & save completed activity</PrimaryButton><GhostButton t={t} disabled={busy} onClick={()=>{if(window.confirm('Discard this unfinished workout?'))setSession(null);}}>Discard session</GhostButton></div>
 </>}
 {previous&&<p>Previous matching session: {previous.minutes} min{previous.effort?` · effort ${previous.effort}/10`:''} on {previous.date}. Aim for consistency before increasing load.</p>}
 </Card>;
}
