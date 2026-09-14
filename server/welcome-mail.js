import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { projectId, requireUser } from './firebase.js';
import { adminToken, decode } from './reminder-mail.js';
import { transport } from './delivery.js';
import { encodeFirestoreFields, lookupAuthUser } from './password-reset.js';

let cachedWelcomeHtml = null;

export function renderWelcomeEmail(displayName) {
  const trimmed = (displayName || '').trim();
  const firstName = trimmed ? trimmed.split(/\s+/)[0] : '';
  const greeting = firstName ? `Welcome, ${firstName}` : 'Welcome to Life OS';
  const subject = 'Welcome to Life OS · Your calmer day starts here';

  if (!cachedWelcomeHtml) {
    try {
      const templatePath = fileURLToPath(new URL('../email-templates/welcome.html', import.meta.url));
      cachedWelcomeHtml = readFileSync(templatePath, 'utf8');
    } catch {
      cachedWelcomeHtml = `<!doctype html><html><body><h1>{{GREETING}}</h1><p>A calmer day starts here.</p><p><a href="https://lifeos53.vercel.app/">Open Life OS</a></p></body></html>`;
    }
  }

  const html = cachedWelcomeHtml.replace(/\{\{GREETING\}\}/g, greeting);
  const text = `Life OS\n\n${greeting}\n\nA calmer day starts here.\n\nYou can now:\n- organize your day and tasks\n- plan timetable blocks\n- track spending and budgets\n- manage routines available in Life OS\n- use your Life OS assistant\n- receive scheduled reminders\n\nOpen Life OS: https://lifeos53.vercel.app/\n\nLife OS · Buraq Studios\n`;

  return { subject, html, text, greeting };
}

async function defaultFirestoreRequest(path, options = {}) {
  const token = await adminToken();
  const pid = process.env.FIREBASE_PROJECT_ID || projectId;
  const url = `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(10000)
  });
  if (res.status === 404) return null;
  if (res.status === 409 || res.status === 412) return { conflict: true };
  if (res.status === 204) return {};
  if (!res.ok) {
    throw Object.assign(new Error(`Firestore request failed (${res.status}).`), { status: res.status });
  }
  const json = await res.json();
  if (json.fields) return decode({ mapValue: { fields: json.fields } });
  return json;
}

export const defaultWelcomeDb = {
  get: async path => defaultFirestoreRequest(path, { method: 'GET' }),
  claim: async (path, data) =>
    defaultFirestoreRequest(`${path}?currentDocument.exists=false`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: encodeFirestoreFields(data) })
    }),
  set: async (path, data) =>
    defaultFirestoreRequest(path, {
      method: 'PATCH',
      body: JSON.stringify({ fields: encodeFirestoreFields(data) })
    }),
  delete: async path => defaultFirestoreRequest(path, { method: 'DELETE' })
};

/**
 * Sends a single welcome email for an authenticated user with idempotency.
 */
export async function sendWelcomeEmailForUser(userRecord, overrides = {}) {
  const { uid, email, displayName } = userRecord || {};
  if (!uid || typeof uid !== 'string') {
    throw Object.assign(new Error('Invalid user ID.'), { status: 400 });
  }
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw Object.assign(new Error('Invalid user email address.'), { status: 400 });
  }

  const now = overrides.now || Date.now();
  const db = overrides.db || defaultWelcomeDb;
  const sendEmail = overrides.sendEmail || transport;
  const receiptPath = `users/${uid}/emailReceipts/welcome`;

  // Check if welcome email has already been sent
  let existing = null;
  try {
    existing = await db.get(receiptPath);
  } catch (err) {
    console.warn('[welcome-mail.check]', err.message);
  }

  if (existing && (existing.sent || existing.status === 'sent')) {
    return { ok: true, alreadySent: true };
  }

  // If another request claimed recently (<60s) and is in-flight, avoid duplicate send
  if (existing && existing.status === 'pending' && existing.createdAt && now - existing.createdAt < 60000) {
    return { ok: true, alreadySent: true, inProgress: true };
  }

  // Attempt atomic claim using Firestore precondition
  const claim = await db.claim(receiptPath, {
    status: 'pending',
    createdAt: now,
    channel: 'email'
  });

  if (claim?.conflict) {
    // Another concurrent call already claimed the receipt
    return { ok: true, alreadySent: true, inProgress: true };
  }

  const { subject, html, text } = renderWelcomeEmail(displayName);
  const idempotencyKey = createHash('sha256').update(`welcome:${uid}:${normalizedEmail}`).digest('hex');

  try {
    await sendEmail({
      channel: 'email',
      to: normalizedEmail,
      subject,
      text,
      html,
      idempotencyKey
    });
  } catch (err) {
    console.error('[welcome-mail.send]', err.message);
    // Remove pending claim so the user can safely retry later
    try {
      await db.delete(receiptPath);
    } catch (delErr) {
      console.warn('[welcome-mail.cleanup]', delErr.message);
    }
    throw err;
  }

  // Mark sent permanently
  await db.set(receiptPath, {
    status: 'sent',
    sent: true,
    sentAt: now,
    email: normalizedEmail,
    channel: 'email'
  });

  return { ok: true, sent: true };
}

/**
 * Vercel / Express HTTP Handler for POST /api/auth/welcome
 */
export async function welcomeEmailHandler(req, res, overrides = {}) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let authUser;
  try {
    const authFn = overrides.requireUser || requireUser;
    authUser = await authFn(req);
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message || 'Unauthorized' });
  }

  // Securely resolve user properties from verified token
  const uid = authUser.uid;
  const email = authUser.email;
  let displayName = authUser.name || authUser.displayName;

  if (!displayName && overrides.lookupUser) {
    try {
      const info = await overrides.lookupUser(email);
      displayName = info?.displayName;
    } catch {}
  } else if (!displayName && !overrides.skipLookup) {
    try {
      const info = await lookupAuthUser(email);
      displayName = info?.displayName;
    } catch {}
  }

  try {
    const result = await sendWelcomeEmailForUser(
      { uid, email, displayName },
      overrides
    );
    return res.status(200).json(result);
  } catch (err) {
    console.error('[auth.welcome.error]', err.message);
    return res.status(502).json({
      ok: false,
      error: 'Failed to deliver welcome email.'
    });
  }
}
