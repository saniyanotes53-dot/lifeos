import React,{useState,useRef,useEffect} from 'react';
import {MessageCircle,Send,CalendarDays,Bell,BarChart3} from 'lucide-react';
import {Screen,Card,Field,PrimaryButton,GhostButton} from './primitives';
import {inputStyle} from '../theme';
import {localDateKey,parseLocalDate,shiftDate} from '../utils/dates';
import {proposePlan,reportSummary,intent} from '../assistant/planner';
import {userRequest} from '../assistant/api';
import {enableReminders,disableReminders} from '../notifications';

export default function AssistantScreen({t,user,tasks,blocks,sleep,tx,workouts,setTab}){
  const [messages,setMessages]=useState([{role:'assistant',text:'Hi! I can arrange your open tasks into a timetable, summarize your reports, and help set up reminders. Try “Plan my day” or “Analyze my week”.'}]);
  const [text,setText]=useState(''),[date,setDate]=useState(localDateKey),[start,setStart]=useState('09:00'),[end,setEnd]=useState('18:00'),[duration,setDuration]=useState(30);
  const [plan,setPlan]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const history=useRef([]),bottom=useRef(null),operation=useRef(false);
  const add=(role,text)=>setMessages(old=>[...old,{role,text}].slice(-100));
  useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest'});},[messages]);
  function draft(){
    try{const result=proposePlan({tasks,blocks,date,start,end,duration});setPlan(result);add('assistant',result.blocks.length?`I found room for ${result.blocks.length} tasks on ${date}. Review the plan below, then apply it. Existing blocks are kept; blocks without a duration reserve 30 minutes.`:'No tasks fit this window. Try another day, a longer window, or add an open task.');setError('');}catch(e){setError(e.message);}
  }
  async function submit(event){
    event?.preventDefault();const message=text.trim();if(!message||operation.current)return;
    setText('');add('user',message);setError('');
    const kind=intent(message);
    if(kind==='plan')draft();
    else if(kind==='report')add('assistant',reportSummary({tasks,sleep,tx,workouts}));
    else if(kind==='reminders')add('assistant','Enable reminders below to see alerts while Life OS is open. Background delivery when the app is closed is not enabled.');
    else {
      operation.current=true;setBusy(true);
      try{
        const result=await userRequest(user,'/api/bot-reply','POST',{text:message,history:history.current.slice(-12)});
        if(typeof result.reply!=='string'||!result.reply.trim())throw new Error('The assistant returned no reply. Please try again.');
        history.current=[...history.current,{role:'user',text:message},{role:'assistant',text:result.reply}].slice(-12);
        add('assistant',result.reply);
      }catch(e){setError(e.message);setText(message);}finally{operation.current=false;setBusy(false);}
    }
  }
  async function apply(){
    if(operation.current||!plan?.blocks.length)return;operation.current=true;setBusy(true);setError('');
    try{
      const proposal=plan.blocks.map(block=>{const when=parseLocalDate(block.date);const [h,m]=block.time.split(':').map(Number);when.setHours(h,m,0,0);return {...block,remindAt:when.getTime()};});
      await userRequest(user,'/api/apply-plan','POST',{blocks:proposal});
      add('assistant',`Your plan for ${plan.date} is saved to Timetable. Enable reminders and keep Life OS open for alerts.`);setPlan(null);
    }catch(e){setError(e.message);}finally{operation.current=false;setBusy(false);}
  }
  async function notifications(enable){setError('');setNotice('');try{if(enable){await enableReminders(user);setNotice('Reminders enabled while Life OS is open.');}else{await disableReminders(user);setNotice('Reminders disabled for this device.');}}catch(e){setError(e.message);}}
  return <Screen t={t} title="Life OS Assistant" right={<MessageCircle color={t.a1} />}>
    <div className="assistant-layout">
      <section aria-label="Assistant conversation">
        <Card t={t}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <strong>Gemini & planning assistant</strong>

          </div>
          <p style={{fontSize:13,color:t.muted}}>Planning and weekly summaries use your saved records locally. Other messages and recent AI replies go to Google Gemini. Reports are not shared automatically. Chat history lasts for this visit.</p>
          {busy&&<p role="status">Working…</p>}
          <div role="log" aria-label="Messages" aria-live="polite" className="assistant-messages">
            {messages.map((message,i)=><div key={i} className="assistant-message" style={{background:message.role==='user'?t.surface2:t.bg,marginLeft:message.role==='user'?20:0}}><strong style={{fontSize:12,color:t.a1}}>{message.role==='user'?'You':'Assistant'}</strong><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',margin:'6px 0 0'}}>{message.text}</p></div>)}
            <div ref={bottom}/>
          </div>
          <form onSubmit={submit} style={{display:'flex',gap:8,marginTop:12}}>
            <input aria-label="Message the assistant" maxLength={2000} disabled={busy} value={text} onChange={e=>setText(e.target.value)} placeholder="Plan my day…" style={{...inputStyle(t),flex:1}}/>
            <PrimaryButton t={t} type="submit" disabled={busy||!text.trim()} style={{width:'auto'}} aria-label="Send message"><Send size={18}/></PrimaryButton>
          </form>
        </Card>
        {error&&<p role="alert" style={{color:t.bad||t.text}}>{error}</p>}
        {notice&&<p role="status">{notice}</p>}
      </section>
      <aside aria-label="Planning controls">
        <Card t={t}>
          <h2 style={{fontSize:18,marginTop:0}}><CalendarDays size={18}/> Plan your time</h2>
          <Field t={t} label="Date"><input type="date" min={localDateKey()} max={shiftDate(localDateKey(),365)} value={date} onChange={e=>{setDate(e.target.value);setPlan(null);}} style={inputStyle(t)}/></Field>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <Field t={t} label="Start"><input type="time" value={start} onChange={e=>{setStart(e.target.value);setPlan(null);}} style={inputStyle(t)}/></Field>
            <Field t={t} label="Finish"><input type="time" value={end} onChange={e=>{setEnd(e.target.value);setPlan(null);}} style={inputStyle(t)}/></Field>
          </div>
          <Field t={t} label="Minutes per task"><select value={duration} onChange={e=>{setDuration(Number(e.target.value));setPlan(null);}} style={inputStyle(t)}>{[15,30,45,60,90].map(n=><option key={n}>{n}</option>)}</select></Field>
          <PrimaryButton t={t} disabled={busy} onClick={draft}>Suggest timetable</PrimaryButton>
          <p style={{fontSize:13,color:t.muted}}>High-priority tasks first, with five-minute breaks. Nothing changes until you apply the plan.</p>
          {plan&&<div>
            <ol style={{paddingLeft:20}}>{plan.blocks.map(b=><li key={b.taskId} style={{padding:'6px 0',overflowWrap:'anywhere'}}><strong>{b.time}</strong> · {b.label} · {b.durationMinutes} min</li>)}</ol>
            {!!plan.unplaced.length&&<p>{plan.unplaced.length} tasks did not fit. Choose another window to schedule them.</p>}
            {!!plan.blocks.length&&<PrimaryButton t={t} disabled={busy} onClick={apply}>{busy?'Saving…':'Apply plan to timetable'}</PrimaryButton>}
          </div>}
          <GhostButton t={t} onClick={()=>setTab('timetable')} style={{marginTop:8}}>Open timetable</GhostButton>
        </Card>
        <Card t={t}>
          <GhostButton t={t} onClick={()=>add('assistant',reportSummary({tasks,sleep,tx,workouts}))}><BarChart3 size={16}/> Analyze my week</GhostButton>
          <GhostButton t={t} style={{marginTop:8}} onClick={()=>notifications(true)}><Bell size={16}/> Enable reminders</GhostButton>
          <p style={{fontSize:13,color:t.muted}}>Keep Life OS open for reminders. Alerts may be delayed when your device sleeps.</p>
          <button className="link-button" onClick={()=>notifications(false)} style={{color:t.muted}}>Disable reminders on this device</button>
        </Card>
      </aside>
    </div>
  </Screen>;
}
