import {getToken,deleteToken,onMessage,getMessaging,isSupported} from 'firebase/messaging';
import {app} from './firebase';
import {userRequest} from './assistant/api';
const VAPID_KEY=import.meta.env.VITE_FIREBASE_VAPID_KEY||'BFmI--duNNf3x044TIjwpFW7zwtEPNrf-l1W43RQVj64ft73gTSYGRcUG5RIUi-AqC9D70zyGGPe79amfCETJSM';
async function client(){
  if(typeof Notification==='undefined'||!await isSupported())throw new Error('This browser does not support push notifications.');
  return getMessaging(app);
}
export async function enablePush(user){
  if(!user)throw new Error('Sign in to enable reminders.');
  await userRequest(user,'/api/push-device');
  const messaging=await client();
  if(await Notification.requestPermission()!=='granted')throw new Error('Notifications are blocked. Allow them in your browser settings to enable reminders.');
  const registration=await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  await navigator.serviceWorker.ready;
  const token=await getToken(messaging,{vapidKey:VAPID_KEY,serviceWorkerRegistration:registration});
  if(!token)throw new Error('Could not register this device. Please try again.');
  await userRequest(user,'/api/push-device','POST',{token});
  sessionStorage.setItem('lifeos_push_device',token);
  return token;
}
export async function disablePush(user){
  const token=sessionStorage.getItem('lifeos_push_device');
  try { if(token&&user)await userRequest(user,'/api/push-device','DELETE',{token}); }
  finally { if(await isSupported())await deleteToken(getMessaging(app)); sessionStorage.removeItem('lifeos_push_device'); }
}
export function onForegroundPush(callback){
  let stopped=false,unsubscribe=()=>{};
  isSupported().then(ok=>{if(ok&&!stopped)unsubscribe=onMessage(getMessaging(app),callback);}).catch(()=>{});
  return ()=>{stopped=true;unsubscribe();};
}
