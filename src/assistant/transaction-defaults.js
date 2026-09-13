// Fill optional omissions only. Never invent an amount or silently fix an invalid date.
export function transactionDefaults(action,context,text=''){
 if(action.type!=='create_transaction')return action;
 const result={...action};
 if(!result.date)result.date=context.interpretedRequest?.date||context.localDate;
 if(!result.category?.trim())result.category='Other';
 if(!result.transactionType){
  const expense=/\b(expense|spent|bought|purchase)\b/i.test(text),income=/\b(income|earned|salary)\b/i.test(text);
  if(expense!==income)result.transactionType=expense?'expense':'income';
 }
 if(typeof result.amount==='string'&&/^\d+(\.\d{1,2})?$/.test(result.amount))result.amount=Number(result.amount);
 return result;
}
