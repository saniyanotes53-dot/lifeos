import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateOTP,
  hashEmail,
  hashOTP,
  hashResetToken,
  safeCompare,
  renderOTPEmail,
  lookupAuthUser,
  requestPasswordReset,
  verifyPasswordReset,
  confirmPasswordReset
} from '../server/password-reset.js';

const TEST_SECRET = 'a_very_secure_test_secret_that_is_at_least_32_characters_long!';

test('generateOTP returns 6 digit string', () => {
  for (let i = 0; i < 20; i++) {
    const otp = generateOTP();
    assert.match(otp, /^\d{6}$/);
  }
});

test('hash utilities are deterministic and use the secret', () => {
  const email = 'User.Test@Example.com';
  const h1 = hashEmail(email, TEST_SECRET);
  const h2 = hashEmail('user.test@example.com', TEST_SECRET);
  assert.equal(h1, h2);

  const otpHash = hashOTP(h1, '123456', TEST_SECRET);
  assert.equal(typeof otpHash, 'string');
  assert.equal(otpHash.length, 64);

  const tokenHash = hashResetToken('random_token_123', TEST_SECRET);
  assert.equal(typeof tokenHash, 'string');
  assert.equal(tokenHash.length, 64);
});

test('safeCompare performs constant-time comparison', () => {
  assert.equal(safeCompare('abcdef', 'abcdef'), true);
  assert.equal(safeCompare('abcdef', 'abcdeg'), false);
  assert.equal(safeCompare('abcdef', 'abcde'), false);
  assert.equal(safeCompare('', ''), true);
  assert.equal(safeCompare(null, 'abc'), false);
});

test('renderOTPEmail includes OTP and security warnings in HTML and text', () => {
  const { html, text } = renderOTPEmail('839201');
  assert.ok(html.includes('839201'));
  assert.ok(html.includes('10 minutes'));
  assert.ok(text.includes('839201'));
  assert.ok(text.includes('10 minutes'));
});

test('requestPasswordReset returns generic success for invalid or missing user', async () => {
  let sent = false;
  const db = {
    get: async () => null,
    set: async () => {}
  };
  const lookupUser = async () => null;
  const sendEmail = async () => { sent = true; };

  // Invalid email
  const res1 = await requestPasswordReset('not-an-email', { secret: TEST_SECRET, db, lookupUser, sendEmail, skipRateLimit: true });
  assert.equal(res1.ok, true);
  assert.equal(sent, false);

  // Non-existent user
  const res2 = await requestPasswordReset('unknown@example.com', { secret: TEST_SECRET, db, lookupUser, sendEmail, skipRateLimit: true });
  assert.equal(res2.ok, true);
  assert.equal(sent, false);
});

test('requestPasswordReset stores record and delivers OTP via email', async () => {
  const store = new Map();
  let delivered = null;
  const now = 1700000000000;

  const db = {
    get: async path => store.get(path) || null,
    set: async (path, data) => store.set(path, data)
  };
  const lookupUser = async email => ({ uid: 'user_123', email, hasPassword: true });
  const sendEmail = async payload => { delivered = payload; };

  const res = await requestPasswordReset('user@example.com', {
    now,
    secret: TEST_SECRET,
    db,
    lookupUser,
    sendEmail,
    mockOTP: '654321',
    skipRateLimit: true
  });

  assert.equal(res.ok, true);
  assert.ok(delivered);
  assert.equal(delivered.to, 'user@example.com');
  assert.ok(delivered.html.includes('654321'));

  const emailHash = hashEmail('user@example.com', TEST_SECRET);
  const saved = store.get(`passwordResetRequests/${emailHash}`);
  assert.ok(saved);
  assert.equal(saved.uid, 'user_123');
  assert.equal(saved.verified, false);
  assert.equal(saved.used, false);
  assert.equal(saved.attemptCount, 0);
  assert.equal(saved.otpHash, hashOTP(emailHash, '654321', TEST_SECRET));
});

test('verifyPasswordReset enforces attempt limits and expires on wrong codes', async () => {
  const store = new Map();
  const now = 1700000000000;
  const email = 'user@example.com';
  const emailHash = hashEmail(email, TEST_SECRET);

  store.set(`passwordResetRequests/${emailHash}`, {
    uid: 'user_123',
    emailHash,
    otpHash: hashOTP(emailHash, '111222', TEST_SECRET),
    createdAt: now,
    expiresAt: now + 600000,
    attemptCount: 4,
    verified: false,
    used: false
  });

  const db = {
    get: async path => store.get(path) || null,
    set: async (path, data) => store.set(path, data)
  };

  // 5th failed attempt should invalidate the request
  await assert.rejects(
    () => verifyPasswordReset(email, '000000', { now, secret: TEST_SECRET, db }),
    /invalid or has expired/
  );

  const updated = store.get(`passwordResetRequests/${emailHash}`);
  assert.equal(updated.attemptCount, 5);
  assert.equal(updated.used, true);

  // Subsequent attempt rejected because used = true
  await assert.rejects(
    () => verifyPasswordReset(email, '111222', { now, secret: TEST_SECRET, db }),
    /invalid or has expired/
  );
});

test('verifyPasswordReset issues resetToken and confirmPasswordReset updates password', async () => {
  const store = new Map();
  const now = 1700000000000;
  const email = 'user@example.com';
  const emailHash = hashEmail(email, TEST_SECRET);

  store.set(`passwordResetRequests/${emailHash}`, {
    uid: 'user_123',
    emailHash,
    otpHash: hashOTP(emailHash, '789012', TEST_SECRET),
    createdAt: now,
    expiresAt: now + 600000,
    attemptCount: 0,
    verified: false,
    used: false
  });

  const db = {
    get: async path => store.get(path) || null,
    set: async (path, data) => store.set(path, data),
    del: async path => store.delete(path)
  };

  // Verify OTP
  const mockToken = 'a'.repeat(64);
  const verifyRes = await verifyPasswordReset(email, '789012', {
    now,
    secret: TEST_SECRET,
    db,
    mockResetToken: mockToken
  });

  assert.equal(verifyRes.ok, true);
  assert.equal(verifyRes.resetToken, mockToken);

  // Ensure request is marked verified and otpHash cleared
  const otpRecord = store.get(`passwordResetRequests/${emailHash}`);
  assert.equal(otpRecord.verified, true);
  assert.equal(otpRecord.used, true);
  assert.equal(otpRecord.otpHash, '');

  // Confirm password
  let passwordUpdatedFor = null;
  const updateUserPassword = async (uid, pw) => {
    passwordUpdatedFor = { uid, pw };
  };

  const confirmRes = await confirmPasswordReset(mockToken, 'NewSecurePassword123!', {
    now: now + 1000,
    secret: TEST_SECRET,
    db,
    updateUserPassword
  });

  assert.equal(confirmRes.ok, true);
  assert.deepEqual(passwordUpdatedFor, { uid: 'user_123', pw: 'NewSecurePassword123!' });

  // Replaying the token should fail
  await assert.rejects(
    () => confirmPasswordReset(mockToken, 'AnotherPassword123!', { now: now + 2000, secret: TEST_SECRET, db, updateUserPassword }),
    /Invalid or expired reset token/
  );
});

test('OTP expires after 10 minutes and is rejected', async () => {
  const store = new Map();
  const now = 1700000000000;
  const email = 'expire@example.com';
  const emailHash = hashEmail(email, TEST_SECRET);

  store.set(`passwordResetRequests/${emailHash}`, {
    uid: 'user_exp',
    emailHash,
    otpHash: hashOTP(emailHash, '123456', TEST_SECRET),
    createdAt: now,
    expiresAt: now + 10 * 60 * 1000, // 10 minutes
    attemptCount: 0,
    verified: false,
    used: false
  });

  const db = {
    get: async path => store.get(path) || null,
    set: async (path, data) => store.set(path, data)
  };

  // 10 minutes + 1 ms later
  await assert.rejects(
    () => verifyPasswordReset(email, '123456', { now: now + 10 * 60 * 1000 + 1, secret: TEST_SECRET, db }),
    /That code is invalid or has expired/
  );
});

test('60-second resend cooldown suppresses duplicate dispatch', async () => {
  const store = new Map();
  const now = 1700000000000;
  let sendCount = 0;

  const db = {
    get: async path => store.get(path) || null,
    set: async (path, data) => store.set(path, data)
  };
  const lookupUser = async email => ({ uid: 'user_cool', email, hasPassword: true });
  const sendEmail = async () => { sendCount++; };

  // First request dispatches
  const res1 = await requestPasswordReset('cooldown@example.com', {
    now,
    secret: TEST_SECRET,
    db,
    lookupUser,
    sendEmail,
    skipRateLimit: true
  });
  assert.equal(res1.ok, true);
  assert.equal(sendCount, 1);

  // Second request 30 seconds later (within 60s cooldown) returns generic success without dispatching email
  const res2 = await requestPasswordReset('cooldown@example.com', {
    now: now + 30000,
    secret: TEST_SECRET,
    db,
    lookupUser,
    sendEmail,
    skipRateLimit: true
  });
  assert.equal(res2.ok, true);
  assert.equal(sendCount, 1); // Not incremented!
});

test('OTP cannot be reused after verification', async () => {
  const store = new Map();
  const now = 1700000000000;
  const email = 'reuse@example.com';
  const emailHash = hashEmail(email, TEST_SECRET);

  store.set(`passwordResetRequests/${emailHash}`, {
    uid: 'user_reuse',
    emailHash,
    otpHash: hashOTP(emailHash, '333444', TEST_SECRET),
    createdAt: now,
    expiresAt: now + 600000,
    attemptCount: 0,
    verified: false,
    used: false
  });

  const db = {
    get: async path => store.get(path) || null,
    set: async (path, data) => store.set(path, data)
  };

  const res1 = await verifyPasswordReset(email, '333444', { now, secret: TEST_SECRET, db, mockResetToken: 'b'.repeat(64) });
  assert.equal(res1.ok, true);

  // Trying to verify again with the same code must fail
  await assert.rejects(
    () => verifyPasswordReset(email, '333444', { now: now + 1000, secret: TEST_SECRET, db }),
    /That code is invalid or has expired/
  );
});

test('reset token expires after 5 minutes and invalid tokens are rejected', async () => {
  const store = new Map();
  const now = 1700000000000;
  const mockToken = 'c'.repeat(64);
  const tokenHash = hashResetToken(mockToken, TEST_SECRET);

  store.set(`passwordResetTokens/${tokenHash}`, {
    uid: 'user_token_exp',
    emailHash: 'some_hash',
    createdAt: now,
    expiresAt: now + 5 * 60 * 1000, // 5 minutes
    used: false
  });

  const db = {
    get: async path => store.get(path) || null,
    set: async (path, data) => store.set(path, data)
  };

  // Malformed token rejection
  await assert.rejects(
    () => confirmPasswordReset('short_invalid_token', 'NewPassword123!', { now, secret: TEST_SECRET, db }),
    /Invalid or expired reset token/
  );

  // 5 minutes + 1 ms later
  await assert.rejects(
    () => confirmPasswordReset(mockToken, 'NewPassword123!', { now: now + 5 * 60 * 1000 + 1, secret: TEST_SECRET, db }),
    /Invalid or expired reset token/
  );
});

test('SMTP failure during requestPasswordReset is handled safely with generic response', async () => {
  const store = new Map();
  const now = 1700000000000;

  const db = {
    get: async path => store.get(path) || null,
    set: async (path, data) => store.set(path, data)
  };
  const lookupUser = async email => ({ uid: 'user_smtp_fail', email, hasPassword: true });
  const sendEmail = async () => {
    throw new Error('SMTP connection timed out on port 465');
  };

  const res = await requestPasswordReset('user@example.com', {
    now,
    secret: TEST_SECRET,
    db,
    lookupUser,
    sendEmail,
    skipRateLimit: true
  });

  // Must return generic success without exposing internal SMTP error
  assert.equal(res.ok, true);
  assert.ok(res.message.includes('If an eligible Life OS account exists'));
});

test('old Firebase reset-link API is not called and requestPasswordResetOTP uses Life OS API', async () => {
  let calledUrl = null;
  let calledBody = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calledUrl = url;
    calledBody = JSON.parse(opts.body || '{}');
    return {
      ok: true,
      json: async () => ({ ok: true, message: 'OTP sent' })
    };
  };

  try {
    const { requestPasswordResetOTP } = await import('../src/auth.js');
    const result = await requestPasswordResetOTP('test@example.com');
    assert.equal(result.ok, true);
    assert.equal(calledUrl, '/api/auth/password-reset/request');
    assert.equal(calledBody.email, 'test@example.com');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('TEST 1: lookupAuthUser - providerUserInfo explicitly contains password', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      users: [{
        localId: 'uid-password',
        email: 'password@example.com',
        providerUserInfo: [
          { providerId: 'password' }
        ]
      }]
    })
  });

  const res = await lookupAuthUser('password@example.com', { token: 'test-token', fetchImpl });
  assert.ok(res);
  assert.equal(res.uid, 'uid-password');
  assert.equal(res.email, 'password@example.com');
  assert.equal(res.hasPassword, true);
});

test('TEST 2 — IMPORTANT REGRESSION: lookupAuthUser - providerUserInfo does NOT contain password, but passwordUpdatedAt exists', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      users: [{
        localId: 'uid-password-timestamp',
        email: 'legacy@example.com',
        providerUserInfo: [],
        passwordUpdatedAt: '1789380000000'
      }]
    })
  });

  const res = await lookupAuthUser('legacy@example.com', { token: 'test-token', fetchImpl });
  assert.ok(res);
  assert.equal(res.uid, 'uid-password-timestamp');
  assert.equal(res.email, 'legacy@example.com');
  assert.equal(res.hasPassword, true);
});

test('TEST 3: lookupAuthUser - Google-only account without password credential', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      users: [{
        localId: 'uid-google',
        email: 'google@example.com',
        providerUserInfo: [
          { providerId: 'google.com' }
        ]
      }]
    })
  });

  const res = await lookupAuthUser('google@example.com', { token: 'test-token', fetchImpl });
  assert.ok(res);
  assert.equal(res.uid, 'uid-google');
  assert.equal(res.email, 'google@example.com');
  assert.equal(res.hasPassword, false);
});

test('TEST 4: lookupAuthUser - Account has Google + password', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      users: [{
        localId: 'uid-google-password',
        email: 'dual@example.com',
        providerUserInfo: [
          { providerId: 'google.com' },
          { providerId: 'password' }
        ]
      }]
    })
  });

  const res = await lookupAuthUser('dual@example.com', { token: 'test-token', fetchImpl });
  assert.ok(res);
  assert.equal(res.uid, 'uid-google-password');
  assert.equal(res.email, 'dual@example.com');
  assert.equal(res.hasPassword, true);
});

test('TEST 5: lookupAuthUser - Disabled account returns null', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      users: [{
        localId: 'disabled',
        email: 'disabled@example.com',
        disabled: true,
        passwordUpdatedAt: '1789380000000'
      }]
    })
  });

  const res = await lookupAuthUser('disabled@example.com', { token: 'test-token', fetchImpl });
  assert.equal(res, null);
});

test('requestPasswordReset dispatches OTP for legacy password account (passwordUpdatedAt) but suppresses for Google-only and disabled', async () => {
  const store = new Map();
  const db = {
    get: async path => store.get(path) || null,
    set: async (path, data) => store.set(path, data)
  };
  let sentEmail = null;
  const sendEmail = async payload => { sentEmail = payload; };

  // 1. Legacy password account with passwordUpdatedAt
  const legacyFetch = async () => ({
    ok: true,
    json: async () => ({
      users: [{
        localId: 'legacy_uid',
        email: 'legacy@example.com',
        providerUserInfo: [],
        passwordUpdatedAt: '1789380000000'
      }]
    })
  });
  const resLegacy = await requestPasswordReset('legacy@example.com', {
    secret: TEST_SECRET,
    db,
    lookupUser: email => lookupAuthUser(email, { token: 'test-token', fetchImpl: legacyFetch }),
    sendEmail,
    skipRateLimit: true
  });
  assert.equal(resLegacy.ok, true);
  assert.ok(sentEmail);
  assert.equal(sentEmail.to, 'legacy@example.com');

  // Reset sentEmail
  sentEmail = null;

  // 2. Google-only account
  const googleFetch = async () => ({
    ok: true,
    json: async () => ({
      users: [{
        localId: 'google_uid',
        email: 'google@example.com',
        providerUserInfo: [{ providerId: 'google.com' }]
      }]
    })
  });
  const resGoogle = await requestPasswordReset('google@example.com', {
    secret: TEST_SECRET,
    db,
    lookupUser: email => lookupAuthUser(email, { token: 'test-token', fetchImpl: googleFetch }),
    sendEmail,
    skipRateLimit: true
  });
  assert.equal(resGoogle.ok, true);
  assert.equal(sentEmail, null);

  // 3. Disabled account
  const disabledFetch = async () => ({
    ok: true,
    json: async () => ({
      users: [{
        localId: 'disabled_uid',
        email: 'disabled@example.com',
        disabled: true,
        passwordUpdatedAt: '1789380000000'
      }]
    })
  });
  const resDisabled = await requestPasswordReset('disabled@example.com', {
    secret: TEST_SECRET,
    db,
    lookupUser: email => lookupAuthUser(email, { token: 'test-token', fetchImpl: disabledFetch }),
    sendEmail,
    skipRateLimit: true
  });
  assert.equal(resDisabled.ok, true);
  assert.equal(sentEmail, null);
});



