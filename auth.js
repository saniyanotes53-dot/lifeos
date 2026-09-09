// src/auth.js
// Sign-up, login, Google sign-in, password reset, and session listener
// for Life OS — replaces the demo AuthScreen's onLogin with the real thing.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "./firebase";

const googleProvider = new GoogleAuthProvider();

// Create a new account with email + password, and set their display name.
export async function registerWithEmail(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  return cred.user;
}

// Log in an existing user.
export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// Google sign-in (one click, no password needed).
export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

// Sends a password reset link to the given email via Firebase's own
// email service — no extra API key needed for this part.
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function logout() {
  await signOut(auth);
}

// Subscribe to login state. Call this once, e.g. in your top-level
// App component's useEffect, and store the result in state:
//
//   useEffect(() => onAuthChange(setUser), []);
//
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
