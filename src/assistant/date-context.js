import {parseLocalDate,shiftDate} from '../utils/dates.js';
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export function dateContext(text,context){
 const today=context.localDate;if(!parseLocalDate(today))return {error:'Device date unavailable'};
 const calendar=Array.from({length:14},(_,i)=>{const date=shiftDate(today,i);return {date,weekday:days[parseLocalDate(date).getDay()]};});
 const value=text.toLowerCase();let date,time;
 if(/\bday after tomorrow\b/.test(value))date=shiftDate(today,2);
 else if(/\btomorrow\b/.test(value))date=shiftDate(today,1);
 else if(/\btoday|tonight\b/.test(value))date=today;
 else {
  const iso=value.match(/\b\d{4}-\d{2}-\d{2}\b/);if(iso&&parseLocalDate(iso[0]))date=iso[0];
  const indian=value.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);if(!date&&indian){const d=`${indian[3]}-${indian[2].padStart(2,'0')}-${indian[1].padStart(2,'0')}`;if(parseLocalDate(d))date=d;}
  if(!date)for(let i=0;i<days.length;i++)if(new RegExp('\\b(?:next\\s+)?'+days[i]+'\\b','i').test(value)){let delta=(i-parseLocalDate(today).getDay()+7)%7;if(!delta)delta=7;date=shiftDate(today,delta);break;}
 }
 const clock=value.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*([ap])\.?m\.?\b/);
 if(clock)time=String(Number(clock[1])%12+(clock[3]==='p'?12:0)).padStart(2,'0')+':'+(clock[2]||'00');
 else{const military=value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);if(military)time=military[1].padStart(2,'0')+':'+military[2];}
 const period=value.match(/\b(morning|afternoon|evening|night|tonight)\b/);
 if(!time&&period){const hour=value.match(/\bat\s+(1[0-2]|0?[1-9])\b/);if(hour){let h=Number(hour[1])%12;if(period[1]!=='morning')h+=12;time=String(h).padStart(2,'0')+':00';}}
 const duration=value.match(/\b(?:for\s+)?(\d+)\s*(minutes?|mins?|hours?|hrs?)\b/);
 const durationMinutes=duration?Number(duration[1])*(/^h/.test(duration[2])?60:1):30;
 return {calendar,interpretedRequest:{...(date?{date}:{}),...(time?{time}:{}),durationMinutes,defaultPriority:'Med',dateFormat:'DD/MM/YYYY',note:'Resolve relative dates against localDate. Next weekday means its next occurrence. Use 30 minutes when duration is omitted; show this in the proposal. Never ask for the current date or timezone when provided.'}};
}
