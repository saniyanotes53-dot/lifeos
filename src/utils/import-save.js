import { transactionIssues, importIdentity } from './statement-import.js';

export async function saveImport(rows, adapter, onProgress=()=>{}) {
  if (!rows.length) throw new Error('Select at least one transaction.');
  if (rows.some(row=>transactionIssues(row).length)) throw new Error('Fix the date, amount and type of every selected row.');
  const entries = [];
  for (const row of rows) {
    const importKey = row.importKey || importIdentity(row);
    const id = `import_${await adapter.hash(importKey)}`;
    entries.push({id, data:{date:row.date, amount:Number(row.amount), type:row.type,
      category:String(row.category || (row.type==='income'?'Income':'Other')).slice(0,80),
      note:String(row.note||'').slice(0,500), wallet:String(row.wallet||'Unassigned').slice(0,100),
      reference:String(row.reference||'').slice(0,150), importKey, source:'statement', importedAt:row.importedAt||new Date().toISOString()}});
  }
  // Each chunk is atomic. Stable IDs make retries safe after a partial import.
  let saved=0, skipped=0;
  for (let offset=0; offset<entries.length; offset+=100) {
    const result=await adapter.commit(entries.slice(offset,offset+100));
    saved+=result.saved; skipped+=result.skipped;
    onProgress({saved,skipped,processed:Math.min(offset+100,entries.length),total:entries.length});
  }
  return {saved,skipped};
}
