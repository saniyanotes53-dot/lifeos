import {
  collection, doc, setDoc,
  onSnapshot, query, orderBy, runTransaction, getDocs, limit,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import {commitProposal} from "./assistant/commit.js";
import { parseLocalDate } from "./utils/dates";

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
  if (name === "timetable" && parseLocalDate(data.date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(data.time || "")) {
    const when = parseLocalDate(data.date);
    const [h, m] = data.time.split(":").map(Number);
    when.setHours(h, m, 0, 0);
    data = { ...data, remindAt: when.getTime() };
  }
  const ref=doc(col(uid,name));
  await trackedWrite(uid,name,tx=>tx.set(ref,data));
  return ref;
}

export async function updateItem(uid, name, id, patch) {
  return trackedWrite(uid,name,tx=>tx.update(doc(db,"users",uid,name,id),patch));
}

export async function deleteItem(uid, name, id) {
  return trackedWrite(uid,name,tx=>tx.delete(doc(db,"users",uid,name,id)));
}

// A wake-up date identifies a single night's sleep; repeat saves update it.
export async function saveSleep(uid, date, data) {
  return setDoc(doc(db, "users", uid, "sleep", date), { ...data, date });
}

async function trackedWrite(uid,name,write){
 const ref=doc(db,'users',uid);
 return runTransaction(db,async tx=>{const p=await tx.get(ref);write(tx);tx.set(ref,{assistantRevision:(p.data()?.assistantRevision||0)+1},{merge:true});});
}
export async function confirmAssistantProposal(user,input){
 if(!user||auth.currentUser?.uid!==user.uid)throw new Error('Sign in to continue.');
 await user.getIdToken();
 const uid=user.uid,profileRef=doc(db,'users',uid);
 try{return await commitProposal(uid,input,{
  hash:async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join(''),
  records:async name=>(await getDocs(query(col(uid,name),limit(1001)))).docs.map(d=>({id:d.id,...d.data()})),
  transaction:callback=>runTransaction(db,tx=>callback({
   profile:async()=>(await tx.get(profileRef)).data()||{},
   write:c=>{const ref=doc(db,'users',uid,c.collection,c.id);if(c.delete)tx.delete(ref);else tx.set(ref,c.data,{merge:true});},
   saveProfile:patch=>tx.set(profileRef,patch,{mergeFields:Object.keys(patch)})
  }))
 });}catch(e){console.error('[assistant.save]',{code:e.code||'validation'});if(e.code==='permission-denied')throw new Error('Firebase denied this account access. Try adding a task manually too; if that fails, your Firestore account rules need repair. No changes were saved.');throw e;}
}
