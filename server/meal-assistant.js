import {healthPlan} from './health-plan.js';

// Meal suggestions use the constrained planner, not free-form report analysis.
export function isMealRequest(text,context={}) {
 if(/\b(?:task|timetable|reminder|transaction|budget|expense)\b/i.test(text))return false;
 return /\b(?:what (?:(?:should|can|could) i (?:eat|have)|to eat)|(?:suggest|recommend|plan|give me|ideas? for|help (?:me )?(?:plan|choose))\b.{0,60}\b(?:meals?|breakfast|lunch|dinner|snacks?|food|diet)|(?:meal|diet) (?:plan|ideas?)|nutritionist|nutrienist)\b/i.test(text)
   || (context.page==='health'&&/\b(?:eat next|next meal|plan today)\b/i.test(text));
}
export async function mealReply(req,user,context,planner=healthPlan){
 const base={actions:[],memory:String(context.memory||'').slice(0,3000)};
 if(context.healthShared!==true)return {...base,reply:'I can suggest meals without a health report. Enable “Meals, health preferences, sleep & workouts” in Assistant preferences, then ask again. Or open Health → Food & plan → Open meal assistant.'};
 const text=req.body.text||'';
 const clock=String(context.localTime||'').match(/^(\d{2}):\d{2}$/);
 let hour=clock?Number(clock[1]):12;
 if(/\bbreakfast\b/i.test(text))hour=8;
 else if(/\blunch\b/i.test(text))hour=12;
 else if(/\bdinner\b/i.test(text))hour=19;
 else if(/\bsnack\b/i.test(text))hour=16;
 const plan=await planner({...req,body:{date:context.localDate,hour}},user);
 if(plan.blocked)return {...base,reply:plan.message+' Open Health → Food & plan → Open meal assistant to review your preferences. No report upload is required.'};
 if(!plan.nextMeal||!Array.isArray(plan.plan))throw Object.assign(Error('The meal planner returned an incomplete plan. Please retry.'),{status:502});
 const m=plan.nextMeal;
 const ingredients=m.ingredients.map(i=>`${i.grams} g ${i.name}`).join(', ');
 const daily=plan.plan.map(p=>`${p.slot}: ${p.name}`).join('\n');
 return {...base,reply:`Next meal: ${m.name}\n${ingredients}\n${m.method}\n\nSample day:\n${daily}\n\n${plan.selection}. Based on your saved preferences and available logs; these are general food ideas, not a medical diet.${plan.dataWarnings?.length?' Some logs could not load: '+plan.dataWarnings.join(', ')+'.':''}\nOpen Health → Food & plan → Open meal assistant to generate, review and save a plan. Nothing has been saved from this chat.`};
}
