import React,{useRef,useState} from 'react';
import {Upload} from 'lucide-react';
import {Card,Modal,IconBtn,PrimaryButton,GhostButton,Field} from './primitives';
import {inputStyle} from '../theme';
import {parseStatementCsv,prepareImportRows,transactionIssues} from '../utils/statement-import.js';
import {scanStatementPage} from '../assistant/api';
import {importTransactions} from '../firestore';
import {transactionError} from './TransactionEditor';

export default function StatementImport({t,user,tx,wallets=[],onClose,onImported}){
  const [file,setFile]=useState(null),[text,setText]=useState(''),[order,setOrder]=useState('DMY');
  const [rows,setRows]=useState([]),[warnings,setWarnings]=useState([]),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[page,setPage]=useState(0),[wallet,setWallet]=useState('');
  const lock=useRef(false);
  const close=()=>{if(!lock.current)onClose();};
  async function scan(){
    if(lock.current)return;lock.current=true;setBusy(true);setError('');setStatus('Reading statement…');
    try{
      let result;
      if(file){
        if(file.size>10*1024*1024)throw new Error('Choose a file smaller than 10 MB.');
        if(/\.csv$/i.test(file.name))result=parseStatementCsv(await file.text(),order);
        else if(/\.pdf$/i.test(file.name))result=await (await import('../utils/pdf-statement.js')).readPdfStatement(file,user,setStatus);
        else throw new Error('Choose a .csv or .pdf statement.');
      }else{
        if(!text.trim())throw new Error('Choose a CSV or PDF file first.');
        result=await scanStatementPage(user,{text});
        if(!result.rows?.length)throw new Error('No completed transactions found. Include dates, amounts and payment direction.');
      }
      setRows(prepareImportRows(result.rows,tx));setWarnings(result.warnings||[]);setPage(0);setStatus('Review the detected transactions before saving.');
    }catch(e){setError(e.message);setStatus('');}finally{lock.current=false;setBusy(false);}
  }
  const selected=rows.filter(row=>row.selected&&!row.alreadyImported),invalid=selected.filter(row=>transactionIssues(row).length);
  const duplicates=rows.filter(row=>row.duplicate).length;
  function change(index,field,value){setRows(old=>old.map((row,i)=>i===index?{...row,[field]:value}:row));}
  async function save(){
    if(lock.current)return;lock.current=true;setBusy(true);setError('');setStatus('Saving selected transactions…');
    try{
      const result=await importTransactions(user.uid,selected.map(row=>({...row,wallet:wallet||row.wallet})),progress=>setStatus(`Saved ${progress.saved} · checked ${progress.processed} of ${progress.total}`));
      onImported(`${result.saved} transaction${result.saved===1?'':'s'} imported.${result.skipped?` ${result.skipped} already saved.`:''}`);onClose();
    }catch(e){setError(transactionError(e)+' You can retry safely; completed batches will not be duplicated.');}
    finally{lock.current=false;setBusy(false);}
  }
  return <Modal title="Import statement" onClose={close}><Card t={t} style={{width:'100%',maxWidth:920}}>
    <div className="dialog-heading"><div><h2>Import statement</h2><p style={{color:t.muted,margin:'4px 0'}}>Bank and Google Pay · CSV or PDF</p></div><IconBtn t={t} label="Close import" disabled={busy} onClick={close}>×</IconBtn></div>
    {!rows.length?<>
      <div style={{border:`1px dashed ${t.a1}`,borderRadius:14,padding:24,textAlign:'center',background:t.surface2}}>
        <Upload color={t.a1} size={28}/><p>{file?file.name:'Choose a downloaded statement'}</p>
        <input aria-label="Statement file" type="file" accept=".csv,.pdf,text/csv,application/pdf" disabled={busy} onChange={e=>{setFile(e.target.files?.[0]||null);setError('');}} style={{display:'block',maxWidth:'100%',margin:'12px auto'}}/>
        <small style={{color:t.muted}}>Up to 10 MB · PDFs up to 30 pages</small>
      </div>
      {file&&/\.csv$/i.test(file.name)&&<Field t={t} label="CSV date format"><select aria-label="CSV date format" disabled={busy} value={order} onChange={e=>setOrder(e.target.value)} style={inputStyle(t)}><option value="DMY">Day / Month / Year (India)</option><option value="MDY">Month / Day / Year</option></select></Field>}
      <p style={{fontSize:13,color:t.muted,lineHeight:1.6}}>CSV files are read on your device. PDF pages and pasted text are sent to Google Gemini for scanning. Nothing is saved to your budget until you review and import it.</p>
      <details><summary style={{cursor:'pointer',marginBottom:12}}>Or paste statement text</summary><textarea aria-label="Statement text" disabled={busy||Boolean(file)} rows={5} maxLength={40000} value={text} onChange={e=>setText(e.target.value)} style={inputStyle(t)} placeholder="Paste transaction dates, descriptions, amounts and debit / credit labels…"/></details>
      <PrimaryButton t={t} disabled={busy||(!file&&!text.trim())} onClick={scan}>{busy?'Scanning…':'Scan statement'}</PrimaryButton>
    </>:<>
      <p style={{color:t.muted,fontSize:13,lineHeight:1.6}}>{rows.length} detected · {duplicates} possible duplicates unchecked. Check every date, amount and income/expense direction. Repeated rows with the same reference, or the same date, amount and description, are treated as possible duplicates. If two identical payments are genuine, select both. Previously imported references cannot be added twice.</p>
      {warnings.length>0&&<details><summary>{warnings.length} statement warning{warnings.length===1?'':'s'}</summary><ul>{warnings.slice(0,100).map((warning,index)=><li key={index}>{warning}</li>)}</ul></details>}
      <div className="form-pair" style={{alignItems:'center',margin:'12px 0'}}><label><input type="checkbox" disabled={busy} checked={Boolean(rows.filter(r=>!r.duplicate).length)&&rows.filter(r=>!r.duplicate).every(r=>r.selected)} onChange={e=>setRows(old=>old.map(row=>({...row,selected:e.target.checked&&!row.duplicate})))}/> Select all</label><select aria-label="Import wallet" disabled={busy} value={wallet} onChange={e=>setWallet(e.target.value)} style={inputStyle(t)}><option value="">Keep detected accounts</option><option>Unassigned</option>{wallets.map(w=><option key={w.id}>{w.name}</option>)}</select></div>
      <div style={{maxHeight:'42vh',overflowY:'auto'}}>{rows.slice(page*20,page*20+20).map((row,offset)=>{
        const index=page*20+offset,issues=transactionIssues(row);
        return <div key={index} style={{padding:12,marginBottom:8,border:`1px solid ${issues.length?t.warm:t.line}`,borderRadius:12,opacity:row.duplicate?0.6:1}}>
          <label style={{display:'block',marginBottom:8}}><input type="checkbox" aria-label={`Import row ${index+1}`} disabled={busy||row.alreadyImported} checked={row.selected} onChange={e=>change(index,'selected',e.target.checked)}/> Row {index+1}{row.sourcePage?` · page ${row.sourcePage}`:''}{row.sourceRow?` · CSV line ${row.sourceRow}`:''}{row.alreadyImported?' · Already imported':row.duplicate?' · Possible duplicate':''}</label>
          <fieldset disabled={busy||row.alreadyImported} style={{border:0,padding:0,margin:0}}><div className="import-row-fields">
            <input aria-label={`Date row ${index+1}`} type="date" value={row.date} onChange={e=>change(index,'date',e.target.value)} style={inputStyle(t)}/>
            <input aria-label={`Amount row ${index+1}`} type="number" min="0.01" step="0.01" value={row.amount} onChange={e=>change(index,'amount',e.target.value)} style={inputStyle(t)} placeholder="Amount ₹"/>
            <select aria-label={`Type row ${index+1}`} value={row.type} onChange={e=>change(index,'type',e.target.value)} style={inputStyle(t)}><option value="">Choose type</option><option value="expense">Expense</option><option value="income">Income</option></select>
          </div><div className="form-pair" style={{marginTop:8}}><input aria-label={`Description row ${index+1}`} maxLength={500} value={row.note} onChange={e=>change(index,'note',e.target.value)} style={inputStyle(t)}/><input aria-label={`Category row ${index+1}`} maxLength={80} value={row.category} onChange={e=>change(index,'category',e.target.value)} style={inputStyle(t)}/></div></fieldset>
          {row.reference&&<small style={{color:t.muted,overflowWrap:'anywhere'}}>Ref: {row.reference}</small>}{issues.length>0&&<p style={{color:t.warm,fontSize:12,marginBottom:0}}>{issues.join(' · ')}</p>}
        </div>;
      })}</div>
      {rows.length>20&&<div className="form-pair" style={{alignItems:'center',margin:'12px 0'}}><GhostButton t={t} disabled={busy||page===0} onClick={()=>setPage(page-1)}>Previous</GhostButton><span style={{whiteSpace:'nowrap'}}>{page+1} / {Math.ceil(rows.length/20)}</span><GhostButton t={t} disabled={busy||(page+1)*20>=rows.length} onClick={()=>setPage(page+1)}>Next</GhostButton></div>}
      <p>{selected.length} selected · Income ₹{selected.filter(r=>r.type==='income').reduce((sum,r)=>sum+(Number(r.amount)||0),0).toLocaleString('en-IN')} · Expenses ₹{selected.filter(r=>r.type==='expense').reduce((sum,r)=>sum+(Number(r.amount)||0),0).toLocaleString('en-IN')}</p>
      {invalid.length>0&&<p role="alert">Fix {invalid.length} selected row{invalid.length===1?'':'s'} or uncheck them before importing.</p>}
      <div className="form-pair"><GhostButton t={t} disabled={busy} onClick={()=>{setRows([]);setStatus('');setError('');}}>Choose another statement</GhostButton><PrimaryButton t={t} disabled={busy||!selected.length||Boolean(invalid.length)} onClick={save}>{busy?'Saving…':`Import ${selected.length} transactions`}</PrimaryButton></div>
    </>}
    {status&&<p role="status" style={{fontSize:13,color:t.muted}}>{status}</p>}{error&&<p role="alert" style={{color:t.warm}}>{error}</p>}
  </Card></Modal>;
}
