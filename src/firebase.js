import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyB1xpFcAmnlgy8tdtj-VOHsbgHnVnWmYCY",
  authDomain: "lifeos-61443.firebaseapp.com",
  projectId: "lifeos-61443",
  storageBucket: "lifeos-61443.firebasestorage.app",
  messagingSenderId: "229739640863",
  appId: "1:229739640863:web:4c6d219516987b563afd2a",
  measurementId: "G-TMZMFRBTBB",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export let messaging = null;
isSupported().then((ok) => {
  if (ok) messaging = getMessaging(app);
});
