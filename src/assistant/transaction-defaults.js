import {parseLocalDate,shiftDate} from '../utils/dates.js';
export function transactionDefaults(action,context,text=''){
 if(action.type!=='create_transaction')return action;
 const result={...action},today=context.localDate;
 let date=typeof result.date==='string'?result.date.trim():result.date;
 if(!date)date=context.interpretedRequest?.date||today;
 if(typeof date==='string'){
  if(/^today$/i.test(date))date=today;
  else if(/^yesterday$/i.test(date))date=shiftDate(today,-1);
  else if(/^tomorrow$/i.test(date))date=shiftDate(today,1);
  const indian=/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(date||'');
  if(indian)date=`${indian[3]}-${indian[2].padStart(2,'0')}-${indian[1].padStart(2,'0')}`;
 }
 result.date=date;
 if(!result.category?.trim())result.category='Other';
 const kind=String(result.transactionType||'').trim().toLowerCase();
 result.transactionType=kind;
 if(!kind){
  const expense=/\b(expense|spent|bought|purchase)\b/i.test(text),income=/\b(income|earned|salary)\b/i.test(text);
  if(expense!==income)result.transactionType=expense?'expense':'income';
 }
 if(typeof result.amount==='string'){
  const value=result.amount.trim().replace(/^(?:₹|rs\.?|inr)\s*/i,'').replace(/\s*(?:rs\.?|inr|rupees)$/i,'').replace(/,/g,'');
  if(/^\d+(\.\d{1,2})?$/.test(value))result.amount=Number(value);
 }
 // One explicit currency amount can fill an omitted value, never replace a supplied value.
 if(result.amount==null){
  const matches=[...text.matchAll(/(?:₹|\bRs\.?\s*|\bINR\s*)(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s*(?:Rs\b|INR\b|rupees\b)/gi)];
  if(matches.length===1)result.amount=Number((matches[0][1]||matches[0][2]).replace(/,/g,''));
 }
 return result;
}
export function transactionIssues(a){
 return [!parseLocalDate(a.date)&&'date (YYYY-MM-DD)',(!Number.isFinite(a.amount)||a.amount<=0||a.amount>100000000)&&'positive amount',!['income','expense'].includes(a.transactionType)&&'income/expense type',(!(typeof a.category==='string')||!a.category.trim()||a.category.length>200)&&'category'].filter(Boolean);
}

// Execute unambiguous single-entry commands without depending on model formatting.
// Complex requests, multiple amounts and dated instructions continue through Gemini.
export function simpleExpenseCommand(text,context){
 if(!/^log\s+(?:in\s+)?(?:(?:an?|the)\s+)?expense\b/i.test(text.trim())||/[?;\n]|\b(and|then|if|not|don't|tomorrow|yesterday|last|next|ago|on|dated|today|days?|weeks?|months?|years?|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|delete|remove|schedule|update|create)\b|\d[/-]\d/i.test(text))return null;
 const a=transactionDefaults({type:'create_transaction',ref:'expense',transactionType:'expense'},context,text);
 if(transactionIssues(a).length)return null;
 const tags=[...text.matchAll(/#([\p{L}\p{N}_-]+)/gu)];if(tags.length>1)return null;
 a.eventTag=tags[0]?.[1]||'';
 a.note=text.trim().slice(0,200);
 a.category=/\btravel\b/i.test(text)?'Travel':/\b(food|meal|lunch|dinner)\b/i.test(text)?'Food':'Other';
 return a;
}
