import React,{useRef,useState} from 'react';
import {Card,Modal,Field,PrimaryButton,GhostButton,IconBtn} from './primitives';
import {addItem,updateItem,deleteItem} from '../firestore';
import {inputStyle,todayStr} from '../theme';
import {normalizeTag} from '../assistant/event-tags';
import {transactionIssues,TRANSACTION_CATEGORIES} from '../utils/statement-import.js';

export function transactionError(error){
  if(error.code==='permission-denied')return 'Your account could not save this change. Sign in again and retry. If it continues, your database access rules need checking.';
  if(error.code==='unavailable')return 'You appear to be offline. Reconnect and try again.';
  if(error.code==='not-found')return 'This transaction no longer exists. Close this dialog and refresh the list.';
  return error.message || 'The change could not be saved. Please try again.';
}

export default function TransactionEditor({t,userId,transaction=null,wallets=[],onClose,onSaved}){
  const [form,setForm]=useState(()=>({date:transaction?.date||todayStr(),amount:transaction?.amount??'',type:transaction?.type||'expense',category:transaction?.category||'Other',note:transaction?.note||'',wallet:transaction?.wallet||'Unassigned',eventTag:transaction?.eventTag||''}));
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false);
  const edit=Boolean(transaction?.id),set=(name,value)=>setForm(previous=>({...previous,[name]:value}));
  const close=()=>{if(!lock.current)onClose();};
  async function save(event){
    event.preventDefault();if(lock.current)return;setError('');
    const issues=transactionIssues(form);if(issues.length){setError(issues.join('. ')+'.');return;}
    lock.current=true;setBusy(true);
    try{
      const data={...form,amount:Number(form.amount),note:form.note.trim(),eventTag:normalizeTag(form.eventTag)};
      if(edit)await updateItem(userId,'transactions',transaction.id,data);
      else await addItem(userId,'transactions',data);
      onSaved(edit?'Transaction updated.':'Transaction added.');onClose();
    }catch(e){setError(transactionError(e));}finally{lock.current=false;setBusy(false);}
  }
  const categories=[...new Set([...TRANSACTION_CATEGORIES,form.category])];
  const accounts=[...new Set(['Unassigned',...wallets.map(w=>w.name),form.wallet])];
  return <Modal title={edit?'Edit transaction':'Add transaction'} onClose={close}><Card t={t} style={{width:'100%',maxWidth:480}}>
    <div className="dialog-heading"><h2>{edit?'Edit transaction':'Add transaction'}</h2><IconBtn t={t} label="Close transaction" disabled={busy} onClick={close}>×</IconBtn></div>
    <form onSubmit={save}><fieldset disabled={busy} style={{border:0,padding:0,margin:0}}>
      <div className="form-pair"><Field t={t} label="Amount (₹)"><input aria-label="Transaction amount" type="number" min="0.01" step="0.01" required value={form.amount} onChange={e=>set('amount',e.target.value)} style={inputStyle(t)}/></Field>
      <Field t={t} label="Type"><select aria-label="Transaction type" value={form.type} onChange={e=>set('type',e.target.value)} style={inputStyle(t)}><option value="expense">Expense</option><option value="income">Income</option></select></Field></div>
      <div className="form-pair"><Field t={t} label="Date"><input aria-label="Transaction date" type="date" required value={form.date} onChange={e=>set('date',e.target.value)} style={inputStyle(t)}/></Field>
      <Field t={t} label="Category"><select aria-label="Transaction category" value={form.category} onChange={e=>set('category',e.target.value)} style={inputStyle(t)}>{categories.map(c=><option key={c}>{c}</option>)}</select></Field></div>
      <Field t={t} label="Description"><input aria-label="Transaction description" maxLength={500} value={form.note} onChange={e=>set('note',e.target.value)} style={inputStyle(t)} placeholder="e.g. Groceries"/></Field>
      <details><summary style={{cursor:'pointer',marginBottom:12}}>Account & event tag</summary><Field t={t} label="Wallet / account"><select aria-label="Wallet or account" value={form.wallet} onChange={e=>set('wallet',e.target.value)} style={inputStyle(t)}>{accounts.map(w=><option key={w}>{w}</option>)}</select></Field>
      <Field t={t} label="Event tag (optional)"><input aria-label="Transaction event tag" maxLength={60} value={form.eventTag} onChange={e=>set('eventTag',e.target.value)} style={inputStyle(t)} placeholder="#trip"/></Field></details>
      {transaction?.reference&&<p style={{color:t.muted,fontSize:12,overflowWrap:'anywhere'}}>Reference: {transaction.reference}</p>}
      {error&&<p role="alert" style={{color:t.warm}}>{error}</p>}
      <PrimaryButton t={t} type="submit" disabled={busy}>{busy?'Saving…':edit?'Save changes':'Add transaction'}</PrimaryButton>
    </fieldset></form>
  </Card></Modal>;
}

export function DeleteTransaction({t,userId,transaction,onClose,onDeleted}){
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false);
  const close=()=>{if(!lock.current)onClose();};
  async function remove(){
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{await deleteItem(userId,'transactions',transaction.id);onDeleted('Transaction deleted.');onClose();}
    catch(e){setError(transactionError(e));}finally{lock.current=false;setBusy(false);}
  }
  return <Modal title="Delete transaction" onClose={close}><Card t={t} style={{width:'100%',maxWidth:420}}><h2>Delete this transaction?</h2>
    <p style={{overflowWrap:'anywhere'}}>{transaction.note||transaction.category} · ₹{Number(transaction.amount).toLocaleString('en-IN')} · {transaction.date}</p>
    <p style={{color:t.muted}}>This removes the entry from your budget and reports.</p>{error&&<p role="alert">{error}</p>}
    <div className="form-pair"><GhostButton t={t} disabled={busy} onClick={close}>Cancel</GhostButton><PrimaryButton t={t} disabled={busy} onClick={remove}>{busy?'Deleting…':'Delete transaction'}</PrimaryButton></div>
  </Card></Modal>;
}
