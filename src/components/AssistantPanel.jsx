import React,{useState,useRef,useEffect} from 'react';
import {Send,Sparkles} from 'lucide-react';
import {PrimaryButton,GhostButton} from './primitives';
import {inputStyle} from '../theme';
import {userRequest} from '../assistant/api';
import {actionDescription} from '../assistant/actions';
import {localDateKey} from '../utils/dates';
const pick=(records,keys,limit=150)=>[...(records||[])].slice(0,limit).map(r=>Object.fromEntries(['id',...keys].filter(k=>r[k]!==undefined).map(k=>[k,r[k]])));
export default function AssistantPanel({t,user,data={},page='assistant',initialPrompt=''}){
 const [messages,setMessages]=useState([{role:'assistant',text:'Tell me what you want to do. I can add tasks, build or change your timetable, suggest budget limits, and explain your records. You review and confirm every change.'}]);
 const [text,setText]=useState(initialPrompt),[busy,setBusy]=useState(false),[error,setError]=useState(''),[proposal,setProposal]=useState(null),[status,setStatus]=useState('');
 const [planning,setPlanning]=useState(true),[budget,setBudget]=useState(page==='budget'),[health,setHealth]=useState(false);
 const history=useRef([]),lock=useRef(false),bottom=useRef(null),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest'});},[messages,proposal]);
 function context(){
  const now=new Date(),result={page,localDate:localDateKey(now),localTime:now.toTimeString().slice(0,5),timezoneOffsetMinutes:now.getTimezoneOffset(),currency:'INR'};
  if(planning)Object.assign(result,{tasks:pick(data.tasks,['title','priority','done','date']),blocks:pick((data.blocks||[]).filter(b=>b.date>=localDateKey(now)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)),['date','time','label','durationMinutes','taskId','done'])});
  if(budget)Object.assign(result,{transactions:pick((data.tx||[]).filter(x=>x.date?.startsWith(localDateKey(now).slice(0,7))),['date','type','amount','category','note']),categoryBudgets:pick(data.categoryBudgets,['category','limit']),wallets:pick(data.wallets,['name','balance']),subscriptions:pick(data.subscriptions,['name','amount','cycle','nextDate']),billSplits:pick(data.billSplits,['title','total','people','paidBy','settled']),loans:pick(data.loans,['person','amount','type','dueDate','settled','status'])});
  if(budget){const monthly=(data.tx||[]).filter(x=>x.date?.startsWith(result.localDate.slice(0,7))&&x.date<=result.localDate);result.budgetSummary={month:result.localDate.slice(0,7),recordedIncome:monthly.filter(x=>x.type==='income').reduce((sum,x)=>sum+(Number(x.amount)||0),0),recordedExpenses:monthly.filter(x=>x.type==='expense').reduce((sum,x)=>sum+(Number(x.amount)||0),0),transactionCount:monthly.length,note:'Totals cover all recorded transactions this month; detailed rows may be truncated. Not a live bank balance.'};}
  if(health)Object.assign(result,{sleep:pick(data.sleep,['date','hours'],30),workouts:pick(data.workouts,['date','type','duration'],30)});
  result.recordLimit='At most 150 records per included collection and 30 health records; transactions are current month only. Treat these as partial records, not full account totals.';
  return result;
 }
 async function send(event){
  event.preventDefault();const message=text.trim();if(!message||lock.current)return;
  if(proposal&&/^(yes|ok|okay|confirm|apply|save|do it)[.! ]*$/i.test(message)){setText('');setMessages(old=>[...old,{role:'user',text:message},{role:'assistant',text:'Your proposal is ready below. Press Confirm changes to save it.'}]);return;}
  lock.current=true;setBusy(true);setError('');setStatus('');setProposal(null);setText('');setMessages(old=>[...old,{role:'user',text:message}].slice(-60));
  try{
   const result=await userRequest(user,'/api/assistant','POST',{text:message,history:history.current.slice(-12),context:context()});
   if(!alive.current)return;
   setMessages(old=>[...old,{role:'assistant',text:result.reply}].slice(-60));
   history.current=[...history.current,{role:'user',text:message},{role:'assistant',text:result.reply}].slice(-12);
   if(result.actions?.length)setProposal({proposalId:crypto.randomUUID(),actions:result.actions});
  }catch(e){if(alive.current){setError(e.message);setText(message);}}finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 async function apply(){
  if(!proposal||lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   await userRequest(user,'/api/assistant-apply','POST',{...proposal,offset:new Date().getTimezoneOffset(),offsets:Object.fromEntries(proposal.actions.filter(a=>a.date&&a.time).map(a=>[a.ref,new Date(`${a.date}T${a.time}:00`).getTimezoneOffset()]))});
   if(!alive.current)return;
   const receipt='Saved your confirmed changes. Your task, timetable and budget screens update automatically.';
   setStatus(receipt);setMessages(old=>[...old,{role:'assistant',text:receipt}]);history.current=[...history.current,{role:'user',text:'I confirmed the proposal and the app saved it successfully. Do not repeat these changes.'}].slice(-12);setProposal(null);
  }catch(e){if(alive.current)setError(e.message);}finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 return <div style={{display:'grid',gap:14}}>
  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{['Plan my day','Add a task','Analyze my budget','Help me decide on a purchase'].map(prompt=><GhostButton key={prompt} t={t} disabled={busy} style={{width:'auto'}} onClick={()=>{setText(prompt);if(/budget|purchase/.test(prompt))setBudget(true);}}>{prompt}</GhostButton>)}</div>
  <p style={{fontSize:12,color:t.muted,margin:0}}>Your selected records and messages go to Google Gemini. Review sharing below.</p>
  <details><summary style={{cursor:'pointer',color:t.muted}}>Records included with your message</summary><p style={{fontSize:13,color:t.muted}}>Selected records and conversation messages are sent to Google Gemini. Turn off any data you don’t want to share. Up to 150 records per category are included.</p>
   <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>{[['Tasks & timetable',planning,setPlanning],['Budget records',budget,setBudget],['Sleep & workouts',health,setHealth]].map(([label,value,set])=><label key={label}><input type="checkbox" checked={value} disabled={busy} onChange={e=>{set(e.target.checked);history.current=[];}}/> {label}</label>)}</div>
  </details>
  <div role="log" aria-live="polite" aria-label="Assistant conversation" style={{maxHeight:'45vh',overflowY:'auto',display:'grid',gap:10}}>{messages.map((m,i)=><div key={i} style={{background:m.role==='user'?t.surface2:t.bg,padding:14,borderRadius:14,marginLeft:m.role==='user'?20:0}}><strong style={{fontSize:12,color:t.a1}}>{m.role==='user'?'You':'Gemini'}</strong><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',margin:'6px 0 0'}}>{m.text}</p></div>)}<div ref={bottom}/></div>
  {proposal&&<section aria-label="Review proposed changes" style={{padding:16,border:`1px solid ${t.a1}`,borderRadius:14}}><strong>Review before saving</strong><ol style={{paddingLeft:20}}>{proposal.actions.map(a=><li key={a.ref} style={{padding:'6px 0'}}>{actionDescription(a)}{a.before&&<div style={{fontSize:12,color:t.muted}}>Currently: {a.before.title||a.before.label||a.before.category} {a.before.time?`${a.before.date} ${a.before.time}`:''} {a.before.limit?`₹${a.before.limit}`:''} {a.type==='update_task'?`${a.before.priority} · ${a.before.done?'completed':'open'}`:''}</div>}</li>)}</ol><div style={{display:'flex',gap:8}}><PrimaryButton t={t} disabled={busy} onClick={apply}>Confirm changes</PrimaryButton><GhostButton t={t} disabled={busy} onClick={()=>{setProposal(null);setStatus('Proposal discarded. Nothing was saved.');}}>Discard</GhostButton></div><p style={{fontSize:12,color:t.muted}}>A new message replaces this proposal. Nothing is saved until you confirm.</p></section>}
  {error&&<p role="alert" style={{color:t.bad||t.text,margin:0}}>{error}</p>}{status&&<p role="status">{status}</p>}
  {busy&&<p role="status"><Sparkles size={14}/> Working…</p>}
  <form onSubmit={send} style={{display:'flex',gap:8,alignItems:'end'}}><textarea aria-label="Message Gemini" placeholder="Add revision at 7 pm tomorrow, then plan my evening…" maxLength={6000} rows={2} disabled={busy} value={text} onChange={e=>setText(e.target.value)} style={{...inputStyle(t),flex:1,minWidth:0,resize:'vertical'}}/><PrimaryButton type="submit" t={t} disabled={busy||!text.trim()} aria-label="Send message" style={{width:'auto'}}><Send size={18}/></PrimaryButton></form>
 </div>;
}
