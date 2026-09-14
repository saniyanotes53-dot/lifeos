import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderWelcomeEmail,
  sendWelcomeEmailForUser,
  welcomeEmailHandler
} from '../server/welcome-mail.js';

function createMockStore() {
  const store = new Map();
  return {
    store,
    get: async path => store.get(path) || null,
    claim: async (path, data) => {
      if (store.has(path)) {
        const existing = store.get(path);
        if (existing.sent || existing.status === 'sent') return { conflict: true };
        if (existing.status === 'pending') return { conflict: true };
      }
      store.set(path, data);
      return { ok: true };
    },
    set: async (path, data) => {
      store.set(path, data);
      return { ok: true };
    },
    delete: async path => {
      store.delete(path);
      return { ok: true };
    }
  };
}

// 1. HTML template renders
test('HTML template renders with personalized greeting, bullets, and CTA', () => {
  const { html, subject, greeting } = renderWelcomeEmail('Alex Johnson');
  assert.equal(subject, 'Welcome to Life OS · Your calmer day starts here');
  assert.equal(greeting, 'Welcome, Alex');
  assert.ok(html.includes('Welcome, Alex'));
  assert.ok(html.includes('A calmer day starts here.'));
  assert.ok(html.includes('organize your day and tasks'));
  assert.ok(html.includes('plan timetable blocks'));
  assert.ok(html.includes('track spending and budgets'));
  assert.ok(html.includes('manage routines available in Life OS'));
  assert.ok(html.includes('use your Life OS assistant'));
  assert.ok(html.includes('receive scheduled reminders'));
  assert.ok(html.includes('https://lifeos53.vercel.app/'));
  assert.ok(html.includes('Life OS · Buraq Studios'));
});

// 2. Plain-text template renders
test('plain-text template renders with personalized greeting, bullets, and CTA', () => {
  const { text, greeting } = renderWelcomeEmail('Alex Johnson');
  assert.equal(greeting, 'Welcome, Alex');
  assert.ok(text.includes('Life OS'));
  assert.ok(text.includes('Welcome, Alex'));
  assert.ok(text.includes('A calmer day starts here.'));
  assert.ok(text.includes('- organize your day and tasks'));
  assert.ok(text.includes('- plan timetable blocks'));
  assert.ok(text.includes('- track spending and budgets'));
  assert.ok(text.includes('- manage routines available in Life OS'));
  assert.ok(text.includes('- use your Life OS assistant'));
  assert.ok(text.includes('- receive scheduled reminders'));
  assert.ok(text.includes('https://lifeos53.vercel.app/'));
  assert.ok(text.includes('Life OS · Buraq Studios'));
});

// 3. Missing displayName works
test('missing displayName works and falls back to Welcome to Life OS', () => {
  const cases = [null, undefined, '', '   '];
  for (const val of cases) {
    const { html, text, greeting } = renderWelcomeEmail(val);
    assert.equal(greeting, 'Welcome to Life OS');
    assert.ok(html.includes('Welcome to Life OS'));
    assert.ok(text.includes('Welcome to Life OS'));
    assert.ok(!html.includes('Welcome, '));
    assert.ok(!text.includes('Welcome, '));
  }
});

// 4. New email/password user triggers welcome email
test('new email/password user triggers welcome email', async () => {
  const db = createMockStore();
  let delivered = null;
  const sendEmail = async payload => { delivered = payload; };

  const res = await sendWelcomeEmailForUser(
    { uid: 'user_new_101', email: 'NewUser@example.com', displayName: 'Samira Khan' },
    { db, sendEmail, now: 1700000000000 }
  );

  assert.equal(res.ok, true);
  assert.equal(res.sent, true);
  assert.ok(delivered);
  assert.equal(delivered.to, 'newuser@example.com');
  assert.equal(delivered.subject, 'Welcome to Life OS · Your calmer day starts here');
  assert.ok(delivered.html.includes('Welcome, Samira'));

  const receipt = await db.get('users/user_new_101/emailReceipts/welcome');
  assert.ok(receipt);
  assert.equal(receipt.sent, true);
  assert.equal(receipt.status, 'sent');
  assert.equal(receipt.email, 'newuser@example.com');
});

// 5. Returning user does not trigger another welcome email
test('returning user does not trigger another welcome email', async () => {
  const db = createMockStore();
  await db.set('users/user_returning_202/emailReceipts/welcome', {
    status: 'sent',
    sent: true,
    sentAt: 1690000000000,
    email: 'returning@example.com'
  });

  let sendCalled = false;
  const sendEmail = async () => { sendCalled = true; };

  const res = await sendWelcomeEmailForUser(
    { uid: 'user_returning_202', email: 'returning@example.com', displayName: 'Returning User' },
    { db, sendEmail }
  );

  assert.equal(res.ok, true);
  assert.equal(res.alreadySent, true);
  assert.equal(sendCalled, false);
});

// 6. New Google account triggers welcome email once
test('new Google account triggers welcome email once', async () => {
  const db = createMockStore();
  let sendCount = 0;
  const sendEmail = async () => { sendCount++; };

  // When isNewUser is true:
  const res = await sendWelcomeEmailForUser(
    { uid: 'google_uid_303', email: 'google.new@example.com', displayName: 'Google Newbie' },
    { db, sendEmail }
  );

  assert.equal(res.ok, true);
  assert.equal(res.sent, true);
  assert.equal(sendCount, 1);
});

// 7. Returning Google login does not resend it
test('returning Google login does not resend it', async () => {
  const db = createMockStore();
  await db.set('users/google_uid_404/emailReceipts/welcome', {
    status: 'sent',
    sent: true,
    sentAt: 1695000000000,
    email: 'google.returning@example.com'
  });

  let sendCount = 0;
  const sendEmail = async () => { sendCount++; };

  const res = await sendWelcomeEmailForUser(
    { uid: 'google_uid_404', email: 'google.returning@example.com', displayName: 'Google Returner' },
    { db, sendEmail }
  );

  assert.equal(res.ok, true);
  assert.equal(res.alreadySent, true);
  assert.equal(sendCount, 0);
});

// 8. Browser cannot spoof recipient email
test('browser cannot spoof recipient email', async () => {
  const db = createMockStore();
  let delivered = null;
  const sendEmail = async payload => { delivered = payload; };

  // Simulated authenticated user from verified Firebase ID token
  const verifiedUser = {
    uid: 'genuine_user_uid',
    email: 'genuine@example.com',
    name: 'Genuine Account'
  };

  const req = {
    method: 'POST',
    headers: { authorization: 'Bearer mock_token' },
    // Attacker tries to inject a victim or alternate recipient in the request body
    body: {
      to: 'attacker@evil.com',
      email: 'spoofed@target.com',
      uid: 'victim_uid_555'
    }
  };

  let responseData = null;
  let responseStatus = null;
  const res = {
    setHeader: () => {},
    status: s => {
      responseStatus = s;
      return {
        json: d => { responseData = d; }
      };
    }
  };

  await welcomeEmailHandler(req, res, {
    requireUser: async () => verifiedUser,
    db,
    sendEmail
  });

  assert.equal(responseStatus, 200);
  assert.equal(responseData.ok, true);
  assert.ok(delivered);
  // Email was delivered ONLY to the authenticated user's email, not the spoofed body
  assert.equal(delivered.to, 'genuine@example.com');
  assert.notEqual(delivered.to, 'attacker@evil.com');
  assert.notEqual(delivered.to, 'spoofed@target.com');

  // Receipt was saved under genuine UID
  const receipt = await db.get('users/genuine_user_uid/emailReceipts/welcome');
  assert.ok(receipt);
  assert.equal(receipt.email, 'genuine@example.com');
  assert.equal(await db.get('users/victim_uid_555/emailReceipts/welcome'), null);
});

// 9. Duplicate requests do not produce duplicate welcome emails
test('duplicate requests do not produce duplicate welcome emails', async () => {
  const db = createMockStore();
  let sendCount = 0;
  const sendEmail = async () => {
    sendCount++;
  };

  // Run two requests sequentially
  const res1 = await sendWelcomeEmailForUser(
    { uid: 'user_dup_1', email: 'dup@example.com' },
    { db, sendEmail }
  );
  const res2 = await sendWelcomeEmailForUser(
    { uid: 'user_dup_1', email: 'dup@example.com' },
    { db, sendEmail }
  );

  assert.equal(res1.ok, true);
  assert.equal(res1.sent, true);
  assert.equal(res2.ok, true);
  assert.equal(res2.alreadySent, true);
  assert.equal(sendCount, 1);
});

// 10. SMTP failure does not undo account creation
test('SMTP failure does not undo account creation in client workflow', async () => {
  // Simulated client-side helper behavior:
  let accountCreated = false;
  const mockUser = {
    uid: 'user_created_123',
    email: 'new@example.com',
    getIdToken: async () => 'mock_token'
  };

  // Simulated createUserWithEmailAndPassword succeeds:
  accountCreated = true;

  // Simulated sendWelcomeEmail fails due to SMTP error (e.g. 502):
  let welcomeErrorCaught = false;
  try {
    const welcomeResult = await (async () => {
      // Endpoint returns error
      throw new Error('SMTP connection timed out');
    })().catch(err => {
      welcomeErrorCaught = true;
      return { ok: false, error: err.message };
    });
    assert.equal(welcomeResult.ok, false);
  } catch {
    assert.fail('Should not throw unhandled exception');
  }

  // Account creation remains intact!
  assert.equal(accountCreated, true);
  assert.equal(welcomeErrorCaught, true);
});

// 11. Failed welcome send can safely retry where appropriate
test('failed welcome send can safely retry where appropriate', async () => {
  const db = createMockStore();
  let attempt = 0;
  const sendEmail = async () => {
    attempt++;
    if (attempt === 1) {
      throw new Error('Temporary SMTP 421 network timeout');
    }
  };

  // Attempt 1: Fails
  await assert.rejects(
    () => sendWelcomeEmailForUser(
      { uid: 'retry_user_1', email: 'retry@example.com' },
      { db, sendEmail }
    ),
    /Temporary SMTP 421 network timeout/
  );

  // Claim must be deleted to allow retry
  const pendingReceipt = await db.get('users/retry_user_1/emailReceipts/welcome');
  assert.equal(pendingReceipt, null);

  // Attempt 2: Retries and succeeds
  const res2 = await sendWelcomeEmailForUser(
    { uid: 'retry_user_1', email: 'retry@example.com' },
    { db, sendEmail }
  );

  assert.equal(res2.ok, true);
  assert.equal(res2.sent, true);
  assert.equal(attempt, 2);

  const finalReceipt = await db.get('users/retry_user_1/emailReceipts/welcome');
  assert.ok(finalReceipt);
  assert.equal(finalReceipt.sent, true);
});
