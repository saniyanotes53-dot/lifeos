import React,{useState,useRef,useEffect,useSyncExternalStore} from 'react';
import {Send,Sparkles} from 'lucide-react';
import {PrimaryButton,GhostButton} from './primitives';
import {inputStyle} from '../theme';
import {streamAssistant} from '../assistant/api';
import {confirmAssistantProposal} from '../firestore';
import {actionDescription} from '../assistant/actions';
import {localDateKey} from '../utils/dates';
import {eventTotals} from '../assistant/event-tags';
import {session,updateSession,subscribeSession,clearSession} from '../assistant/session';
const pick=(records,keys,limit=200)=>[...(records||[])].slice(0,limit).map(r=>Object.fromEntries(['id',...keys].filter(k=>r[k]!==undefined).map(k=>[k,r[k]])));
export default function AssistantPanel({t,user,data={},page='assistant',initialPrompt=''}){
 const uid=user.uid,s=useSyncExternalStore(fn=>subscribeSession(uid,fn),()=>session(uid));
 const {messages,history,memory,planning,budget,health,proposal,busy,error,status}=s;
 const directMode=s.directMode??true;
 const [text,setText]=useState(initialPrompt),[elapsed,setElapsed]=useState(0),bottom=useRef(null);
 const set=patch=>updateSession(uid,patch);
 useEffect(()=>{if(page==='budget')set({budget:true});},[page,uid]);
 useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest'});},[messages,proposal]);
 useEffect(()=>{setElapsed(0);if(!busy)return;const timer=setInterval(()=>setElapsed(v=>v+1),1000);return()=>clearInterval(timer);},[busy]);
 function context(){
  const now=new Date(),today=localDateKey(now),result={recordReadErrors:data.dataErrors||{},page,localDate:today,localTime:now.toTimeString().slice(0,5),timezoneOffsetMinutes:now.getTimezoneOffset(),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,currency:'INR',memory};
  if(planning)Object.assign(result,{tasks:pick([...(data.tasks||[])].sort((a,b)=>Number(a.done)-Number(b.done)),['title','priority','done','date'],400),blocks:pick((data.blocks||[]).filter(b=>b.date>=today).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)),['date','time','label','durationMinutes','taskId','done'],300)});
  if(budget){
   const rows=[...(data.tx||[])].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
   Object.assign(result,{transactions:pick(rows,['date','type','amount','category','note','eventTag']),categoryBudgets:pick(data.categoryBudgets,['category','limit']),wallets:pick(data.wallets,['name','balance']),subscriptions:pick(data.subscriptions,['name','amount','cycle','nextDate']),billSplits:pick(data.billSplits,['title','total','people','paidBy','settled']),loans:pick(data.loans,['person','amount','type','dueDate','settled']),eventTotals:eventTotals(rows).slice(0,100)});
   const monthly=rows.filter(x=>x.date?.startsWith(today.slice(0,7))&&x.date<=today);
   result.budgetSummary={month:today.slice(0,7),recordedIncome:monthly.filter(x=>x.type==='income').reduce((a,x)=>a+(Number(x.amount)||0),0),recordedExpenses:monthly.filter(x=>x.type==='expense').reduce((a,x)=>a+(Number(x.amount)||0),0),byCategory:monthly.filter(x=>x.type==='expense').reduce((a,x)=>({...a,[x.category]:(a[x.category]||0)+(Number(x.amount)||0)}),{}),transactionCount:monthly.length};
  }
  if(health)Object.assign(result,{sleep:pick(data.sleep,['date','hours'],30),workouts:pick(data.workouts,['date','type','minutes'],30)});
  result.recordLimit='Up to 400 tasks (open first), 300 future blocks, 200 recent transactions across months, 200 other records, 30 health rows. Monthly and event totals cover all saved transactions. Do not treat missing records as zero.';
  // Bound payload without dropping open tasks first. Summaries remain available.
  for(const key of ['transactions','blocks','tasks','billSplits','loans'])while(JSON.stringify(result).length>75000&&result[key]?.length>20)result[key].pop();
  return result;
 }
 async function send(event,retryMessage=null){
  event.preventDefault();const message=(retryMessage||text).trim();if(!message||session(uid).busy)return;
  if(proposal&&/^(yes|ok|okay|confirm|apply|save|do it)[.! ]*$/i.test(message)){setText('');await apply();return;}
  set({busy:true,error:'',status:'',partial:'',proposal:null,failedMessage:'',messages:retryMessage?messages:[...messages,{role:'user',text:message}].slice(-80)});setText('');
  const previous=proposal?{role:'assistant',text:'Unconfirmed proposal for revision only: '+JSON.stringify(proposal.actions.map(({before,...action})=>action))}:null;
  try{
   const result=await streamAssistant(user,{text:message,history:[...history,...(previous?[previous]:[])].slice(-40),context:context()},partial=>set({partial}));
   set({messages:[...session(uid).messages,{role:'assistant',text:result.reply}].slice(-80),history:[...history,{role:'user',text:message},{role:'assistant',text:result.reply}].slice(-40),memory:result.memory??memory,proposal:result.actions?.length?{proposalId:crypto.randomUUID(),createdAt:Date.now(),actions:result.actions}:null});
     if(result.actions?.length&&directMode)await apply(true);
  }catch(e){set({error:e.message,proposal,failedMessage:message});}finally{set({busy:false,partial:''});}
 }
 async function apply(fromSend=false){
  const current=session(uid);if(!current.proposal||(current.busy&&!fromSend))return;set({busy:true,error:'',status:'Saving your confirmed changes…'});
  try{
   const p=current.proposal,result=await confirmAssistantProposal(user,{...p,offset:new Date().getTimezoneOffset(),offsets:Object.fromEntries(p.actions.filter(a=>a.date&&a.time).map(a=>[a.ref,new Date(`${a.date}T${a.time}:00`).getTimezoneOffset()]))});
   const receipt=result.alreadyApplied?'These changes were already saved. No duplicates were created.':`Saved ${p.actions.length} confirmed change${p.actions.length===1?'':'s'}. Your screens will update automatically.`;
   set({status:receipt,messages:[...session(uid).messages,{role:'assistant',text:receipt}].slice(-80),history:[...session(uid).history,{role:'user',text:'Confirmed and saved successfully: '+p.actions.map(actionDescription).join('; ')+'. Do not repeat.'}].slice(-40),proposal:null});
  }catch(e){set({error:e.message,status:''});}finally{set({busy:false,partial:''});}
 }
 return <div style={{display:'grid',gap:14}}>
  {Object.entries(data.dataErrors||{}).some(([,error])=>error)&&<p role="alert">Some records could not load: {Object.entries(data.dataErrors||{}).filter(([,error])=>error).map(([name])=>name).join(', ')}. The assistant may not be able to find them.</p>}
  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}> {['Plan my day','Add a task','Analyze my budget','Log an expense'].map(prompt=><GhostButton key={prompt} t={t} disabled={busy} style={{width:'auto'}} onClick={()=>{setText(prompt);if(/budget|expense/.test(prompt))set({budget:true});}}>{prompt}</GhostButton>)}</div>
  <p style={{fontSize:12,color:t.muted,margin:0}}>Times use your device timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
  <label><input type="checkbox" checked={directMode} disabled={busy} onChange={e=>set({directMode:e.target.checked})}/> Apply my requested changes immediately</label><p style={{fontSize:12,color:t.muted,margin:0}}>{directMode?'Commands can add, edit or delete your records immediately. Turn this off to review changes first.':'Review proposed changes before saving.'}</p>
  <details><summary style={{cursor:'pointer',color:t.muted}}>Memory & shared records</summary>
   <p style={{fontSize:12,color:t.muted}}>Messages, memory and selected records go to Google Gemini. This account’s chat is remembered on this device across tabs and refreshes. Recent 40 messages and the editable summary below provide context.</p>
   <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>{[['Tasks & timetable','planning',planning],['Budget records','budget',budget],['Sleep & workouts','health',health]].map(([label,key,value])=><label key={key}><input type="checkbox" checked={value} disabled={busy} onChange={e=>set({[key]:e.target.checked,history:[],memory:'',proposal:null})}/> {label}</label>)}</div>
   <label style={{display:'block',marginTop:12}}>Remembered context<textarea aria-label="Remembered context" value={memory} maxLength={3000} disabled={busy} onChange={e=>set({memory:e.target.value})} rows={3} style={inputStyle(t)}/></label>
   <GhostButton t={t} disabled={busy} onClick={()=>clearSession(uid)}>Clear chat & memory</GhostButton>
  </details>
  {!messages.length&&<p style={{color:t.muted}}>Ask me to add or delete a task, reschedule your evening, or log ₹500 under #summer-vacation. Changes are shown for your confirmation.</p>}
  <div role="log" aria-live="polite" aria-label="Assistant conversation" style={{maxHeight:'48vh',overflowY:'auto',display:'grid',gap:10}}>{messages.map((m,i)=><div key={i} style={{background:m.role==='user'?t.surface2:t.bg,padding:14,borderRadius:14,marginLeft:m.role==='user'?20:0}}><strong style={{fontSize:12,color:t.a1}}>{m.role==='user'?'You':'Assistant'}</strong><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',margin:'6px 0 0'}}>{m.text}</p></div>)}{s.partial&&<div style={{background:t.bg,padding:14,borderRadius:14}}><strong style={{color:t.a1}}>Gemini draft · nothing saved yet</strong><p style={{whiteSpace:'pre-wrap'}}>{s.partial}</p></div>}<div ref={bottom}/></div>
  {proposal&&<section aria-label="Review proposed changes" style={{padding:16,border:`1px solid ${t.a1}`,borderRadius:14}}><strong>Review before saving</strong><ol style={{paddingLeft:20}}>{proposal.actions.map(a=><li key={a.ref} style={{padding:'6px 0'}}>{actionDescription(a)}{a.before&&!a.type.startsWith('delete')&&<div style={{fontSize:12,color:t.muted}}>Currently: {a.before.title||a.before.label||a.before.category} {a.before.time?`${a.before.date} ${a.before.time}`:''} {a.before.limit?`₹${a.before.limit}`:''}</div>}</li>)}</ol><div style={{display:'flex',gap:8}}><PrimaryButton t={t} disabled={busy} onClick={()=>apply()}>Confirm changes</PrimaryButton><GhostButton t={t} disabled={busy} onClick={()=>set({proposal:null,status:'Discarded. Nothing was saved.',history:[...history,{role:'user',text:'I discarded the last proposal. It was not saved.'}].slice(-40)})}>Discard</GhostButton></div><p style={{fontSize:12,color:t.muted}}>Confirm here or reply “yes”. Ask for adjustments to revise this proposal before saving.</p></section>}
  {error&&<p role="alert" style={{color:t.bad||t.text,margin:0}}>{error}</p>}{s.failedMessage&&<GhostButton t={t} disabled={busy} onClick={e=>send(e,s.failedMessage)}>Retry last message</GhostButton>}{status&&<p role="status">{status}</p>}
  {busy&&<p role="status"><Sparkles size={14}/> {status.startsWith('Saving')?'Saving':'Gemini is preparing your reply'}… {elapsed}s{elapsed>15?' · Still waiting for the service; your request has not been sent twice.':''}</p>}
  <form onSubmit={send} style={{display:'flex',gap:8,alignItems:'end'}}><textarea aria-label="Message Gemini" placeholder="Add revision tomorrow at 7 pm…" maxLength={6000} rows={2} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(e);}}} style={{...inputStyle(t),flex:1,minWidth:0,resize:'vertical'}}/><PrimaryButton type="submit" t={t} disabled={busy||!text.trim()} aria-label="Send message" style={{width:'auto'}}><Send size={18}/></PrimaryButton></form>
 </div>;
}
