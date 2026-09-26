import React,{useState} from 'react';
import {ShoppingBag} from 'lucide-react';
import {affiliateDisclosure} from '../catalog/products';
import {useProductCatalog} from '../catalog/ProductCatalog';
import {matchingProducts} from '../catalog/rules';
import {Modal,GhostButton} from './primitives';
export function ProductPicture({product}) {
 const [failed,setFailed]=useState(false);
 return product.imageUrl&&!failed?<img src={product.imageUrl} alt={product.name} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)} style={{width:'100%',height:110,objectFit:'contain',borderRadius:10}}/>:<span aria-hidden="true" style={{fontSize:34}}>{product.icon||'🛍️'}</span>;
}
export default function ProductSuggestions({t,section='Study',budget=false,category='',contextTitle='',tab}) {
 const [open,setOpen]=useState(false);
 const {products}=useProductCatalog();
 const target=tab||(budget?'Budget':section==='Study'?'Tasks':section);
 const matches=matchingProducts(products,target,category);
 if(!matches.length)return null;
 return <div className="product-suggestions" style={{margin:'12px 0',color:t.text}}>
  <GhostButton t={t} style={{width:'auto',display:'inline-flex',alignItems:'center',gap:8}} aria-haspopup="dialog" onClick={()=>setOpen(true)}><ShoppingBag size={16}/>Related Products</GhostButton>
  {open&&<Modal title="Related Products" onClose={()=>setOpen(false)}><section style={{background:t.surface,color:t.text,padding:24,borderRadius:24,width:'min(650px,100%)',maxHeight:'85dvh',overflowY:'auto',boxShadow:t.glassShadow,border:`1px solid ${t.line}`}}>
   <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><h2 style={{margin:0}}>Related Products</h2><GhostButton t={t} style={{width:'auto'}} onClick={()=>setOpen(false)}>Close</GhostButton></header>
   <p style={{color:t.muted}}>{contextTitle?`For ${contextTitle}`:category?`For your ${category.toLowerCase()} tasks`:`Ideas for ${target.toLowerCase()}`}. Optional tools, only if you need them.</p>
   <p style={{fontSize:12,color:t.muted}}>{affiliateDisclosure}</p>
   {target==='Budget'&&<p>Check your available spending money after bills, repayments and savings. Confirm the current price before deciding.</p>}
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(180px,100%),1fr))',gap:12}}>{matches.map(p=><a key={p.id} href={p.url} target="_blank" rel="sponsored noopener noreferrer" style={{color:t.text,textDecoration:'none',padding:16,borderRadius:16,background:t.surface2,display:'grid',gap:10,alignContent:'start'}}><ProductPicture key={p.imageUrl} product={p}/><strong>{p.name}</strong><small>View product & current price ↗</small></a>)}</div>
   <small style={{display:'block',marginTop:16,color:t.muted}}>Icons are category illustrations when a product photo is unavailable. Prices are not verified by LIFE OS.</small>
  </section></Modal>}
 </div>;
}
