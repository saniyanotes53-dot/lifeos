import {readFileSync} from 'node:fs';
const template = readFileSync(new URL('../email-templates/payment-reminder.html', import.meta.url), 'utf8');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderPaymentEmail(job) {
  const intro = job.kind === 'receivable' ? 'This is an update on money owed to you.' : job.kind === 'payable' ? 'This is a gentle reminder of your outstanding payment.' : 'Here is your remaining share and repayment summary.';
  const details = String(job.text || '').slice(0, 3000);
  const values = {PREVIEW:intro, NAME:job.name || 'there', INTRO:intro, TITLE:job.title || 'Repayment summary', DETAILS:details, DUE:job.dueDate ? `Recorded due date: ${job.dueDate}` : 'No due date has been recorded. Please confirm payment arrangements directly.'};
  return {
    subject: 'Life OS · payment reminder',
    text: `Hello ${values.NAME},\n\n${intro}\n\n${details}\n\n${values.DUE}\n\nOpen Life OS: https://lifeos53.vercel.app/?view=budget\n\nIf paid or incorrect, contact the person who recorded this balance to mark it settled or disable reminders. No payment is taken automatically.`,
    html: template.replace(/\{\{(\w+)\}\}/g, (_, key) => escapeHtml(values[key]))
  };
}
