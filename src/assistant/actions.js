import {parseLocalDate} from '../utils/dates.js';
export const actionTypes=['create_task','update_task','schedule_task','move_block','set_budget'];
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const short=value=>typeof value==='string'&&value.trim().length>0&&value.length<=200;
export function validateActions(actions){
  if(!Array.isArray(actions)||actions.length>20)throw new Error('A proposal can contain at most 20 changes.');
  const refs=new Set();
  return actions.map(a=>{
    if(!a||!actionTypes.includes(a.type)||!id(a.ref)||refs.has(a.ref))throw new Error('The proposal contains an invalid action.');
    refs.add(a.ref);
    const result={type:a.type,ref:a.ref};
    if(['create_task','update_task'].includes(a.type)){
      if(!short(a.title)||!['High','Med','Low'].includes(a.priority)||typeof a.done!=='boolean')throw new Error('A task needs a title, priority and completion state.');
      Object.assign(result,{title:a.title.trim(),priority:a.priority,done:a.done});
      if(a.type==='create_task'&&a.done)throw new Error('New tasks must start as open.');
    }
    if(['update_task','move_block'].includes(a.type)){
      if(!id(a.id))throw new Error('The record to update is missing.');result.id=a.id;
      if(!a.before||typeof a.before!=='object')throw new Error('The original record is missing.');result.before=a.before;
    }
    if(['schedule_task','move_block'].includes(a.type)){
      if(!parseLocalDate(a.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(a.time||'')||!Number.isInteger(a.durationMinutes)||a.durationMinutes<5||a.durationMinutes>480||!short(a.title))throw new Error('The timetable proposal has invalid times or a missing title.');
      const [h,m]=a.time.split(':').map(Number);if(h*60+m+a.durationMinutes>1440)throw new Error('A block must finish on the same day.');
      Object.assign(result,{date:a.date,time:a.time,durationMinutes:a.durationMinutes,title:a.title.trim()});
      if(a.type==='schedule_task'){if(!id(a.taskId))throw new Error('Choose a saved or proposed task to schedule.');result.taskId=a.taskId;}
    }
    if(a.type==='set_budget'){
      if(!short(a.category)||!Number.isFinite(a.limit)||a.limit<=0||a.limit>100000000)throw new Error('The category budget must have a positive limit.');
      Object.assign(result,{category:a.category.trim(),limit:Math.round(a.limit*100)/100});
      if(a.id){if(!id(a.id)||!a.before)throw new Error('The original budget is missing.');result.id=a.id;result.before=a.before;}
    }
    return result;
  });
}
export function actionDescription(a){
  if(a.type==='create_task')return `Add task: ${a.title} · ${a.priority} priority`;
  if(a.type==='update_task')return `Update task: ${a.title} · ${a.priority} · ${a.done?'completed':'open'}`;
  if(a.type==='set_budget')return `Set monthly ${a.category} budget: ₹${a.limit.toLocaleString('en-IN')}`;
  return `${a.type==='move_block'?'Move':'Schedule'}: ${a.title} · ${a.date} at ${a.time} · ${a.durationMinutes} min`;
}
