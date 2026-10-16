import {parseLocalDate} from './dates.js';
const minute = time => /^([01]\d|2[0-3]):[0-5]\d$/.test(time||'') ? Number(time.slice(0,2))*60+Number(time.slice(3)) : NaN;
export function planDayCopy(blocks, source, target) {
 if(!parseLocalDate(target)||source===target)throw Error('Choose a different destination date.');
 const items=blocks.filter(b=>b.date===source).map(b=>({id:`copy_${target}_${b.id}`,date:target,time:b.time,label:b.label||b.title||'Time block',durationMinutes:Number(b.durationMinutes)||30,done:false,taskId:null,sourceBlockId:b.id}));
 if(!items.length)throw Error('This day has no time blocks to copy.');
 if(items.length>100)throw Error('Copy up to 100 blocks at a time.');
 const existing=blocks.filter(b=>b.date===target);
 const all=[...existing,...items];
 for(let i=existing.length;i<all.length;i++){
  const a=all[i],start=minute(a.time),end=start+a.durationMinutes;
  if(!Number.isFinite(start)||a.durationMinutes<=0||end>1440)throw Error('A source block has an invalid time or duration.');
  for(let j=0;j<i;j++){const b=all[j],other=minute(b.time);if(start<other+(Number(b.durationMinutes)||30)&&end>other)throw Error(`Time conflict on ${target}: ${a.time} ${a.label}. Choose another date or adjust the destination first.`);}
 }
 return items;
}
