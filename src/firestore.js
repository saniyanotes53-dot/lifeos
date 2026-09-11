import {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  onSnapshot, query, orderBy,
} from "firebase/firestore";
import { db } from "./firebase";

const col = (uid, name) => collection(db, "users", uid, name);

export function watchCollection(uid, name, onChange, orderField = null) {
  const collectionRef = col(uid, name);
  const q = orderField ? query(collectionRef, orderBy(orderField, "desc")) : collectionRef;
  let fallbackUnsub = null;
  const unsub = onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.warn(`Query with orderBy('${orderField}') on ${name} encountered an error:`, err);
    if (orderField && !fallbackUnsub) {
      fallbackUnsub = onSnapshot(collectionRef, (fallbackSnap) => {
        onChange(fallbackSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    }
  });
  return () => { unsub(); if (fallbackUnsub) fallbackUnsub(); };
}

export async function ensureUserProfile(user) {
  return setDoc(doc(db, "users", user.uid), {
    email: user.email || null,
    displayName: user.displayName || user.email?.split("@")[0] || "User",
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export async function addItem(uid, name, data) {
  return addDoc(col(uid, name), data);
}

export async function updateItem(uid, name, id, patch) {
  return updateDoc(doc(db, "users", uid, name, id), patch);
}

export async function deleteItem(uid, name, id) {
  return deleteDoc(doc(db, "users", uid, name, id));
}
