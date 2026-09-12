# Life OS assistant setup

The implementation is local and has not been pushed or deployed. The active project is the repository root, not the legacy `lifeos/` subdirectory.

## Included

- **Assistant navigation:** responsive chat, suggested prompts, a planning panel, report summaries, and notification controls.
- **Built-in planner:** orders open tasks by priority, avoids existing blocks, leaves five-minute breaks, and shows tasks that do not fit. Existing blocks without duration reserve 30 minutes. It never changes records until Apply plan is clicked.
- **Atomic timetable apply:** Firebase-authenticated API rechecks live tasks and timetable in a Firestore transaction. Stable IDs make retries idempotent. It does not overwrite existing blocks. The server needs Firebase Admin credentials before Apply works.
- **Tencent chat:** official `@tencentcloud/chat` Web Core SDK, dynamically loaded on connection, with server-generated short-lived UserSig credentials. No Tencent secret or admin signature is exposed to the browser. Account IDs are derived from verified Firebase identities.
- **Custom AI replies:** Gemini generates advice on the server; replies are delivered to the current user through Tencent's server API. The bot has no database mutation tools. Scheduling is handled by the reviewed plan action. Cloud conversations share only typed messages and the latest 12 cloud turns with Tencent and Gemini; built-in report data is not automatically uploaded.
- **Push reminders:** device registration, Firebase Messaging service worker, foreground banner, notification click-through, and a protected reminder dispatcher. New assistant and manually created timetable entries include an absolute reminder timestamp. Older entries are not silently assigned a timezone or migrated.

## Server configuration

Set these in the hosting provider's server environment. Do not prefix secrets with `VITE_`, paste them in chat, or commit them.

| Variable | Purpose |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin service-account JSON for the existing Life OS Firebase project; required for schedule apply, chat authentication, and push. |
| `TENCENT_SDK_APP_ID` | Tencent Chat application ID. |
| `TENCENT_CHAT_SECRET_KEY` | Tencent application's server-side UserSig secret. |
| `TENCENT_ADMIN_USER_ID` | Tencent Chat administrator account authorized for the server messaging API. |
| `TENCENT_BOT_USER_ID` | Registered Tencent Chat bot account used as message sender and recipient. |
| `GEMINI_API_KEY` | Server-side Google Gemini API key. |
| `GEMINI_MODEL` | A generateContent-compatible text model enabled for that Google account. No paid model is selected automatically. |
| `CRON_SECRET` | A strong random secret required as `Authorization: Bearer <secret>` when invoking `/api/reminders`. |
| `REMINDERS_ENABLED` | Set `true` only after the scheduler and Firestore index are configured. |
| `VITE_FIREBASE_VAPID_KEY` | Optional public Firebase Web Push certificate key. Existing project's public key is the fallback. |

Create/import the bot account and administrator in the Tencent Chat application. Enable one-to-one messaging and confirm the application region supports the `console.tim.qq.com` REST endpoint used in `server/bot.js`. This implementation provides its own AI reply endpoint; it does not require a Tencent callback webhook. Keep the app's Tencent message retention policy and Google model billing/quotas in mind. The chat free tier is separate from AI model and hosting charges.

Firebase Admin uses the existing Firebase project. Preserve the current per-user Firestore rules. `_pushDevices`, `_chatLimits`, and `_reminderDeliveries` are server-only collections and must not be opened to browser clients. Deploy the collection-group `remindAt` index from `firestore.indexes.json` before activating reminders. A TTL policy for `_reminderDeliveries.expiresAt` can clean up old delivery receipts.

## Scheduling push delivery

Run an authenticated GET to `/api/reminders` every minute using a scheduler supported by the hosting plan. An example Vercel cron entry is supplied in `docs/vercel-cron.example.json`; merge it into the existing configuration only when ready to deploy. No cron is activated by this change.

The dispatcher looks back five minutes, processes at most 200 due entries per invocation, claims each delivery, skips completed/deleted entries, and removes expired device tokens. It uses a generic notification body to avoid exposing task titles on a lock screen. Push is best effort: browser permission, OS delivery policies, network access, and a functioning scheduler are required. Delivery leases reduce duplicates but cannot guarantee exactly-once delivery after a crash. A scheduler outage longer than five minutes can miss reminders. High-volume deployments should move dispatch into a queue with per-device retry tracking and pagination. Do not enable the old nested project's reminder scheduler alongside this dispatcher.

Users must opt in on each browser. Disable reminders deregisters the current token; logout also attempts token removal and invalidates the browser token. Existing legacy `pushTokens` documents are not used by the new dispatcher. Re-enabling on a device assigns it to the currently signed-in account. iOS browser push availability depends on platform requirements, including installed web-app support where applicable.

## Validation

Run `npm ci`, `npm test`, and `npm run build` from the root. The automated suite covers 16 cases: original analytics regressions, planner priorities/conflicts/past dates, missing-data reporting, API authentication, cron authentication, Tencent identity isolation, and mocked AI/delivery payloads. No real Tencent, Gemini, FCM, or Firebase Admin call was made during tests.

Before release, test with staging credentials:

1. Sign in as two different users and confirm isolated chat and timetable records.
2. Generate a plan, change an overlapping block in another session, and verify Apply rejects the stale proposal. Re-applying a saved plan should not duplicate entries.
3. Connect cloud chat; check send, reply, disconnect, reconnect, and unavailable-provider errors.
4. Opt into reminders, schedule a near-future activity, check foreground and background delivery, click-through, opt-out, and logout.
5. Inspect 320/375/768/1366-pixel layouts, keyboard controls, and the report print view.

Browser visual verification and live service tests are pending. The build retains Vite's large-chunk advisory; Tencent itself is lazy-loaded as a separate chunk.

## Primary references

- Tencent SDK repository: https://github.com/TencentCloud/TIMSDK
- UserSig library: https://github.com/tencentyun/tls-sig-api-v2-node
- Web SDK APIs: installed package `node_modules/@tencentcloud/chat/index.d.ts`
- Firebase browser messaging: https://firebase.google.com/docs/cloud-messaging/web/receive-messages
- Gemini REST generation: https://ai.google.dev/api
