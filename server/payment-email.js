import {readFileSync} from 'node:fs';
const template = readFileSync(new URL('../email-templates/payment-reminder.html', import.meta.url), 'utf8');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderPaymentEmail(job) {
  const intro = job.kind === 'receivable' ? 'This is an update on money owed to you.' : job.kind === 'payable' ? 'This is a gentle reminder of your outstanding payment.' : 'Here is your remaining share and repayment summary.';
  const details = String(job.text || '').slice(0, 3000);
  const sender=String(job.senderName||'Account owner').replace(/[\r\n]/g,' ').slice(0,80);
  const senderContact=job.senderEmail ? `${sender} (${job.senderEmail})` : sender;
  const values = {SENDER:senderContact,BORROWER:job.borrower||'See repayment details',LENDER:job.lender||'See repayment details',UNSUBSCRIBE:job.unsubscribeUrl||'https://lifeos53.vercel.app/',PREVIEW:intro, NAME:job.name || 'there', INTRO:intro, TITLE:job.title || 'Repayment summary', DETAILS:details, DUE:job.dueDate ? `Recorded due date: ${job.dueDate}` : 'No due date has been recorded. Please confirm payment arrangements directly.'};
  return {
    subject: `Payment reminder from ${sender} · LIFE OS`,
    fromName: `${sender} via LIFE OS`,
    ...(job.senderEmail?{replyTo:job.senderEmail}:{}),
    ...(job.unsubscribeUrl?{unsubscribeUrl:job.unsubscribeUrl}:{}),
    text: `Hello ${values.NAME},\n\n${intro}\n\nRecorded by: ${senderContact}\nBorrower / owes: ${values.BORROWER}\nLender / owed to: ${values.LENDER}\n\n${details}\n\n${values.DUE}\n\nOpen Life OS: https://lifeos53.vercel.app/?view=budget\n\nIf paid or incorrect, contact ${senderContact} to mark it settled. No payment is taken automatically.${job.unsubscribeUrl?`\n\nStop payment reminders from this account: ${job.unsubscribeUrl}`:''}`,
    html: template.replace(/\{\{(\w+)\}\}/g, (_, key) => escapeHtml(values[key]))
  };
}
