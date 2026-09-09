# Life OS — Firebase integration handoff

These files wire your Life OS UI to a real Firebase backend: accounts,
per-user data storage, and push notifications. Give this whole folder to
Claude Code along with your `lifeos-app.jsx` UI file and ask it to merge
them — it can run `npm install`, wire the imports, and test it live.

## 1. Install dependencies
```
npm install firebase
```

## 2. Files in this folder
- `src/firebase.js` — connects to your project (`lifeos-61443`), already
  filled in with your config.
- `src/auth.js` — register, login, Google sign-in, password reset, logout.
- `src/firestore.js` — save/load tasks, sleep, workouts, meals,
  transactions, timetable — each scoped to the logged-in user.
- `src/notifications.js` — turns on push notifications and returns a
  device token.
- `public/firebase-messaging-sw.js` — required background-notification
  file. Must stay at the project root's `/public` folder.
- `firestore.rules` — locks the database so users can only see their own
  data. Paste into Firebase Console → Firestore Database → Rules → Publish.

## 3. One key left to fill in
Open `src/notifications.js` and replace:
```
const VAPID_KEY = "PASTE_YOUR_VAPID_KEY_HERE";
```
Get it from Firebase Console → ⚙️ Project Settings → Cloud Messaging tab →
Web configuration → **Generate key pair**.

## 4. Wiring into the UI
In your main app file, replace the demo bits:
- `AuthScreen`'s `onLogin` → call `registerWithEmail` / `loginWithEmail` /
  `loginWithGoogle` from `auth.js` instead of just setting a name string.
- Top-level `useEffect(() => onAuthChange(setUser), [])` to keep the user
  logged in across refreshes.
- Each `useState` list (`tasks`, `sleep`, `tx`, etc.) → swap for
  `watchCollection(uid, "tasks", setTasks)` so data syncs live from
  Firestore instead of living only in memory.
- Add/toggle/delete task functions → call `addItem` / `updateItem` /
  `deleteItem` from `firestore.js` instead of just editing local state.
- The "Enable" button on the Timetable screen → call `enablePush()` from
  `notifications.js`, save the returned token to the user's Firestore doc.

## 5. Real cross-device push (optional, later)
`enablePush()` gets you a device token, but something needs to actually
*send* the push at the scheduled time — that requires a small server
function (Firebase Cloud Functions, free tier: 2M invocations/month) that
checks each user's timetable and calls the FCM Admin SDK. Ask me or
Claude Code to build this once the rest is working — it's a separate,
optional step.

## Free tier limits (Spark plan) — plenty for personal use
- Firestore: 50K reads / 20K writes / 1GB storage per day
- Authentication: unlimited email/password + Google sign-ins
- Cloud Messaging: unlimited, free
- Cloud Functions: 2M invocations/month (only needed for step 5)
