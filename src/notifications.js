import { getToken, onMessage } from "firebase/messaging";
import { messaging } from "./firebase";

const VAPID_KEY = "BFmI--duNNf3x044TIjwpFW7zwtEPNrf-l1W43RQVj64ft73gTSYGRcUG5RIUi-AqC9D70zyGGPe79amfCETJSM";

export async function enablePush() {
  if (!messaging) return null;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;
  const token = await getToken(messaging, { vapidKey: VAPID_KEY });
  return token;
}

export function onForegroundPush(callback) {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
