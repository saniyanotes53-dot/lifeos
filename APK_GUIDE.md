# Life OS — Web App → Android APK (using Capacitor)

This turns your merged React/Vite + Firebase web app into a real installable
Android app. Capacitor is free and open-source (from the Ionic team) — it
wraps your existing web app in a native Android shell, so you keep all the
code you already have.

Do this *after* the Firebase merge is done and working in the browser.

## Prerequisites (one-time installs on your computer)
- **Node.js** — you already have this if `npm` has been working.
- **Android Studio** — free, from developer.android.com/studio. Installing
  it also installs the Android SDK you'll need, so just accept the default
  setup options.
- **Java JDK 17** — Android Studio usually bundles this; if `npx cap open
  android` complains about Java later, install Temurin JDK 17 separately.

## Step 1 — Install Capacitor in your project
From your project root (where `package.json` lives):
```
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init
```
When asked:
- App name: `Life OS`
- App ID: `com.buraqstudios.lifeos` (reverse-domain style, lowercase, no spaces — this becomes your app's unique package ID, can't change later easily)

## Step 2 — Build your web app
```
npm run build
```
This creates a `dist/` (or `build/`) folder — Capacitor packages *this*, not your source code.

## Step 3 — Add the Android platform
```
npx cap add android
```
This generates a full native `android/` project folder alongside your web code.

## Step 4 — Point Capacitor at your build output
Open `capacitor.config.json` (created in Step 1) and confirm:
```json
{
  "appId": "com.buraqstudios.lifeos",
  "appName": "Life OS",
  "webDir": "dist"
}
```
(Use `"build"` instead of `"dist"` if that's what your bundler outputs.)

## Step 5 — Sync and open in Android Studio
```
npx cap sync
npx cap open android
```
This launches Android Studio with your project already loaded.

## Step 6 — Run it on a device/emulator (to test)
In Android Studio: click the green ▶ Run button. Either:
- Plug your Android phone in via USB with "USB debugging" enabled (Settings → About phone → tap "Build number" 7 times → Developer options → USB debugging), or
- Use the built-in emulator (Android Studio → Device Manager → create a virtual device)

## Step 7 — Generate the actual APK
In Android Studio menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
When it finishes, click the notification link "locate" — your file will be at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```
This debug APK installs and runs fine on any Android phone (enable "install from unknown sources" when you open the file) — good for personal use and testing.

## Step 8 — (Optional) Signed release APK, for sharing/publishing
A debug APK works for you personally, but if you ever want to share it widely or publish to the Play Store, you need a **signed release build**:
1. Build → Generate Signed Bundle / APK → APK
2. Create a new keystore (a password-protected file that proves the app is really from you) — save this file and its password somewhere safe, you'll need the exact same one for every future update
3. Choose "release" build variant → Finish
4. Output lands at `android/app/release/app-release.apk`

## A few things worth knowing before you start
- **Every code change** (UI tweaks, new features) needs `npm run build` → `npx cap sync` again before it shows up in the APK — Capacitor doesn't auto-watch your source.
- **Firebase Auth's Google Sign-In** needs one extra config step for native apps — you'll need to add your app's SHA-1 fingerprint to the Firebase console (Project Settings → your Android app → add fingerprint). Android Studio can show you this fingerprint under Gradle → app → Tasks → android → signingReport.
- **Push notifications** work the same way inside the wrapped app as they do in the browser — no extra Capacitor plugin needed for the setup we already built, since it's still running as a web view under the hood.
- This whole process (Steps 1–7) is exactly the kind of task Antigravity, Claude Code, or Codex can run for you if you hand them this guide — they can execute all the terminal commands, you just do the physical device/keystore parts and any Android Studio button clicks that need a GUI.
