import Papa from 'papaparse';
import { parseLocalDate } from './dates.js';

export const TRANSACTION_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Income', 'Other'];
const clean = value => String(value ?? '').trim();
const key = value => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases = {
  date: ['date', 'transactiondate', 'txndate', 'datetime', 'transactiondatetime', 'postingdate', 'valuedate'],
  amount: ['amount', 'amountinr', 'transactionamount', 'transactionamountinr', 'value'],
  debit: ['debit', 'debitamount', 'debitinr', 'withdrawal', 'withdrawals', 'withdrawalamount', 'withdrawalamt', 'paidout', 'expense'],
  credit: ['credit', 'creditamount', 'creditinr', 'deposit', 'deposits', 'depositamount', 'depositamt', 'paidin', 'income'],
  type: ['type', 'transactiontype', 'direction', 'drcr', 'crdr', 'debitcredit', 'paymenttype'],
  note: ['description', 'transactiondescription', 'narration', 'particulars', 'details', 'note', 'merchant', 'name', 'title', 'payee', 'recipient'],
  reference: ['transactionid', 'upitransactionid', 'utr', 'utrnumber', 'reference', 'referenceno', 'referencenumber', 'refno', 'bankreferencenumber'],
  status: ['status', 'transactionstatus', 'paymentstatus'],
  category: ['category'],
  wallet: ['wallet', 'account', 'accountname'],
};

export function statementDate(value, order = 'DMY') {
  const s = clean(value).replace(/,/g, '');
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|[T\s])/.exec(s);
  let year, month, day;
  if (m) [, year, month, day] = m;
  else if ((m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})(?:$|\s)/.exec(s))) {
    [, day, month, year] = m;
    if (order === 'MDY') [day, month] = [month, day];
    if (year.length === 2) year = `20${year}`;
  } else {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    m = /^(\d{1,2})[\s/-]+([a-z]+)[\s/-]+(\d{4})(?:$|\s)/i.exec(s);
    if (m) { day=m[1]; month=months.indexOf(m[2].slice(0,3).toLowerCase())+1; year=m[3]; }
    else {
      m = /^([a-z]+)[\s/-]+(\d{1,2})[\s/-]+(\d{4})(?:$|\s)/i.exec(s);
      if (!m) return '';
      month=months.indexOf(m[1].slice(0,3).toLowerCase())+1; day=m[2]; year=m[3];
    }
  }
  const result = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  return parseLocalDate(result) ? result : '';
}

export function statementAmount(value) {
  let s = clean(value);
  if (!s || /^[-–—]$/.test(s)) return 0;
  const negative = /^\(.*\)$/.test(s) || /\bdr\s*$/i.test(s);
  s = s.replace(/\b(?:inr|rs\.?)\s*/gi, '').replace(/\b(?:cr|dr)\s*$/i, '').replace(/[₹,\s()]/g, '');
  // Reject text and account numbers with embedded punctuation, not just NaN.
  if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(s)) return NaN;
  const n = Number(s);
  return Number.isFinite(n) && Math.abs(n) <= 1e12 ? (negative ? -Math.abs(n) : n) : NaN;
}

export function transactionIssues(row) {
  const issues = [];
  if (!parseLocalDate(row.date)) issues.push('Choose a valid date');
  if (!Number.isFinite(Number(row.amount)) || Number(row.amount) <= 0 || Number(row.amount) > 1e12) issues.push('Enter a positive amount');
  else if (Math.abs(Number(row.amount)*100-Math.round(Number(row.amount)*100))>0.001) issues.push('Use no more than two decimal places');
  if (!['income','expense'].includes(row.type)) issues.push('Choose income or expense');
  return issues;
}

export function importIdentity(row) {
  // A UTR is stronger than merchant text; retain the original identity after edits.
  if (clean(row.reference)) return JSON.stringify(['ref', clean(row.reference).toLowerCase(), row.type, Math.round(Number(row.amount) * 100)]);
  return JSON.stringify([row.date, row.type, Math.round(Number(row.amount) * 100), clean(row.note).toLowerCase().replace(/\s+/g,' ')]);
}

export function prepareImportRows(rows, existing = []) {
  const known = new Set(existing.flatMap(row => [row.importKey, importIdentity(row)].filter(Boolean)));
  const imported = new Set(existing.map(row=>row.importKey).filter(Boolean));
  const seen = new Map();
  return rows.map((row, index) => {
    const identity=importIdentity(row),occurrence=seen.get(identity)||0;
    // Equal cash payments can be legitimate. Separate occurrences keep stable IDs
    // and are offered for explicit review, while matching UTRs stay deduplicated.
    const importKey = row.importKey || (occurrence&&!row.reference?`${identity}:occurrence:${occurrence+1}`:identity);
    const duplicate = known.has(identity) || occurrence>0 || imported.has(importKey);
    const alreadyImported = imported.has(importKey) || (Boolean(row.reference)&&(known.has(identity)||occurrence>0));
    seen.set(identity,occurrence+1);
    const issues = transactionIssues(row);
    return {...row, importKey, index, duplicate, alreadyImported, issues, selected: !duplicate && !issues.length};
  });
}

export function parseStatementCsv(text, order = 'DMY') {
  const parsed = Papa.parse(text.replace(/^\uFEFF/, ''), {skipEmptyLines: 'greedy'});
  if (parsed.errors.some(e => e.code === 'MissingQuotes')) throw new Error('This CSV has an unclosed quoted field. Export it again and retry.');
  const grid = parsed.data;
  const headerIndex = grid.findIndex(row => {
    const headers = row.map(key);
    return headers.some(h => aliases.date.includes(h)) && headers.some(h => [...aliases.amount,...aliases.debit,...aliases.credit].includes(h));
  });
  if (headerIndex < 0) throw new Error('No transaction headers found. Include Date and Amount with Type, or Date with Debit and Credit columns.');
  const headers = grid[headerIndex].map(key);
  const columns = Object.fromEntries(Object.entries(aliases).map(([name, names]) => [name, headers.findIndex(h => names.includes(h))]));
  const rows = [], warnings = [];
  for (let index = headerIndex + 1; index < grid.length; index++) {
    const source = grid[index];
    const get = name => columns[name] < 0 ? '' : clean(source[columns[name]]);
    const status = get('status');
    if (/fail|pending|cancel|declin|revers|unsuccess/i.test(status)) { warnings.push(`Row ${index+1}: ${status} transaction skipped.`); continue; }
    if (/^(?:total|opening balance|closing balance|balance brought forward)\b/i.test(`${get('date')} ${get('note')}`.trim())) continue;
    if (key(get('date')) === headers[columns.date]) continue;
    const debit = statementAmount(get('debit')), credit = statementAmount(get('credit'));
    const signed = statementAmount(get('amount'));
    let type = '', amount = Math.abs(signed);
    if ((!Number.isFinite(debit)&&get('debit')) || (!Number.isFinite(credit)&&get('credit')) || (Math.abs(debit)>0 && Math.abs(credit)>0)) { type=''; amount=NaN; }
    else if (Math.abs(debit) > 0) { type='expense'; amount=Math.abs(debit); }
    else if (Math.abs(credit) > 0) { type='income'; amount=Math.abs(credit); }
    else {
      const direction = get('type') || (/\b(?:cr|dr)\s*$/i.exec(get('amount'))?.[0] || '');
      if (/^(income|credit|cr|received|receive|deposit|refund|money in)$/i.test(direction)) type='income';
      else if (/^(expense|debit|dr|paid|sent|payment|withdrawal|money out)$/i.test(direction)) type='expense';
      else if (signed < 0) type='expense';
      else if (/^\+/.test(get('amount'))) type='income';
    }
    if (!get('date') && !get('amount') && !get('debit') && !get('credit')) continue;
    rows.push({date:statementDate(get('date'),order), amount:Number.isFinite(amount)?amount:'', type,
      note:get('note').slice(0,500), reference:get('reference').slice(0,150),
      category:get('category') || (type==='income'?'Income':'Other'), wallet:get('wallet') || 'Unassigned', sourceRow:index+1});
  }
  if (!rows.length) throw new Error('No completed transactions were found in this CSV.');
  if (rows.length > 3000) throw new Error('This file contains more than 3,000 transactions. Split it into smaller files.');
  return {rows, warnings};
}
