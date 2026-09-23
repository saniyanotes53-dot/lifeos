import React from 'react';
import {ClockIcon as Clock, WalletIcon as Wallet, ListChecksIcon as ListChecks, ArrowRightIcon as ArrowRight, ChatCircleDotsIcon as MessageCircle} from "@phosphor-icons/react";
import {todayStr,PRI_KEY} from '../theme';
import {Card,SectionLabel,Empty,GhostButton} from './primitives';

export default function Dashboard({t,tasks=[],tx=[],blocks=[],name,setTab}){
  const today=todayStr(),time=new Date().toTimeString().slice(0,5);
  const open=tasks.filter(task=>!task.done);
  const priority={High:0,Med:1,Low:2};
  const top=[...open].sort((a,b)=>(priority[a.priority]??3)-(priority[b.priority]??3)).slice(0,4);
  const upcoming=blocks.filter(block=>!block.done&&block.date===today&&block.time>=time).sort((a,b)=>a.time.localeCompare(b.time)).slice(0,3);
  const month=tx.filter(row=>row.date?.startsWith(today.slice(0,7))&&row.date<=today);
  const spent=month.filter(row=>row.type==='expense').reduce((sum,row)=>sum+(Number(row.amount)||0),0);
  const income=month.filter(row=>row.type==='income').reduce((sum,row)=>sum+(Number(row.amount)||0),0);
  const hour=new Date().getHours(),greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
  return <div className="dashboard-content" style={{maxWidth:980,margin:'0 auto',padding:'28px 24px'}}>
    <div className="dashboard-welcome"><span className="glass-eyebrow">LIFE, IN BALANCE</span><p style={{fontSize:13,color:t.muted,margin:'0 0 8px'}}>{new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})}</p>
    <h1 style={{fontFamily:"'Iowan Old Style', Georgia, serif",fontSize:30,fontWeight:600,margin:'0 0 8px'}}>{greeting}, {name}</h1>
    <p style={{color:t.muted,margin:'0 0 28px'}}>A little clarity for the day ahead.</p></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,280px),1fr))',gap:18}}>
      <section><SectionLabel t={t} text="Your priorities" action="All tasks" onAction={()=>setTab('tasks')}/><Card t={t} style={{padding:20}}>
        {!top.length&&<Empty t={t} text="You're all caught up. Add a task when you're ready."/>}
        {top.map((task,index)=><div key={task.id} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 0',borderBottom:index<top.length-1?`1px solid ${t.line}`:'none'}}><span style={{width:7,height:7,borderRadius:'50%',background:t[PRI_KEY[task.priority]]||t.a1,flexShrink:0}}/><span style={{flex:1,overflowWrap:'anywhere'}}>{task.title}</span><small style={{color:t.muted}}>{task.priority}</small></div>)}
        <GhostButton t={t} onClick={()=>setTab('tasks')} style={{marginTop:14}}><ListChecks size={15} style={{verticalAlign:'middle',marginRight:8}}/>{open.length?`Manage ${open.length} open tasks`:'Add your first task'}</GhostButton>
      </Card></section>
      <section><SectionLabel t={t} text="Coming up today" action="Timetable" onAction={()=>setTab('timetable')}/><Card t={t} style={{padding:20}}>
        {!upcoming.length&&<Empty t={t} text="No more scheduled blocks today."/>}
        {upcoming.map(block=><div key={block.id} style={{display:'flex',gap:14,padding:'14px 0'}}><span style={{fontSize:13,color:t.a1,fontWeight:700}}>{block.time}</span><div style={{overflowWrap:'anywhere'}}>{block.label}<div style={{color:t.muted,fontSize:12,marginTop:4}}>{block.durationMinutes||30} minutes</div></div></div>)}
        <GhostButton t={t} onClick={()=>setTab('timetable')} style={{marginTop:14}}><Clock size={15} style={{verticalAlign:'middle',marginRight:8}}/>Plan your time</GhostButton>
      </Card></section>
    </div>
    <SectionLabel t={t} text="Money this month" action="Open budget" onAction={()=>setTab('budget')}/>
    <Card t={t} variant="glass" onClick={()=>setTab('budget')} style={{padding:22,display:'flex',alignItems:'center',gap:20,flexWrap:'wrap'}}><Wallet color={t.a1} size={26}/><div style={{flex:1}}><small style={{color:t.muted}}>Expenses</small><div style={{fontSize:24,fontWeight:700,marginTop:5}}>₹{spent.toLocaleString('en-IN')}</div></div><div style={{flex:1}}><small style={{color:t.muted}}>Income</small><div style={{fontSize:24,fontWeight:700,color:t.good,marginTop:5}}>₹{income.toLocaleString('en-IN')}</div></div><ArrowRight color={t.muted} size={18}/></Card>
    <Card t={t} onClick={()=>setTab('assistant')} style={{display:'flex',alignItems:'center',gap:16,padding:20,marginTop:18,background:t.surface2}}><MessageCircle color={t.a1}/><div style={{flex:1}}><strong>Need a hand?</strong><p style={{color:t.muted,fontSize:13,margin:'5px 0 0'}}>Plan your day, add a task, or ask about your spending.</p></div><ArrowRight color={t.muted} size={18}/></Card>
  </div>;
}
