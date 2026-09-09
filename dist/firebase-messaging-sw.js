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
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "Life OS", {
    body: body || "",
    icon: "/icon-192.png",
  });
});
