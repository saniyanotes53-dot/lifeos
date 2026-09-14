import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateKeyPair, exportPKCS8 } from 'jose';
import { isDue } from '../server/push-delivery.js';
import handler, { escapeHtml, renderReminderHtml, formatReminderDate } from '../api/notify-due.js';

test('scheduled delivery ignores completed, stale, future and invalid blocks',()=>{
 const now=Date.now();assert.equal(isDue({remindAt:now-1000},now),true);
 for(const block of [{remindAt:now+1},{remindAt:now-300001},{remindAt:now,done:true},{remindAt:'invalid'}])assert.equal(isDue(block,now),false);
});

test('scheduler refuses unauthenticated requests before touching any service',async()=>{
 const before=process.env.CRON_SECRET;process.env.CRON_SECRET='scheduler-secret';let status;
 const res={setHeader(){},status(s){status=s;return this;},json(body){return body;}};
 try{await handler({headers:{},query:{}},res);assert.equal(status,401);}finally{if(before===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=before;}
});

test('Python transport forwards a private request and propagates failures',async()=>{
 const {transport}=await import('../server/delivery.js');const original=globalThis.fetch;
 try{globalThis.fetch=async(url,options)=>{assert.equal(url,'https://lifeos53.vercel.app/api/deliver');assert.equal(JSON.parse(options.body).channel,'push');return {ok:true,json:async()=>({expired:true})};};assert.deepEqual(await transport({channel:'push'}),{expired:true});globalThis.fetch=async()=>({ok:false,status:502,json:async()=>({})});await assert.rejects(()=>transport({channel:'email'}),/Python delivery failed/);}finally{globalThis.fetch=original;}
});

test('escapeHtml escapes dangerous HTML characters and handles empty values', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(''), '');
  assert.equal(
    escapeHtml('<script>alert("XSS") & \'test\'</script>'),
    '&lt;script&gt;alert(&quot;XSS&quot;) &amp; &#39;test&#39;&lt;/script&gt;'
  );
  assert.equal(escapeHtml('Clean Task 123'), 'Clean Task 123');
});

test('renderReminderHtml populates task, time, date, timetable URL and escapes task', () => {
  const rendered = renderReminderHtml({
    task: '<img src=x onerror=alert(1)> Math "Exam" & Notes',
    time: '09:00 AM',
    date: 'Monday, 15 September',
    url: 'https://lifeos53.vercel.app/?view=timetable'
  });

  assert.ok(rendered.includes('Math &quot;Exam&quot; &amp; Notes'));
  assert.ok(rendered.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!rendered.includes('<img src=x onerror=alert(1)>'));
  assert.ok(rendered.includes('09:00 AM'));
  assert.ok(rendered.includes('Monday, 15 September'));
  assert.ok(rendered.includes('https://lifeos53.vercel.app/?view=timetable'));
  assert.ok(!rendered.includes('{{TASK}}'));
  assert.ok(!rendered.includes('{{TIME}}'));
  assert.ok(!rendered.includes('{{DATE}}'));
  assert.ok(!rendered.includes('{{TIMETABLE_URL}}'));
});

test('formatReminderDate handles timezones and falls back safely to Asia/Kolkata', () => {
  const ts = new Date('2026-09-14T10:00:00Z').getTime();
  const dateKolkata = formatReminderDate(ts, 'Asia/Kolkata');
  assert.ok(typeof dateKolkata === 'string' && dateKolkata.length > 0);
  assert.ok(dateKolkata.includes('September'));

  // Invalid timezone falls back safely without error
  const dateFallback = formatReminderDate(ts, 'Invalid/Unknown_TZ');
  assert.equal(dateFallback, dateKolkata);

  // Missing timezone falls back safely
  const dateMissing = formatReminderDate(ts, undefined);
  assert.equal(dateMissing, dateKolkata);
});

test('vercel.json packages email-templates and reminder.html exists with placeholders', () => {
  const vercelConfig = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const includeFiles = vercelConfig?.functions?.['api/**/*.js']?.includeFiles;
  assert.ok(includeFiles, 'vercel.json must have includeFiles');
  assert.ok(includeFiles.includes('email-templates/**'), 'vercel.json must include email-templates/**');

  const templateContent = readFileSync(new URL('../email-templates/reminder.html', import.meta.url), 'utf8');
  assert.ok(templateContent.includes('{{TASK}}'), 'reminder.html must have {{TASK}}');
  assert.ok(templateContent.includes('{{TIME}}'), 'reminder.html must have {{TIME}}');
  assert.ok(templateContent.includes('{{DATE}}'), 'reminder.html must have {{DATE}}');
  assert.ok(templateContent.includes('{{TIMETABLE_URL}}'), 'reminder.html must have {{TIMETABLE_URL}}');
});

test('scheduled reminder delivers multipart HTML email and preserves push channel & idempotency', async () => {
  const keyPair = await generateKeyPair('RS256', { extractable: true });
  const privateKeyPem = await exportPKCS8(keyPair.privateKey);

  const prevEnv = {
    FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    CRON_SECRET: process.env.CRON_SECRET,
    NOTIFICATION_SCHEDULER_ENABLED: process.env.NOTIFICATION_SCHEDULER_ENABLED,
    GMAIL_ADDRESS: process.env.GMAIL_ADDRESS,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
    WEB_PUSH_PUBLIC_KEY: process.env.WEB_PUSH_PUBLIC_KEY,
    WEB_PUSH_PRIVATE_KEY: process.env.WEB_PUSH_PRIVATE_KEY,
    WEB_PUSH_CONTACT: process.env.WEB_PUSH_CONTACT
  };

  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    project_id: 'lifeos-61443',
    client_email: 'test@lifeos-61443.iam.gserviceaccount.com',
    private_key: privateKeyPem
  });
  process.env.CRON_SECRET = 'test-cron-secret-12345';
  process.env.NOTIFICATION_SCHEDULER_ENABLED = 'true';
  process.env.GMAIL_ADDRESS = 'sender@gmail.com';
  process.env.GMAIL_APP_PASSWORD = 'test-app-password';
  process.env.WEB_PUSH_PUBLIC_KEY = 'test-public';
  process.env.WEB_PUSH_PRIVATE_KEY = 'test-private';
  process.env.WEB_PUSH_CONTACT = 'mailto:sender@gmail.com';

  const origFetch = globalThis.fetch;
  const transportCalls = [];
  const receiptsCreated = [];

  const now = Date.now();
  const remindAt = now - 60000;
  const rawLabel = 'Code Review <Backend> & "Deployment"';

  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr === 'https://oauth2.googleapis.com/token') {
      return { ok: true, status: 200, json: async () => ({ access_token: 'mock-access-token' }) };
    }
    if (urlStr.includes(':runQuery')) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            document: {
              name: 'projects/lifeos-61443/databases/(default)/documents/users/user123/timetable/block999',
              fields: {
                time: { stringValue: '11:00' },
                label: { stringValue: rawLabel },
                remindAt: { integerValue: String(remindAt) }
              }
            }
          }
        ]
      };
    }
    if (urlStr.includes('/users/user123/timetable/block999')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          fields: {
            time: { stringValue: '11:00' },
            label: { stringValue: rawLabel },
            remindAt: { integerValue: String(remindAt) }
          }
        })
      };
    }
    if (urlStr.includes('/notificationSettings/delivery')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          fields: {
            emailEnabled: { booleanValue: true },
            email: { stringValue: 'recipient@example.com' },
            timeZone: { stringValue: 'Asia/Kolkata' }
          }
        })
      };
    }
    if (urlStr.includes('/pushSubscriptions')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          documents: [
            {
              name: 'projects/lifeos-61443/databases/(default)/documents/users/user123/pushSubscriptions/sub1',
              fields: {
                enabled: { booleanValue: true },
                provider: { stringValue: 'webpush' },
                subscription: {
                  mapValue: {
                    fields: {
                      endpoint: { stringValue: 'https://fcm.googleapis.com/fcm/send/abc' },
                      keys: {
                        mapValue: {
                          fields: {
                            auth: { stringValue: 'authKey123' },
                            p256dh: { stringValue: 'p256Key123' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          ]
        })
      };
    }
    if (urlStr.includes('/notificationReceipts/')) {
      receiptsCreated.push(urlStr);
      return { ok: true, status: 200, json: async () => ({ fields: {} }) };
    }
    if (urlStr === 'https://lifeos53.vercel.app/api/deliver') {
      const payload = JSON.parse(options.body);
      transportCalls.push(payload);
      return { ok: true, status: 200, json: async () => ({ accepted: true }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };

  try {
    let resultJson = null;
    let statusCode = 200;
    const res = {
      setHeader() {},
      status(s) { statusCode = s; return this; },
      json(data) { resultJson = data; return data; }
    };
    await handler({ headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, query: {} }, res);

    assert.equal(statusCode, 200);
    assert.deepEqual(resultJson, { accepted: 2 });
    assert.equal(transportCalls.length, 2);

    // Verify push call (unchanged)
    const pushCall = transportCalls.find(c => c.channel === 'push');
    assert.ok(pushCall, 'Push job should be dispatched');
    assert.equal(pushCall.body, `11:00 · ${rawLabel}`);
    assert.ok(pushCall.subscription);
    assert.equal(pushCall.subscription.endpoint, 'https://fcm.googleapis.com/fcm/send/abc');

    // Verify email call
    const emailCall = transportCalls.find(c => c.channel === 'email');
    assert.ok(emailCall, 'Email job should be dispatched');
    assert.equal(emailCall.to, 'recipient@example.com');
    assert.ok(emailCall.idempotencyKey && emailCall.idempotencyKey.length === 64);
    assert.equal(emailCall.subject, `Life OS · ${rawLabel}`);
    assert.ok(emailCall.text.includes('11:00 · ' + rawLabel));
    assert.ok(emailCall.text.includes('https://lifeos53.vercel.app/?view=timetable'));
    assert.ok(emailCall.text.includes('Turn off email reminders'));

    // HTML validation
    assert.ok(emailCall.html, 'Email payload must contain html');
    assert.ok(emailCall.html.includes('Code Review &lt;Backend&gt; &amp; &quot;Deployment&quot;'));
    assert.ok(!emailCall.html.includes('<Backend>'));
    assert.ok(emailCall.html.includes('11:00'));
    assert.ok(emailCall.html.includes('https://lifeos53.vercel.app/?view=timetable'));
    assert.ok(emailCall.html.includes('LIFE OS'));
    assert.ok(emailCall.html.includes('REMINDER'));

    // Verify receipts were created
    assert.equal(receiptsCreated.length, 2);
    assert.ok(receiptsCreated.every(r => r.includes('currentDocument.exists=false')));
  } finally {
    globalThis.fetch = origFetch;
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
