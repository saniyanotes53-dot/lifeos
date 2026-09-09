// src/notifications.js
// Requests permission and gets a device token for push notifications.
// Requires: firebase-messaging-sw.js in your /public folder (included in
// this handoff) and a VAPID key from Firebase Console → Project Settings →
// Cloud Messaging → Web configuration → "Generate key pair".

import { getToken, onMessage } from "firebase/messaging";
import { messaging } from "./firebase";

const VAPID_KEY = "BFmI--duNNf3x044TIjwpFW7zwtEPNrf-l1W43RQVj64ft73gTSYGRcUG5RIUi-AqC9D70zyGGPe79amfCETJSM";

// Call this after login, e.g. from a "Enable reminders" button.
// Returns the device token (save it to Firestore under the user's doc so
// a backend function can send pushes to it later), or null if denied.
export async function enablePush() {
  if (!messaging) return null;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;
  const token = await getToken(messaging, { vapidKey: VAPID_KEY });
  return token;
}

// Listens for pushes that arrive while the app is open in the foreground.
export function onForegroundPush(callback) {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
