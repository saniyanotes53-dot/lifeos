import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy,
} from "firebase/firestore";
import { db } from "./firebase";

const col = (uid, name) => collection(db, "users", uid, name);

export function watchCollection(uid, name, onChange, orderField = null) {
  const collectionRef = col(uid, name);
  const q = orderField ? query(collectionRef, orderBy(orderField, "desc")) : collectionRef;
  
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.warn(`Query with orderBy('${orderField}') on ${name} encountered an error:`, err);
    // Graceful fallback to unordered collection snapshot if index is building or field missing
    if (orderField) {
      return onSnapshot(collectionRef, (fallbackSnap) => {
        onChange(fallbackSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    }
  });
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
