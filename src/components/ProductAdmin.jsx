import React,{useEffect,useState} from 'react';
import {useT,inputStyle} from '../theme';
import {PRODUCT_TABS,TASK_CATEGORIES,validateCatalog} from '../catalog/rules';
import {ProductPicture} from './ProductSuggestions';
import {Modal} from './primitives';
const endpoint='/api/auth/welcome?action=';
async function api(action,method='GET',body) {
 const res=await fetch(endpoint+action,{method,credentials:'same-origin',cache:'no-store',headers:method==='GET'?{}:{'Content-Type':'application/json','X-Lifeos-Admin':'1'},body:body?JSON.stringify(body):undefined});
 const data=await res.json();
 if(!res.ok)throw Object.assign(Error(data.error||'Request failed. Please try again.'),{status:res.status});
 return data;
}
export default function ProductAdmin() {
 const t=useT('dark','blue');
 const [signedIn,setSignedIn]=useState(false),[checking,setChecking]=useState(true),[password,setPassword]=useState('');
 const [items,setItems]=useState([]),[revision,setRevision]=useState(''),[dirty,setDirty]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [tab,setTab]=useState('All'),[editing,setEditing]=useState(null),[deleting,setDeleting]=useState(null);
 const load=async()=>{
  const data=await api('admin-products');setItems(data.products);setRevision(data.revision);setDirty(false);setSignedIn(true);
 };
 useEffect(()=>{load().catch(e=>{if(e.status!==401)setError(e.message);}).finally(()=>setChecking(false));},[]);
 useEffect(()=>{if(!dirty)return;const warn=e=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 const run=async(fn)=>{setBusy(true);setError('');setMessage('');try{await fn();}catch(e){setError(e.message);if(e.status===401)setSignedIn(false);}finally{setBusy(false);}};
 const button={padding:'11px 16px',border:`1px solid ${t.line}`,borderRadius:12,background:t.surface2,color:t.text,cursor:'pointer',font:'inherit'};
 const panel={background:t.surface,padding:24,borderRadius:24,border:`1px solid ${t.line}`};
 const visible=items.filter(p=>tab==='All'||p.tabs.includes(tab));
 const login=async e=>{e.preventDefault();await run(async()=>{try{await api('admin-login','POST',{password});await load();}finally{setPassword('');}});};
 const applyEdit=e=>{
  e.preventDefault();try{
   const product={...editing,categories:editing.categoryText.split(',').map(s=>s.trim()).filter(Boolean)};
   const next=validateCatalog(items.some(p=>p.id===product.id)?items.map(p=>p.id===product.id?product:p):[...items,product]);
   setItems(next);setDirty(true);setEditing(null);setError('');setMessage('Draft updated. Publish changes to make it live.');
  }catch(e){setError(e.message);}
 };
 return <main style={{minHeight:'100dvh',background:t.canvas,color:t.text,fontFamily:'system-ui',padding:'clamp(16px,4vw,48px)'}}>
  <div style={{maxWidth:1080,margin:'auto'}}>
   <header style={{display:'flex',gap:16,justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',marginBottom:24}}><div><small>LIFE OS / ADMIN</small><h1 style={{margin:'8px 0'}}>Related Products</h1><p style={{color:t.muted}}>Manage product suggestions across Tasks, Focus, Health and Budget.</p></div><a href="/" style={{color:t.text}}>Return to LIFE OS ↗</a></header>
   {checking?<p role="status">Checking admin session…</p>:!signedIn?<form onSubmit={login} style={{...panel,maxWidth:420}}><h2>Admin sign in</h2><label>Password<input type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={e=>setPassword(e.target.value)} style={inputStyle(t)}/></label><button style={{...button,marginTop:16}} disabled={busy}>{busy?'Signing in…':'Sign in'}</button><p style={{fontSize:12,color:t.muted}}>This is separate from your LIFE OS user account.</p></form>:<>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:18}}>
     <button style={button} disabled={busy} onClick={()=>{setError('');setEditing({id:crypto.randomUUID(),name:'',url:'',imageUrl:'',icon:'🛍️',tabs:[tab==='All'?'Tasks':tab],enabled:true,categoryText:tab==='All'||tab==='Tasks'?'Study':'All'});}}>Add product</button>
     <button style={{...button,background:t.a1,color:t.onAccent}} disabled={!dirty||busy} onClick={()=>run(async()=>{const data=await api('admin-products','PUT',{products:items,revision});setItems(data.products);setRevision(data.revision);setDirty(false);setMessage('Published. Product suggestions update within a minute or when users reopen the app.');})}>{busy?'Working…':dirty?'Publish changes':'All changes saved'}</button>
     <button style={button} disabled={busy} onClick={()=>{if(!dirty||window.confirm('Discard your unpublished changes and reload?'))run(load);}}>Reload catalog</button>
     <button style={button} disabled={busy} onClick={()=>{if(!dirty||window.confirm('Sign out and discard unpublished changes?'))run(async()=>{await api('admin-logout','POST',{});setSignedIn(false);setItems([]);setDirty(false);});}}>Sign out</button>
    </div>
    <nav aria-label="Product tab filters" style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:20}}>{['All',...PRODUCT_TABS].map(name=><button key={name} aria-pressed={tab===name} style={{...button,background:tab===name?t.a1:t.surface2,color:tab===name?t.onAccent:t.text}} onClick={()=>setTab(name)}>{name} ({items.filter(p=>name==='All'||p.tabs.includes(name)).length})</button>)}</nav>
    <p style={{fontSize:13,color:t.muted}}>Use “All” as a product category to match any task. Other categories match the task category. Hidden products are excluded from suggestions and AI recommendations.</p>
    <div style={{display:'grid',gap:12}}>{visible.map(p=><article key={p.id} style={{...panel,display:'flex',gap:18,alignItems:'center',flexWrap:'wrap',padding:18}}><div style={{width:65}}><ProductPicture key={p.imageUrl} product={p}/></div><div style={{flex:'1 1 220px',minWidth:0}}><strong>{p.name}</strong><p style={{margin:'7px 0',fontSize:13,color:t.muted}}>{p.tabs.join(' · ')} / {p.categories.join(', ')} · {p.enabled?'Visible':'Hidden'}</p><a href={p.url} target="_blank" rel="noopener noreferrer" style={{color:t.a1,overflowWrap:'anywhere',fontSize:12}}>{p.url}</a></div><button style={button} disabled={busy} onClick={()=>{setError('');setEditing({...p,categoryText:p.categories.join(', ')});}}>Edit</button><button style={button} disabled={busy} onClick={()=>{setItems(items.map(x=>x.id===p.id?{...x,enabled:!x.enabled}:x));setDirty(true);}}>{p.enabled?'Hide':'Show'}</button><button style={button} disabled={busy} onClick={()=>setDeleting(p)}>Remove</button></article>)}</div>
    {!visible.length&&<p>No products in this tab yet. Add a product and assign it here.</p>}
   </>}
   {error&&<p role="alert" style={{color:'#ffb4b4'}}>{error}</p>}{message&&<p role="status">{message}</p>}
  </div>
  {editing&&<Modal title="Edit product" onClose={()=>setEditing(null)}><form onSubmit={applyEdit} style={{...panel,width:'min(540px,100%)',maxHeight:'85dvh',overflowY:'auto',color:t.text}}><h2>Product details</h2>
   {[['name','Product name'],['url','Product link (HTTPS)'],['imageUrl','Product image URL (optional)'],['categoryText','Categories (comma separated)']].map(([key,label])=><label key={key} style={{display:'block',marginBottom:14}}>{label}<input style={inputStyle(t)} value={editing[key]} required={key!=='imageUrl'} type={key==='url'||key==='imageUrl'?'url':'text'} maxLength={key==='url'||key==='imageUrl'?2000:key==='name'?100:800} list={key==='categoryText'?'task-categories':undefined} onChange={e=>setEditing({...editing,[key]:e.target.value})}/></label>)}
   <datalist id="task-categories">{TASK_CATEGORIES.map(c=><option key={c} value={c}/>)}</datalist>
   <p style={{fontSize:12,color:t.muted}}>Use a product photo you are permitted to display. Leave blank for a category icon.</p>
   <fieldset style={{border:0,padding:0,margin:'16px 0'}}><legend>Show in tabs</legend>{PRODUCT_TABS.map(name=><label key={name} style={{display:'inline-flex',gap:6,margin:8}}><input type="checkbox" checked={editing.tabs.includes(name)} onChange={e=>setEditing({...editing,tabs:e.target.checked?[...editing.tabs,name]:editing.tabs.filter(x=>x!==name)})}/>{name}</label>)}</fieldset>
   <label><input type="checkbox" checked={editing.enabled} onChange={e=>setEditing({...editing,enabled:e.target.checked})}/>Visible to users</label>
   {error&&<p role="alert" style={{color:'#ffb4b4'}}>{error}</p>}<div style={{display:'flex',gap:10,marginTop:20}}><button style={button}>Apply to draft</button><button type="button" style={button} onClick={()=>setEditing(null)}>Cancel</button></div>
  </form></Modal>}
  {deleting&&<Modal title="Remove product" onClose={()=>setDeleting(null)}><div style={{...panel,color:t.text,maxWidth:420}}><h2>Remove {deleting.name}?</h2><p>It will stop appearing after you publish changes.</p><button style={button} onClick={()=>{setItems(items.filter(p=>p.id!==deleting.id));setDirty(true);setDeleting(null);}}>Remove from draft</button> <button style={button} onClick={()=>setDeleting(null)}>Cancel</button></div></Modal>}
 </main>;
}
