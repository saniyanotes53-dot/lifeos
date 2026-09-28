const sessions=new Map(),listeners=new Map();
const key=uid=>'lifeos-assistant-v2:'+uid;
export function session(uid){
 if(!sessions.has(uid)){
  try{localStorage.removeItem(key(uid));}catch{}
  sessions.set(uid,{messages:[],history:[],memory:'',planning:true,budget:false,health:false,proposal:null,busy:false,error:'',status:'',partial:''});
 }
 return sessions.get(uid);
}
export function updateSession(uid,patch){
 const next={...session(uid),...patch};sessions.set(uid,next);

 for(const fn of listeners.get(uid)||[])fn();
}
export function subscribeSession(uid,fn){if(!listeners.has(uid))listeners.set(uid,new Set());listeners.get(uid).add(fn);return()=>listeners.get(uid).delete(fn);}
export function clearSession(uid){sessions.delete(uid);try{localStorage.removeItem(key(uid));}catch{};for(const fn of listeners.get(uid)||[])fn();}
