import React,{createContext,useContext,useEffect,useState} from 'react';
const CatalogContext = createContext({products:[],loaded:false,error:''});
export function ProductCatalogProvider({children}) {
 const [catalog,setCatalog] = useState({products:[],loaded:false,error:''});
 useEffect(()=>{
  let disposed=false,controller;
  const load=async()=>{
   controller?.abort();controller=new AbortController();
   try {
    const res=await fetch('/api/auth/welcome?action=products',{signal:controller.signal,cache:'no-store'});
    if(!res.ok)throw Error();
    const data=await res.json();
    if(!Array.isArray(data.products))throw Error();
    if(!disposed)setCatalog({products:data.products,loaded:true,error:''});
   } catch(e){if(!disposed&&e.name!=='AbortError')setCatalog({products:[],loaded:true,error:'Related products are temporarily unavailable.'});}
  };
  load();
  const onFocus=()=>{if(document.visibilityState==='visible')load();};
  const timer=setInterval(onFocus,60000);
  document.addEventListener('visibilitychange',onFocus);
  return()=>{disposed=true;controller?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',onFocus);};
 },[]);
 return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}
export const useProductCatalog=()=>useContext(CatalogContext);
