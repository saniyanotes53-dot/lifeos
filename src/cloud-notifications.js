import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export const notificationSettings = async () => {
  const r = await fetch('/api/notify-due?status=1');
  if (!r.ok) throw Error('Notification service unavailable.');
  return r.json();
};

const pref = uid => doc(db, 'users', uid, 'notificationSettings', 'delivery');

export async function readDeliveryPreferences(uid) {
  return (await getDoc(pref(uid))).data() || {};
}

export async function setEmailDelivery(user, enabled) {
  if (enabled && !user.email) throw Error('Your account needs an email address.');
  await setDoc(pref(user.uid), {
    emailEnabled: enabled,
    email: user.email || '',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  }, { merge: true });
}

export const owner = () => {
  try {
    return JSON.parse(localStorage.getItem('lifeos_push_owner') || 'null');
  } catch {
    return null;
  }
};

export function isPushSupported() {
  return typeof window !== 'undefined' &&
    ('Notification' in window) &&
    ('serviceWorker' in navigator) &&
    ('PushManager' in window);
}

export function pushRegistered(uid) {
  const saved = owner();
  return saved?.uid === uid && saved?.provider === 'webpush';
}

export function getPushState(uid) {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted' && pushRegistered(uid)) return 'on';
  return 'off';
}

function publicKeyBytes(value) {
  const base = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base + '='.repeat((4 - base.length % 4) % 4)), c => c.charCodeAt(0));
}

export async function registerPush(user) {
  if (!isPushSupported()) throw Error('Background push is not supported by this browser.');
  const previous = owner();
  if (previous && previous.uid !== user.uid) {
    throw Error('Disable background push in the previous account before switching this browser subscription.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    window.dispatchEvent(new CustomEvent('lifeos-push-status-change'));
    throw Error('Chrome notifications are blocked for Life OS. Open Chrome site settings → Notifications → Allow.');
  }

  const config = await notificationSettings();
  if (!config.vapidKey) throw Error('The Web Push public key has not been configured yet.');

  await navigator.serviceWorker.register('/notifications-sw.js');
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  const key = publicKeyBytes(config.vapidKey);
  const existing = subscription?.options?.applicationServerKey;

  if (subscription && (!existing || new Uint8Array(existing).some((n, i) => n !== key[i]) || existing.byteLength !== key.length)) {
    await subscription.unsubscribe();
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key
    });
  }

  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(subscription.endpoint))))
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');

  await setDoc(doc(db, 'users', user.uid, 'pushSubscriptions', digest), {
    subscription: subscription.toJSON(),
    provider: 'webpush',
    enabled: true,
    updatedAt: Date.now()
  });

  if (previous && previous.id !== digest) {
    await deleteDoc(doc(db, 'users', user.uid, 'pushSubscriptions', previous.id)).catch(() => {});
  }

  localStorage.setItem('lifeos_push_owner', JSON.stringify({ uid: user.uid, id: digest, provider: 'webpush' }));
  window.dispatchEvent(new CustomEvent('lifeos-push-status-change'));

  return config.schedulerEnabled
    ? 'Browser registered for background push.'
    : 'Browser registered. The Google Apps Script scheduler still needs activation.';
}

export async function unregisterPush(user) {
  const previous = owner();
  if (previous?.uid === user.uid) {
    await deleteDoc(doc(db, 'users', user.uid, 'pushSubscriptions', previous.id)).catch(() => {});
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const sub = await registration?.pushManager?.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch {}
    localStorage.removeItem('lifeos_push_owner');
    window.dispatchEvent(new CustomEvent('lifeos-push-status-change'));
  }
}
