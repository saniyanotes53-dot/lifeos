export function splitBill(total,people){
 const amount=Number(total),names=people.split(',').map(x=>x.trim()).filter(Boolean);
 if(!Number.isFinite(amount)||amount<=0||amount>100000000||names.length<2||names.length>20||new Set(names.map(n=>n.toLowerCase())).size!==names.length||names.some(n=>n.length>80))throw new Error('Enter a positive amount and 2–20 different names separated by commas.');
 const cents=Math.round(amount*100),base=Math.floor(cents/names.length),remainder=cents%names.length;
 return names.map((name,i)=>({name,amount:(base+(i<remainder?1:0))/100}));
}
