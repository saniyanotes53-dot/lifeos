import React,{useEffect,useRef,useState} from 'react';
import {Activity,Dumbbell,Utensils,Scale,Moon,Settings} from 'lucide-react';
import {Screen,Card,Segmented,Field,PrimaryButton} from './primitives';
import {inputStyle,todayStr} from '../theme';
import {watchCollection,saveHealthRecord,addItem,saveSleep} from '../firestore';
import {dateRange,inDateRange} from '../utils/dates';
import {useLocalDay} from '../useLocalDay';
import ProductSuggestions from './ProductSuggestions';
import SectionReset from './SectionReset';
import HealthProfile from './health/HealthProfile';
import NutritionStudio from './health/NutritionStudio';
import WorkoutStudio from './health/WorkoutStudio';
import HealthLog from './health/HealthLog';
import {NumberField,nutrients,validNumber,grid} from './health/shared';
const DEFAULT_PROFILE={goal:'wellbeing',diet:'vegetarian',targets:{},allergies:[],weeklyMinutes:150};
export default function HealthScreen({t,sleep=[],workouts=[],meals=[],user,userId,bodyMetrics=[],initialView='goals'}){
 const [sub,setSub]=useState(initialView),[settings,setSettings]=useState([]),[plans,setPlans]=useState([]),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const lock=useRef(false),day=useLocalDay();
 const profile=settings.find(s=>s.id==='profile')||DEFAULT_PROFILE;
 const sortedMetrics=[...bodyMetrics].sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
 const latest=sortedMetrics[0]||{};
 const [metric,setMetric]=useState({weight:'',height:''});
 const [bed,setBed]=useState('23:00'),[wake,setWake]=useState('07:00');
 useEffect(()=>{setMetric({weight:latest.weight??'',height:latest.height??''});},[latest.weight,latest.height]);
 useEffect(()=>{setLoaded(false);const a=watchCollection(userId,'healthSettings',rows=>{setSettings(rows);setLoaded(true);});const b=watchCollection(userId,'mealPlans',setPlans,'date');return()=>{a();b();};},[userId]);
 async function run(fn,success){if(lock.current)return;lock.current=true;setBusy(true);setMessage('');try{await fn();setMessage(success===false?'':success||'Saved.');}catch(e){setMessage(e.message||'Could not save. Please retry.');}finally{lock.current=false;setBusy(false);}}
 const todays=meals.filter(m=>m.date===day),range=dateRange(7,day),week=workouts.filter(w=>inDateRange(w.date,range));
 const minutes=week.reduce((s,w)=>s+(Number(w.minutes)||0),0),target=Number(profile.weeklyMinutes)||150;
 const recentSleep=[...sleep].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 const bmi=Number(metric.weight)>0&&Number(metric.height)>0?Number(metric.weight)/(Number(metric.height)/100)**2:null;
 const sections=[['goals','Today',Activity],['diet','Food & plan',Utensils],['workout','Gym & movement',Dumbbell],['sleep','Sleep',Moon],['bmi','Measurements',Scale],['profile','Preferences',Settings]];
 return <Screen t={t} title="Your health, connected"><div style={{maxWidth:1000,margin:'0 auto',display:'grid',gap:18}}>
 <div style={{overflowX:"auto",minWidth:0}}><div style={{minWidth:640}}><Segmented t={t} value={sub} onChange={setSub} options={sections}/></div></div>
 {message&&<p role="status" style={{padding:14,borderRadius:12,background:t.surface2}}>{message}</p>}
 {!loaded&&<p>Loading your health preferences…</p>}
 {loaded&&sub==='profile'&&<HealthProfile key={profile.updatedAt||'new'} t={t} profile={profile} busy={busy} onSave={p=>run(()=>saveHealthRecord(userId,'healthSettings','profile',{...p,updatedAt:new Date().toISOString()}),'Preferences saved. Generate a fresh meal plan to use them.')}/>}
 {sub==='goals'&&<>
 <Card t={t}><small style={{color:t.muted}}>{new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</small><h2>A clearer picture of today</h2><p>Food, movement and recovery in one place. These are your recorded habits, not a health score.</p><div style={grid}>
 <div style={{padding:18,borderRadius:16,background:t.surface2}}><h3>{todays.length} meals logged</h3><p>{todays.length?'Review today’s nutrient totals below.':'Nothing logged yet; your intake is unknown.'}</p><PrimaryButton t={t} onClick={()=>setSub('diet')}>Plan or log a meal</PrimaryButton></div>
 <div style={{padding:18,borderRadius:16,background:t.surface2}}><h3>{Math.round(minutes)} / {target} min</h3><p>{week.length} sessions in the last 7 days · your activity goal</p><progress aria-label="Weekly activity progress" max={target} value={Math.min(minutes,target)} style={{width:'100%',accentColor:t.a1}}/><PrimaryButton t={t} style={{marginTop:12}} onClick={()=>setSub('workout')}>Start or log activity</PrimaryButton></div>
 <div style={{padding:18,borderRadius:16,background:t.surface2}}><h3>{recentSleep[0]?`${recentSleep[0].hours} h sleep`:'Sleep not logged'}</h3><p>{recentSleep[0]?`Most recent: ${recentSleep[0].date}`:'Record your wake-up date to see recovery context.'}</p><PrimaryButton t={t} onClick={()=>setSub('sleep')}>Update sleep</PrimaryButton></div>
 </div>{!profile.age&&<PrimaryButton t={t} style={{marginTop:20}} onClick={()=>setSub('profile')}>Set up your health preferences</PrimaryButton>}</Card>
 <Card t={t}><h2>Today’s recorded nutrition</h2><p>Blank nutrients stay unknown. Remaining amounts compare only with targets you entered; they do not diagnose deficiencies.</p><div style={grid}>{nutrients.map(([k,label,unit])=>{const known=todays.filter(m=>validNumber(m[k])),value=known.reduce((s,m)=>s+Number(m[k]),0),goal=profile.targets?.[k];return <div key={k} style={{padding:14,borderRadius:12,background:t.surface2}}><strong>{label}</strong><p style={{fontSize:22,margin:'8px 0'}}>{known.length?Math.round(value*10)/10:'—'} <small>{unit}</small></p><small>{known.length} / {todays.length} meals have this value{goal?` · target ${goal} ${unit}`:''}</small>{goal&&known.length===todays.length&&todays.length>0&&<p>{Math.max(0,Math.round((goal-value)*10)/10)} {unit} remaining to your target</p>}</div>;})}</div></Card>
 </>}
 {sub==='diet'&&<>{loaded&&<NutritionStudio key={day} onSaveProfile={p=>saveHealthRecord(userId,'healthSettings','profile',{...p,updatedAt:new Date().toISOString()})} t={t} user={user} profile={profile} meals={meals} savedPlan={plans.find(p=>p.date===day)} run={run} busy={busy}/>}<HealthLog t={t} userId={userId} kind="meals" records={meals} run={run} busy={busy}/></>}
 {sub==='workout'&&<>{loaded&&<WorkoutStudio t={t} userId={userId} profile={profile} workouts={workouts} sleep={sleep} run={run} busy={busy}/>}<HealthLog t={t} userId={userId} kind="workouts" records={workouts} run={run} busy={busy}/></>}
 {sub==='sleep'&&<Card t={t}><h2>Sleep & recovery</h2><p>Save the night ending today. Saving again updates this night rather than duplicating it.</p><div style={grid}><Field t={t} label="Bedtime"><input style={inputStyle(t)} type="time" value={bed} onChange={e=>setBed(e.target.value)}/></Field><Field t={t} label="Wake time"><input style={inputStyle(t)} type="time" value={wake} onChange={e=>setWake(e.target.value)}/></Field></div><PrimaryButton t={t} disabled={busy} onClick={()=>run(async()=>{if(!bed||!wake)throw Error('Enter both times.');const [bh,bm]=bed.split(':').map(Number),[wh,wm]=wake.split(':').map(Number);const mins=(wh*60+wm-bh*60-bm+1440)%1440;if(!mins)throw Error('Bed and wake times must differ.');await saveSleep(userId,todayStr(),{bed,wake,hours:Math.round(mins/6)/10});},'Sleep updated.')}>Save sleep</PrimaryButton><h3>Recent nights</h3>{recentSleep.slice(0,14).map(s=><p key={s.id||s.date}>{s.date} · {s.hours} h · {s.bed} → {s.wake}</p>)}</Card>}
 {sub==='bmi'&&<Card t={t}><h2>Body measurements</h2><p>Track changes over time. Adult BMI is a rough screening measure and does not assess muscle, pregnancy or overall health.</p><form onSubmit={e=>{e.preventDefault();run(()=>addItem(userId,'bodyMetrics',{date:day,weight:Number(metric.weight),height:Number(metric.height),updatedAt:new Date().toISOString()}),'Measurements saved.');}}><div style={grid}><NumberField t={t} label="Weight (kg)" value={metric.weight} min={20} max={400} required onChange={v=>setMetric(m=>({...m,weight:v}))}/><NumberField t={t} label="Height (cm)" value={metric.height} min={80} max={250} required onChange={v=>setMetric(m=>({...m,height:v}))}/></div>{bmi&&Number(profile.age)>=18&&<p>Calculated adult BMI: {bmi.toFixed(1)}</p>}<PrimaryButton t={t} type="submit" disabled={busy}>Save measurements</PrimaryButton></form><h3>Measurement history</h3>{sortedMetrics.slice(0,12).map(m=><p key={m.id}>{m.date} · {m.weight} kg · {m.height} cm</p>)}</Card>}
 <ProductSuggestions t={t} section="Health"/>
 <SectionReset t={t} scope="health"/>
 </div></Screen>;
}
