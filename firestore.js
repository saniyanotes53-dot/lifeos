// src/firestore.js
// Read/write helpers for every Life OS collection, scoped per-user under
// users/{uid}/... . Each function mirrors the shape of the local React
// state in the app, so swapping useState for these is a small change.

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy,
} from "firebase/firestore";
import { db } from "./firebase";

// Generic collection ref: users/{uid}/{name}
const col = (uid, name) => collection(db, "users", uid, name);

// Subscribe to a collection in real time. Returns an unsubscribe function.
// Usage:
//   useEffect(() => watchCollection(uid, "tasks", setTasks), [uid]);
export function watchCollection(uid, name, onChange, orderField = "date") {
  const q = query(col(uid, name), orderBy(orderField, "desc"));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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

/* Collection names used across the app — keep these consistent
   with what you pass into watchCollection/addItem/etc:
   "tasks", "sleep", "workouts", "meals", "transactions", "timetable"       */
