import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  getAdditionalUserInfo,
  onAuthStateChanged,
  signOut,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import { auth } from "./firebase.js";

const googleProvider = new GoogleAuthProvider();

export async function sendWelcomeEmail(user) {
  if (!user || typeof user.getIdToken !== "function") return { ok: false };
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/auth/welcome", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      }
    });
    const data = await res.json().catch(() => ({}));
    return data;
  } catch (err) {
    console.warn("[auth.welcome]", err.message);
    return { ok: false, error: err.message };
  }
}

export async function registerWithEmail(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  sendEmailVerification(cred.user).catch(error => console.warn('[auth.verification]', { code: error.code }));
  sendWelcomeEmail(cred.user).catch(err => console.warn('[auth.welcome]', err.message));
  return cred.user;
}

export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  const additional = getAdditionalUserInfo(cred);
  if (additional?.isNewUser) {
    sendWelcomeEmail(cred.user).catch(err => console.warn('[auth.welcome]', err.message));
  }
  return cred.user;
}

export async function requestPasswordResetOTP(email) {
  const res = await fetch('/api/auth/password-reset/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: (email || '').trim() })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to request verification code.');
  }
  return data;
}

export async function verifyPasswordResetOTP(email, code) {
  const res = await fetch('/api/auth/password-reset/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: (email || '').trim(), code: (code || '').trim() })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'That code is invalid or has expired.');
  }
  return data;
}

export async function confirmPasswordReset(resetToken, newPassword) {
  const res = await fetch('/api/auth/password-reset/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resetToken: (resetToken || '').trim(), newPassword })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update password.');
  }
  return data;
}

// Alias for backwards compatibility if needed
export const resetPassword = requestPasswordResetOTP;

export async function logout() {
  await signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
