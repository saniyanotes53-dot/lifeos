import {doc,setDoc,deleteDoc,getDoc} from 'firebase/firestore';
import {app,db} from './firebase';
export const notificationSettings=async()=>{const r=await fetch('/api/notify-due?status=1');if(!r.ok)throw Error('Notification service unavailable.');return r.json();};
const pref=uid=>doc(db,'users',uid,'notificationSettings','delivery');
export async function readDeliveryPreferences(uid){return (await getDoc(pref(uid))).data()||{};}
export async function setEmailDelivery(user,enabled){
 if(enabled&&!user.email)throw Error('Your account needs an email address.');
 await setDoc(pref(user.uid),{emailEnabled:enabled,email:user.email||'',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone},{merge:true});
}
export async function registerPush(user){
 if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window))throw Error('Background push is not supported by this browser.');
 const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Allow notifications in Chrome site settings to receive push.');
 const config=await notificationSettings();if(!config.vapidKey)throw Error('The Firebase Web Push public key has not been configured yet.');
 const {getMessaging,getToken,isSupported}=await import('firebase/messaging');if(!await isSupported())throw Error('This browser does not support Firebase push.');
 const registration=await navigator.serviceWorker.register('/notifications-sw.js');await navigator.serviceWorker.ready;
 const token=await getToken(getMessaging(app),{vapidKey:config.vapidKey,serviceWorkerRegistration:registration});
 if(!token)throw Error('Chrome did not return a push subscription.');
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 // A browser subscription belongs to one signed-in account at a time.
 const previous=JSON.parse(localStorage.getItem('lifeos_push_owner')||'null');
 if(previous&&previous.uid!==user.uid)throw Error('Disable background push in the previous account on this browser before switching its subscription.');
 await setDoc(doc(db,'users',user.uid,'pushSubscriptions',digest),{token,enabled:true,updatedAt:Date.now()});
 localStorage.setItem('lifeos_push_owner',JSON.stringify({uid:user.uid,id:digest}));
 return config.schedulerEnabled?'Browser registered for background push.':'Browser registered. The server scheduler still needs activation.';
}
export async function unregisterPush(user){
 const previous=JSON.parse(localStorage.getItem('lifeos_push_owner')||'null');
 if(previous?.uid===user.uid){await deleteDoc(doc(db,'users',user.uid,'pushSubscriptions',previous.id));const {getMessaging,deleteToken}=await import('firebase/messaging');await deleteToken(getMessaging(app));localStorage.removeItem('lifeos_push_owner');}
}
export function pushRegistered(uid){try{return JSON.parse(localStorage.getItem('lifeos_push_owner')||'null')?.uid===uid;}catch{return false;}}
