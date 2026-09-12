self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL("/?view=timetable", self.location.origin).href;
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(url); return existing.focus(); }
    return clients.openWindow(url);
  })());
});
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyB1xpFcAmnlgy8tdtj-VOHsbgHnVnWmYCY",
  authDomain: "lifeos-61443.firebaseapp.com",
  projectId: "lifeos-61443",
  storageBucket: "lifeos-61443.firebasestorage.app",
  messagingSenderId: "229739640863",
  appId: "1:229739640863:web:4c6d219516987b563afd2a",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // Firebase displays notification payloads automatically; display data-only reminders once.
  if (payload.notification) return;
  const data = payload.data || {};
  return self.registration.showNotification(data.title || "Life OS", {
    body: data.body || "You have a new reminder.", tag: data.tag,
    data: { url: "/?view=timetable" }
  });
});
