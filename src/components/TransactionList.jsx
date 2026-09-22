import React,{useMemo,useState} from 'react';
import {Pencil,Trash2} from 'lucide-react';
import {Card,Empty,IconBtn,GhostButton} from './primitives';
import {inputStyle} from '../theme';

export function TransactionRow({t,row,onEdit,onDelete}){
  return <Card t={t} style={{padding:14}}><div className="transaction-row">
    <div style={{minWidth:0,flex:1}}><div style={{fontWeight:600,overflowWrap:'anywhere'}}>{row.note||row.category||'Transaction'}</div><div style={{fontSize:12,color:t.muted,marginTop:4,overflowWrap:'anywhere'}}>{row.date} · {row.category||'Other'}{row.eventTag?` · #${row.eventTag}`:''}</div></div>
    <strong style={{color:row.type==='income'?t.good:t.text,whiteSpace:'nowrap'}}>{row.type==='income'?'+':'−'}₹{Number(row.amount||0).toLocaleString('en-IN',{maximumFractionDigits:2})}</strong>
    <div style={{display:'flex',gap:6}}><IconBtn t={t} label={`Edit ${row.note||row.category||'transaction'}`} onClick={()=>onEdit(row)}><Pencil size={16} color={t.a1}/></IconBtn><IconBtn t={t} label={`Delete ${row.note||row.category||'transaction'}`} onClick={()=>onDelete(row)}><Trash2 size={16} color={t.muted}/></IconBtn></div>
  </div></Card>;
}

export default function TransactionList({t,tx,onEdit,onDelete}){
  const [search,setSearch]=useState(''),[type,setType]=useState(''),[month,setMonth]=useState(''),[page,setPage]=useState(0);
  const rows=useMemo(()=>[...tx].filter(row=>(!type||row.type===type)&&(!month||row.date?.startsWith(month))&&`${row.note||''} ${row.category||''} ${row.reference||''} ${row.eventTag||''}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>(b.date||'').localeCompare(a.date||'')),[tx,search,type,month]);
  const maxPage=Math.max(0,Math.ceil(rows.length/30)-1),current=Math.min(page,maxPage);
  return <section aria-label="Transactions"><div className="transaction-filters">
    <input aria-label="Search transactions" placeholder="Search description or reference…" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} style={inputStyle(t)}/>
    <select aria-label="Filter transaction type" value={type} onChange={e=>{setType(e.target.value);setPage(0);}} style={inputStyle(t)}><option value="">All types</option><option value="expense">Expenses</option><option value="income">Income</option></select>
    <input aria-label="Filter transaction month" type="month" value={month} onChange={e=>{setMonth(e.target.value);setPage(0);}} style={inputStyle(t)}/>
  </div><p style={{color:t.muted,fontSize:13}}>{rows.length} transaction{rows.length===1?'':'s'}{month&&<button className="link-button" onClick={()=>{setMonth('');setPage(0);}}>Clear month</button>}</p>
    {!rows.length&&<Empty t={t} text={tx.length?'No transactions match these filters.':'Add a transaction or upload a statement to get started.'}/>}
    {rows.slice(current*30,current*30+30).map(row=><TransactionRow key={row.id} t={t} row={row} onEdit={onEdit} onDelete={onDelete}/>)}
    {maxPage>0&&<div className="form-pair"><GhostButton t={t} disabled={current===0} onClick={()=>setPage(current-1)}>Previous</GhostButton><span style={{alignSelf:'center',whiteSpace:'nowrap'}}>{current+1} / {maxPage+1}</span><GhostButton t={t} disabled={current===maxPage} onClick={()=>setPage(current+1)}>Next</GhostButton></div>}
  </section>;
}
