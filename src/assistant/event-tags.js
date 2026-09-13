export function normalizeTag(value='') {
 const tag=String(value).normalize('NFKC').trim().replace(/^#+/,'').replace(/\s+/g,'-').toLowerCase();
 if(tag.length>50||tag&&!/^[\p{L}\p{N}_-]+$/u.test(tag))throw new Error('Use up to 50 letters, numbers, spaces or dashes for an event tag.');
 return tag;
}
export function eventTotals(records) {
 const groups=new Map();
 for(const r of records){if(!r.eventTag)continue;const tag=normalizeTag(r.eventTag),g=groups.get(tag)||{tag,income:0,expenses:0,count:0};g.count++;g[r.type==='income'?'income':'expenses']+=Number(r.amount)||0;groups.set(tag,g);}
 return [...groups.values()].sort((a,b)=>b.expenses-a.expenses);
}
