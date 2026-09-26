import React,{useState} from 'react';
import {products,affiliateDisclosure} from '../catalog/products';
import {Modal,GhostButton} from './primitives';
export default function ProductSuggestions({t,section='Study',budget=false}){
 const [open,setOpen]=useState(false);
 return <aside className="product-suggestions" style={{margin:'22px 0',padding:16,borderRadius:16,background:t.surface2,color:t.text}}>
  <strong>{budget?'Optional study & focus purchases':`${section} essentials`}</strong>
  <p style={{fontSize:12,color:t.muted}}>{budget?'Only consider non-essential purchases after bills, repayments and savings. Recorded income minus expenses is not your spendable balance.':'Useful accessories, if you need them. No purchase is required to use LIFE OS.'}</p>
  <details><summary style={{cursor:'pointer'}}>Browse optional products · affiliate links</summary>
   <p style={{fontSize:12,color:t.muted}}>{affiliateDisclosure} Category icons are illustrations, not product photos. The suggested ₹1,500 headphone/earphone limit is a shopping target, not a verified price.</p>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10}}>{products.filter(p=>budget||p.section===section).map(p=><a key={p.url} href={p.url} target="_blank" rel="sponsored noopener noreferrer" style={{color:t.text,textDecoration:'none',padding:14,borderRadius:14,background:t.surface,display:'grid',gap:8}}><span aria-hidden="true" style={{fontSize:28}}>{p.icon}</span><strong>{p.name}</strong><small>Check price on Amazon ↗</small></a>)}</div>
  </details>
  <GhostButton t={t} style={{marginTop:12,width:'auto'}} onClick={()=>setOpen(true)}>Before you buy</GhostButton>
  {open&&<Modal title="A thoughtful purchase" onClose={()=>setOpen(false)}><div style={{background:t.surface,color:t.text,padding:24,borderRadius:22,maxWidth:420}}><h2>A thoughtful purchase</h2><p>Does it solve a need? Can you cover it without borrowing or delaying essentials? Compare the current price and return policy before buying.</p><p style={{fontSize:12}}>{affiliateDisclosure}</p><GhostButton t={t} onClick={()=>setOpen(false)}>Continue without shopping</GhostButton></div></Modal>}
 </aside>;
}
