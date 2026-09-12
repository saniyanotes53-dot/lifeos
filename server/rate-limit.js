// Best-effort per-instance throttle, not a distributed usage or billing cap.
export function createLimiter(limit=10,windowMs=60000){
  const entries=new Map();
  return (uid,now=Date.now())=>{
    for(const [key,value] of entries)if(value.until<=now)entries.delete(key);
    const entry=entries.get(uid)||{count:0,until:now+windowMs};
    if(entry.count>=limit||(!entries.has(uid)&&entries.size>=10000))throw Object.assign(new Error('Please wait a minute before sending more messages.'),{status:429});
    entry.count++;entries.set(uid,entry);
  };
}
