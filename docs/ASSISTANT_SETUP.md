# Life OS assistant: direct Gemini setup

The assistant now talks directly to Gemini through Vercel. Tencent, Sendbird,
Firebase Cloud Functions, a Blaze upgrade, a service-account key and a cron
scheduler are not required by this implementation.

## Vercel setup

Use the repository root as Root Directory, Vite as Framework Preset,
`npm run build` as Build Command and `dist` as Output Directory.
The root `api/` folder must be deployed along with the frontend.

Set these environment variables for Production (and Preview if testing a branch):

| Name | Value |
| --- | --- |
| `GEMINI_API_KEY` | Your Google AI Studio key, saved as a server secret. |
| `GEMINI_MODEL` | Your available generateContent text model; defaults to `gemini-2.5-flash-lite` when omitted. |
| `FIREBASE_PROJECT_ID` | Optional; defaults to this app's existing project, `lifeos-61443`. Only change it together with `src/firebase.js`. |

Keep the existing Gemini variables if you already saved them. Redeploy after
changing environment variables. Never prefix the Gemini key with `VITE_` or put
it in source code. Old Tencent, cron, VAPID and `FIREBASE_SERVICE_ACCOUNT_JSON`
variables are no longer used by the assistant. They can be removed from Vercel.

## How it works

- **Chat:** a verified Firebase ID token authenticates `/api/bot-reply`. Gemini
  receives only the typed message and up to 12 recent AI conversation turns.
  Weekly records are not automatically sent to Google. The reply returns in
  the same HTTP request; there is no separate chat connection.
- **Planning:** “Plan my day” or Suggest timetable creates a local preview from
  open tasks. Only Apply saves it. `/api/apply-plan` uses the user's Firebase
  token with the Firestore REST API, so existing user-ownership Security Rules
  apply. One transaction checks current tasks and that day's timetable before
  creating blocks. Conflicts require a fresh plan; retries do not overwrite
  or duplicate previously created blocks.
- **Reports:** Analyze my week summarizes saved records locally, without an AI
  request and without filling in missing records with invented numbers.
- **Reminders:** enable in Assistant or Timetable. Alerts appear inside Life OS
  across screens while it is open and visible. Checks run about every 15 seconds
  and when returning to the page; only the last five minutes are caught up.
  Completed blocks/tasks are skipped. Sleeping/closed devices do not receive
  background push. The preference is per user and browser; logout disables it.

The small `jose` library validates Firebase token signatures with Google's
public keys, checking the project, issuer, expiry and authentication time.
No Firebase Admin package, admin credential or Firestore rules bypass is used. Revocation/account-disabled
lookups are not performed; an already issued token can remain valid until its
normal expiry (typically one hour).

## Free-tier limits and troubleshooting

Gemini, Firestore and Vercel still have their own usage limits. The chat has a
best-effort 10 requests/minute/user throttle per server instance, not a shared
quota or billing cap. Keep Google billing disabled if you want to remain on
its unpaid tier. No paid model fallback is selected automatically.

- **Gemini usage limit reached:** retry later; local planning/reports still work.
- **Gemini rejected configuration:** check the key and model in Vercel, then redeploy.
- **Model unavailable:** choose a model available to your key and update `GEMINI_MODEL`.
- **Please sign in again:** sign out and back in to refresh authentication.
- **Saving blocked by Firestore:** check `firestore.rules` against the rules
  published in Firebase Console. Never solve this by allowing public access.
- **Assistant API unavailable:** confirm Vercel builds the repository root,
  including `api/`, rather than the legacy nested `lifeos/` folder or just `dist`.

## Verification

Run `npm ci`, `npm test`, `npm run build`. Tests mock external services and cover
unauthenticated requests, direct replies, provider errors, throttling, atomic
plan saving, conflicts, retries, local reminder timing and existing analytics.
Live Gemini replies and Firestore rules still require a signed-in smoke test:

1. Open Assistant and send “Give me three tips to focus.”
2. Add an open task, suggest a future timetable and press Apply once.
3. Confirm the block in Timetable, enable reminders and keep the page visible
   until its scheduled time. Switch to another screen to check the global alert.

Primary references:
- https://firebase.google.com/docs/auth/admin/verify-id-tokens
- https://firebase.google.com/docs/firestore/use-rest-api
- https://ai.google.dev/gemini-api/docs/pricing
- https://vercel.com/docs/environment-variables/managing-environment-variables

## Recovery on 2026-09-12

Restored the Firebase application from before the Supabase migration in commit
`3bd0410`. The pre-recovery repository is retained in branch
`backup/before-firebase-recovery`. This restores source code only; no Firebase
or Supabase database was deleted or modified during recovery.
