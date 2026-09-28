import React,{useState} from 'react';
import {Card,Field,PrimaryButton,GhostButton} from '../primitives';
import {inputStyle,todayStr} from '../../theme';
import {userRequest} from '../../assistant/api';
import {saveHealthRecord} from '../../firestore';
import {NutrientLine,grid,validNumber} from './shared';
export default function NutritionStudio({t,user,profile,meals,savedPlan,run,busy}){
 const [result,setResult]=useState(null),[draft,setDraft]=useState(null),[consent,setConsent]=useState(false);
 const visible=draft||savedPlan?.plan||[];
 async function generate(){
  const r=await userRequest(user,'/api/assistant','POST',{action:'health-plan',date:todayStr(),hour:new Date().getHours()});
  setResult(r);if(!r.blocked)setDraft(r.plan.map(m=>({...m,portion:1})));
 }
 async function save(){await saveHealthRecord(user.uid,'mealPlans',todayStr(),{date:todayStr(),plan:visible,source:result?.source||savedPlan.source,generatedAt:result?.generatedAt||savedPlan.generatedAt,profileRevision:profile.updatedAt||''});setDraft(null);}
 const scale=m=>Object.fromEntries(Object.entries(m.nutrients||{}).map(([k,v])=>[k,validNumber(v)?Math.round(v*(m.portion||1)*10)/10:null]));
 const stale=savedPlan?.profileRevision!==profile.updatedAt;
 return <div style={{display:'grid',gap:16}}><Card t={t}><h2>What could I eat next?</h2><p>Use your saved preferences, today’s food log, recent sleep and activity to choose from meals with sourced nutrition estimates.</p>
 <label style={{display:'flex',gap:10,lineHeight:1.6,marginBottom:16}}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Use my health logs for this plan. Nutrient totals, my goal and activity summary may be sent to Google Gemini; my name and email are not included.</label>
 <PrimaryButton t={t} disabled={busy||!consent||!profile.age} onClick={()=>run(generate,'Meal ideas ready. Review portions before saving.')}>{busy?'Planning…':'Suggest next meal & plan today'}</PrimaryButton>
 {!profile.age&&<p>Save your health preferences first.</p>}
 {result?.blocked&&<p role="status">{result.message}</p>}
 {result?.nextMeal&&<div style={{background:t.surface2,padding:18,borderRadius:18,marginTop:18}}><small>{result.selection}</small><h3>{result.nextMeal.name}</h3><p>{result.nextMeal.method}</p><NutrientLine values={result.nextMeal.nutrients}/><p>Selected for this time of day from meals matching your exclusions{Object.keys(result.summary.remainingToUserTargets).length?', considering the remaining amounts toward your own targets':''}.</p><small>Based on {result.summary.workoutMinutesLast7Days} activity minutes in 7 days · latest recorded sleep: {result.summary.lastSleepHours??'unknown'} hours.</small></div>}
 {result?.notes&&<details style={{marginTop:14}}><summary>How to use this plan</summary><ul>{result.notes.map(n=><li key={n}>{n}</li>)}</ul></details>}
 </Card>
 {!!visible.length&&<Card t={t}><h2>{draft?'Review your daily plan':'Your saved plan for today'}</h2>{!draft&&stale&&<p role="alert">Your preferences changed. Generate a fresh plan before logging these meals.</p>}
 <div style={grid}>{visible.map((meal,i)=>{
  const eaten=meals.some(m=>m.id===`plan_${todayStr()}_${meal.slot}`);
  return <section key={meal.slot} style={{background:t.surface2,borderRadius:16,padding:18}}><small style={{textTransform:'capitalize'}}>{meal.slot}</small><h3>{meal.name}</h3>
  {draft&&<Field t={t} label={`Swap ${meal.slot}`}><select style={inputStyle(t)} value={meal.id} onChange={e=>setDraft(d=>d.map((m,j)=>j===i?{...result.alternatives.find(a=>a.id===e.target.value),portion:m.portion}:m))}>{result.alternatives.filter(a=>a.slot===meal.slot).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>}
  {draft&&<Field t={t} label={`${meal.slot} portion`}><select style={inputStyle(t)} value={meal.portion||1} onChange={e=>setDraft(d=>d.map((m,j)=>j===i?{...m,portion:Number(e.target.value)}:m))}>{[.5,.75,1,1.25,1.5,2].map(n=><option key={n} value={n}>{n} × portion</option>)}</select></Field>}
  <ul>{meal.ingredients.map(f=><li key={f.fdcId}>{Math.round(f.grams*(meal.portion||1))} g {f.name}</li>)}</ul><p>{meal.method}</p><NutrientLine values={scale(meal)}/>
  {!draft&&<GhostButton t={t} disabled={busy||eaten||stale} onClick={()=>run(()=>saveHealthRecord(user.uid,'meals',`plan_${todayStr()}_${meal.slot}`,{date:todayStr(),name:meal.name,...scale(meal),source:'meal-plan',recipeId:meal.id,portion:meal.portion||1}),'Meal logged. Today’s totals updated.')}>{eaten?'✓ Logged as eaten':'I ate this · add to food log'}</GhostButton>}
  </section>;
 })}</div>
 {draft&&<PrimaryButton t={t} style={{marginTop:16}} disabled={busy} onClick={()=>run(save,'Daily plan saved. Meals are not marked eaten yet.')}>Save this daily plan</PrimaryButton>}
 <p style={{color:t.muted,fontSize:13}}>Nutrition source: {(result?.source||savedPlan?.source)?.kind} · retrieved {new Date((result?.source||savedPlan?.source)?.retrievedAt).toLocaleString()}. Estimates vary with ingredients and preparation.</p>
 <details><summary>Food data sources</summary>{[...new Map(visible.flatMap(m=>m.ingredients).map(f=>[f.fdcId,f])).values()].map(f=><p key={f.fdcId}><a href={`https://fdc.nal.usda.gov/food-details/${f.fdcId}/nutrients`} target="_blank" rel="noreferrer">USDA · {f.name}</a></p>)}</details>
 </Card>}
 </div>;
}
