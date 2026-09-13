import {doc,setDoc,deleteDoc,getDoc} from 'firebase/firestore';
import {db} from './firebase';
export const notificationSettings=async()=>{const r=await fetch('/api/notify-due?status=1');if(!r.ok)throw Error('Notification service unavailable.');return r.json();};
const pref=uid=>doc(db,'users',uid,'notificationSettings','delivery');
export async function readDeliveryPreferences(uid){return (await getDoc(pref(uid))).data()||{};}
export async function setEmailDelivery(user,enabled){
 if(enabled&&!user.email)throw Error('Your account needs an email address.');
 await setDoc(pref(user.uid),{emailEnabled:enabled,email:user.email||'',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone},{merge:true});
}
const owner=()=>{try{return JSON.parse(localStorage.getItem('lifeos_push_owner')||'null');}catch{return null;}};
function publicKeyBytes(value){const base=value.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(base+'='.repeat((4-base.length%4)%4)),c=>c.charCodeAt(0));}
export async function registerPush(user){
 if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window))throw Error('Background push is not supported by this browser.');
 const previous=owner();
 if(previous&&previous.uid!==user.uid)throw Error('Disable background push in the previous account before switching this browser subscription.');
 const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Allow notifications in Chrome site settings to receive push.');
 const config=await notificationSettings();if(!config.vapidKey)throw Error('The Web Push public key has not been configured yet.');
 await navigator.serviceWorker.register('/notifications-sw.js');const registration=await navigator.serviceWorker.ready;
 let subscription=await registration.pushManager.getSubscription();
 const key=publicKeyBytes(config.vapidKey),existing=subscription?.options?.applicationServerKey;
 if(subscription&&(!existing||new Uint8Array(existing).some((n,i)=>n!==key[i])||existing.byteLength!==key.length)){
  await subscription.unsubscribe();subscription=null;
 }
 if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(subscription.endpoint)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 await setDoc(doc(db,'users',user.uid,'pushSubscriptions',digest),{subscription:subscription.toJSON(),provider:'webpush',enabled:true,updatedAt:Date.now()});
 if(previous&&previous.id!==digest)await deleteDoc(doc(db,'users',user.uid,'pushSubscriptions',previous.id));
 localStorage.setItem('lifeos_push_owner',JSON.stringify({uid:user.uid,id:digest,provider:'webpush'}));
 return config.schedulerEnabled?'Browser registered for background push.':'Browser registered. The Google Apps Script scheduler still needs activation.';
}
export async function unregisterPush(user){
 const previous=owner();
 if(previous?.uid===user.uid){await deleteDoc(doc(db,'users',user.uid,'pushSubscriptions',previous.id));const registration=await navigator.serviceWorker.getRegistration('/');await (await registration?.pushManager.getSubscription())?.unsubscribe();localStorage.removeItem('lifeos_push_owner');}
}
export function pushRegistered(uid){const saved=owner();return saved?.uid===uid&&saved?.provider==='webpush';}
