import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { projectId } from './firebase.js';
import { adminToken, decode } from './reminder-mail.js';
import { transport } from './delivery.js';
import {atomicRecord,persistentLimit} from './security-store.js';
import { createLimiter } from './rate-limit.js';

const OTP_LIFETIME_MS = 10 * 60 * 1000; // 10 minutes
const RESET_TOKEN_LIFETIME_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_OTP_ATTEMPTS = 5;

const GENERIC_REQUEST_MESSAGE = 'If an eligible Life OS account exists for this email, a verification code has been sent.';

// In-memory rate limiter per IP / email to prevent flooding
const requestLimiter = createLimiter(10, 60000);

export function getPasswordResetSecret() {
  const secret = process.env.PASSWORD_RESET_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'test') {
      return 'test_password_reset_secret_must_be_32_chars_minimum!';
    }
    throw Object.assign(new Error('Password reset service configuration is incomplete.'), { status: 500 });
  }
  return secret;
}

export function generateOTP() {
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function hashEmail(email, secret = getPasswordResetSecret()) {
  return createHmac('sha256', secret).update(normalizeEmail(email)).digest('hex');
}

export function hashOTP(emailHash, otp, secret = getPasswordResetSecret()) {
  return createHmac('sha256', secret).update(`${emailHash}:${otp}`).digest('hex');
}

export function hashResetToken(token, secret = getPasswordResetSecret()) {
  return createHmac('sha256', secret).update(token).digest('hex');
}

export function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

let cachedHtmlTemplate = null;
export function renderOTPEmail(otp) {
  if (!cachedHtmlTemplate) {
    try {
      const templatePath = fileURLToPath(new URL('../email-templates/password-reset.html', import.meta.url));
      cachedHtmlTemplate = readFileSync(templatePath, 'utf8');
    } catch {
      cachedHtmlTemplate = '<!doctype html><html><body><p>Life OS Verification Code: {{OTP}}</p></body></html>';
    }
  }
  const html = cachedHtmlTemplate.replace(/\{\{OTP\}\}/g, otp);
  const text = `Life OS\n\nReset your password\n\nWe received a request to reset your Life OS password.\n\nUse this verification code:\n\n        ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this password reset, you can safely ignore this email.\n\nFor your security, never share this verification code with anyone.\n\nLife OS · Buraq Studios\n`;
  return { html, text };
}

const encodeValue = v => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  return { stringValue: String(v) };
};

export const encodeFirestoreFields = data =>
  Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encodeValue(v)]));

export async function firestoreDocRequest(path, options = {}, { token, fetchImpl = globalThis.fetch } = {}) {
  const accountToken = token || (await adminToken());
  const pid = process.env.FIREBASE_PROJECT_ID || projectId;
  const url = `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/${path}`;
  const res = await fetchImpl(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accountToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(10000)
  });
  if (res.status === 404) return null;
  if (res.status === 204) return {};
  if (!res.ok) {
    throw Object.assign(new Error(`Firestore request failed (${res.status}).`), { status: res.status });
  }
  const json = await res.json();
  if (json.fields) return decode({ mapValue: { fields: json.fields } });
  return json;
}

export async function lookupAuthUser(email, { token, fetchImpl = globalThis.fetch } = {}) {
  const accountToken = token || (await adminToken());
  const pid = process.env.FIREBASE_PROJECT_ID || projectId;
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${pid}/accounts:lookup`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accountToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: [email] }),
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  const user = data.users?.[0];
  if (!user || user.disabled) return null;

  const providers = Array.isArray(user.providerUserInfo)
    ? user.providerUserInfo
    : [];

  const hasPasswordProvider = providers.some(
    p => p?.providerId === 'password'
  );

  const passwordUpdatedAt = Number(user.passwordUpdatedAt);

  const hasPasswordTimestamp =
    Number.isFinite(passwordUpdatedAt) &&
    passwordUpdatedAt > 0;

  const hasPassword =
    hasPasswordProvider ||
    hasPasswordTimestamp;

  console.info('[password-reset.eligibility]', {
    found: !!user,
    hasPasswordProvider,
    hasPasswordTimestamp,
    eligible: hasPassword
  });

  return {
    uid: user.localId,
    email: user.email,
    hasPassword
  };
}

export async function updateAuthPassword(uid, newPassword, { token, fetchImpl = globalThis.fetch } = {}) {
  const accountToken = token || (await adminToken());
  const pid = process.env.FIREBASE_PROJECT_ID || projectId;
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${pid}/accounts:update`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accountToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ localId: uid, password: newPassword }),
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data?.error?.message || '';
    if (msg.includes('WEAK_PASSWORD')) {
      throw Object.assign(new Error('Password must be at least 8 characters long and sufficiently strong.'), { status: 400 });
    }
    throw Object.assign(new Error('Failed to update password.'), { status: 502 });
  }
  return res.json();
}

async function mutate(db,path,change){
  if(db.atomic)return db.atomic(path,change);
  const next=change(await db.get(path));
  if(next!==null)await db.set(path,next);
  return next;
}

/**
 * Step 1: Request 6-digit OTP
 */
export async function requestPasswordReset(rawEmail, overrides = {}) {
  const email = normalizeEmail(rawEmail);
  const now = overrides.now || Date.now();
  const secret = overrides.secret || getPasswordResetSecret();
  const db = overrides.db || {
    atomic: atomicRecord,
    get: path => firestoreDocRequest(path, { method: 'GET' }, overrides),
    set: (path, data) => firestoreDocRequest(path, { method: 'PATCH', body: JSON.stringify({ fields: encodeFirestoreFields(data) }) }, overrides)
  };
  const lookupUser = overrides.lookupUser || (e => lookupAuthUser(e, overrides));
  const sendEmail = overrides.sendEmail || (payload => transport(payload));

  // Basic email validation regex
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { ok: true, message: GENERIC_REQUEST_MESSAGE };
  }

  // Rate limit by email identifier
  if (!overrides.skipRateLimit) {
    try {
      requestLimiter(email, now);
    } catch {
      return { ok: true, message: GENERIC_REQUEST_MESSAGE };
    }
  }

  const emailHash = hashEmail(email, secret);

  // Check existing request in Firestore for cooldown
  let existing = null;
  try {
    existing = await db.get(`passwordResetRequests/${emailHash}`);
  } catch (err) {
    throw Object.assign(Error('Password reset is temporarily unavailable.'),{status:503});
  }

  if (existing && !existing.used && existing.resendAvailableAt && existing.resendAvailableAt > now) {
    // Under cooldown; do not dispatch duplicate email but return generic success
    return { ok: true, message: GENERIC_REQUEST_MESSAGE };
  }

  // Check Firebase Auth user lookup
  let user = null;
  try {
    user = await lookupUser(email);
  } catch (err) {
    console.error('[password-reset.lookup]', {status:err.status||500});
  }

  // If user does not exist or does not have password login, return generic message without sending email
  if (!user || !user.uid || !user.hasPassword) {
    return { ok: true, message: GENERIC_REQUEST_MESSAGE };
  }

  // Generate cryptographically secure 6-digit OTP
  const otp = overrides.mockOTP || generateOTP();
  const otpHash = hashOTP(emailHash, otp, secret);
  const requestId = createHash('sha256').update(`${emailHash}:${now}:${randomBytes(16).toString('hex')}`).digest('hex').slice(0, 32);

  const requestRecord = {
    requestId,
    uid: user.uid,
    emailHash,
    otpHash,
    createdAt: now,
    expiresAt: now + OTP_LIFETIME_MS,
    resendAvailableAt: now + RESEND_COOLDOWN_MS,
    attemptCount: 0,
    verified: false,
    used: false
  };

  const claimed=await mutate(db,`passwordResetRequests/${emailHash}`,old=>old?.resendAvailableAt>now?null:requestRecord);
  if(!claimed)return {ok:true,message:GENERIC_REQUEST_MESSAGE};

  // Send email via Gmail SMTP transport
  const { html, text } = renderOTPEmail(otp);
  const idempotencyKey = createHash('sha256').update(`reset:${emailHash}:${now}:${otpHash}`).digest('hex');

  try {
    await sendEmail({
      channel: 'email',
      to: email,
      subject: 'Life OS · Password reset code',
      text,
      html,
      idempotencyKey
    });
  } catch (err) {
    console.error('[password-reset.mail]', {status:err.status||500});
    // Even if SMTP temporarily fails, do not expose internal failure to the client
  }

  return { ok: true, message: GENERIC_REQUEST_MESSAGE };
}

/**
 * Step 2: Verify OTP and issue 5-minute single-use reset token
 */
export async function verifyPasswordReset(rawEmail, rawCode, overrides = {}) {
  const email = normalizeEmail(rawEmail);
  const code = String(rawCode || '').trim();
  const now = overrides.now || Date.now();
  const secret = overrides.secret || getPasswordResetSecret();
  const db = overrides.db || {
    atomic: atomicRecord,
    get: path => firestoreDocRequest(path, { method: 'GET' }, overrides),
    set: (path, data) => firestoreDocRequest(path, { method: 'PATCH', body: JSON.stringify({ fields: encodeFirestoreFields(data) }) }, overrides),
    del: path => firestoreDocRequest(path, { method: 'DELETE' }, overrides)
  };

  const invalidError = () => Object.assign(new Error('That code is invalid or has expired.'), { status: 400 });

  if (!email || !/^\d{6}$/.test(code)) {
    throw invalidError();
  }

  const emailHash = hashEmail(email, secret);
  const record=await mutate(db,`passwordResetRequests/${emailHash}`,current=>{
    if(!current||current.used||current.verified||!current.expiresAt||now>=current.expiresAt)throw invalidError();
    const attempts=Number(current.attemptCount)||0;
    if(attempts>=MAX_OTP_ATTEMPTS)throw invalidError();
    if(!safeCompare(hashOTP(emailHash,code,secret),current.otpHash))
      return {...current,attemptCount:attempts+1,used:attempts+1>=MAX_OTP_ATTEMPTS};
    return {...current,verified:true,used:true,otpHash:''};
  });
  if(!record.verified)throw invalidError();
  const resetToken=overrides.mockResetToken||randomBytes(32).toString('hex');
  const resetTokenHash=hashResetToken(resetToken,secret);

  // Store reset token session
  const tokenRecord = {
    uid: record.uid,
    emailHash,
    createdAt: now,
    expiresAt: now + RESET_TOKEN_LIFETIME_MS,
    used: false
  };

  await db.set(`passwordResetTokens/${resetTokenHash}`, tokenRecord);

  return { ok: true, resetToken };
}

/**
 * Step 3: Confirm new password using the reset token
 */
export async function confirmPasswordReset(resetToken, newPassword, overrides = {}) {
  const token = String(resetToken || '').trim();
  const password = String(newPassword || '');
  const now = overrides.now || Date.now();
  const secret = overrides.secret || getPasswordResetSecret();
  const db = overrides.db || {
    atomic: atomicRecord,
    get: path => firestoreDocRequest(path, { method: 'GET' }, overrides),
    set: (path, data) => firestoreDocRequest(path, { method: 'PATCH', body: JSON.stringify({ fields: encodeFirestoreFields(data) }) }, overrides),
    del: path => firestoreDocRequest(path, { method: 'DELETE' }, overrides)
  };
  const updateUserPassword = overrides.updateUserPassword || ( (uid, pw) => updateAuthPassword(uid, pw, overrides) );

  const invalidTokenError = () => Object.assign(new Error('Invalid or expired reset token.'), { status: 400 });

  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    throw invalidTokenError();
  }

  if (!password || password.length < 8 || password.length > 128) {
    throw Object.assign(new Error('Password must be at least 8 characters long.'), { status: 400 });
  }

  const resetTokenHash = hashResetToken(token, secret);
  const tokenRecord=await mutate(db,`passwordResetTokens/${resetTokenHash}`,current=>{
    if(!current||current.used||!current.expiresAt||now>=current.expiresAt||!current.uid)throw invalidTokenError();
    return {...current,used:true};
  });

  // Update password in Firebase Authentication backend
  await updateUserPassword(tokenRecord.uid, password);

  // Clean up documents
  try {
    if (db.del) {
      await db.del(`passwordResetTokens/${resetTokenHash}`);

    }
  } catch (err) {
    console.warn('[password-reset.cleanup]', {status:err.status||500});
  }

  return { ok: true, message: 'Password changed successfully.' };
}

/**
 * Express / Vercel HTTP handlers
 */
export async function requestPasswordResetOTPHandler(req, res, overrides = {}) {
  try {
    if(!overrides.db)await persistentLimit(req,'reset-request',3,3600000,getPasswordResetSecret());
    const { email } = req.body || {};
    const result = await requestPasswordReset(email, overrides);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[auth.request.error]', {status:err.status||500});
    return res.status(err.status || 500).json({
      ok: false,
      error: err.status && err.status<500 ? err.message : 'The request could not be processed.'
    });
  }
}

export async function verifyPasswordResetOTPHandler(req, res, overrides = {}) {
  try {
    if(!overrides.db)await persistentLimit(req,'reset-verify',5,60000,getPasswordResetSecret());
    const { email, code } = req.body || {};
    const result = await verifyPasswordReset(email, code, overrides);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 400).json({
      ok: false,
      error: err.status && err.status<500 ? err.message : 'That code could not be checked. Please retry.'
    });
  }
}

export async function confirmPasswordResetHandler(req, res, overrides = {}) {
  try {
    if(!overrides.db)await persistentLimit(req,'reset-confirm',5,60000,getPasswordResetSecret());
    const { resetToken, newPassword } = req.body || {};
    const result = await confirmPasswordReset(resetToken, newPassword, overrides);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 400).json({
      ok: false,
      error: err.status && err.status<500 ? err.message : 'Failed to update password. Request a new code and retry.'
    });
  }
}
