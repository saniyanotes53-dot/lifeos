export function splitBill(total,people){
 const amount=Number(total),names=people.split(',').map(x=>x.trim()).filter(Boolean);
 if(!Number.isFinite(amount)||amount<=0||amount>100000000||names.length<2||names.length>20||new Set(names.map(n=>n.toLowerCase())).size!==names.length||names.some(n=>n.length>80))throw new Error('Enter a positive amount and 2–20 different names separated by commas.');
 const cents=Math.round(amount*100),base=Math.floor(cents/names.length),remainder=cents%names.length;
 return names.map((name,i)=>({name,amount:(base+(i<remainder?1:0))/100}));
}

export function billLedger(record){
 const shares=splitBill(record.total,record.people);
 const contributions=record.contributions||{[record.paidBy]:Number(record.total)};
 if(Object.keys(contributions).some(name=>!shares.some(s=>s.name===name)))throw new Error('Every payer must be a participant.');
 const rows=shares.map(s=>{
  const paid=Number(contributions[s.name]||0);
  if(!Number.isFinite(paid)||paid<0||paid>100000000)throw new Error('Enter a valid amount paid for each participant.');
  return {...s,paid:Math.round(paid*100)/100,net:Math.round(paid*100)-Math.round(s.amount*100)};
 });
 if(rows.reduce((sum,r)=>sum+Math.round(r.paid*100),0)!==Math.round(Number(record.total)*100))throw new Error('Amounts paid must add up exactly to the bill total.');
 const transfers=[];
 const debtors=rows.filter(r=>r.net<0).map(r=>({...r})),creditors=rows.filter(r=>r.net>0).map(r=>({...r}));
 for(const d of debtors)for(const c of creditors){const cents=Math.min(-d.net,c.net);if(cents>0){transfers.push({from:d.name,to:c.name,amount:cents/100});d.net+=cents;c.net-=cents;}}
 return {rows:rows.map(r=>({...r,net:r.net/100})),transfers:record.settled?[]:transfers};
}
export const validEmail=value=>typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
