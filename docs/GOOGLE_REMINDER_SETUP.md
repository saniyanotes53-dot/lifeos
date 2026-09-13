# Gmail SMTP + Google Apps Script + Web Push

The delivery backend is Python on Vercel (`/api/deliver`). Gmail SMTP sends email over TLS; standard Web Push sends encrypted browser notifications using your own VAPID keys. No Resend account, custom sending domain, Firebase Cloud Functions, or Firebase Cloud Messaging project configuration is needed for delivery.

**Firebase Authentication and Firestore still hold the existing accounts and records.** The Node reminder jobs read Firestore, check completion/opt-in, acquire delivery receipts and call Python. `FIREBASE_SERVICE_ACCOUNT_JSON` remains necessary for those database operations. Removing Firebase from login/data storage would require an account and data migration; this change does not perform one.

## 1. Configure the Google sender privately

Use a Gmail account you control. Enable Google 2-Step Verification, then create an app password at https://myaccount.google.com/apppasswords. Some managed/Advanced Protection accounts do not offer app passwords. Never use your normal Google password.

On your own computer, from this repository:

```sh
python -m pip install -r requirements.txt
python scripts/configure-notifications.py
```

The script asks for the app password using a hidden terminal prompt. It generates Web Push keys and a cron secret, and writes `lifeos-notification-secrets.json` locally. It does not upload anything. The file is excluded from Git. It refuses to overwrite existing keys; keep the original keys on future deployments so browser subscriptions remain valid. POSIX permissions are owner-only; on Windows also keep the file in your private user directory.

Copy the values into Vercel → **lifeos** → Settings → Environment Variables → **Production**:

| Variable | Type |
|---|---|
| `GMAIL_ADDRESS` | Config |
| `GMAIL_APP_PASSWORD` | Secret |
| `WEB_PUSH_PUBLIC_KEY` | Config |
| `WEB_PUSH_PRIVATE_KEY` | Secret |
| `WEB_PUSH_CONTACT` | Config (`mailto:your-address@gmail.com`) |
| `CRON_SECRET` | Secret |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Secret; existing project `lifeos-61443`, Firestore read/write permission |
| `NOTIFICATION_SCHEDULER_ENABLED` | Config: `true` after scheduler setup |
| `REMINDER_EMAILS_ENABLED` | Config: `true` if daily loan/split emails are wanted |

Gmail sends from `GMAIL_ADDRESS`; this is not a custom-domain sender or an arbitrary From address. Google account sending limits and abuse protections apply. The code does not bypass them.

## 2. Create the Apps Script scheduler

1. Open https://script.google.com/ and create a standalone project named **Life OS reminders**.
2. Replace `Code.gs` with [`scripts/google-apps-script/Code.gs`](../scripts/google-apps-script/Code.gs).
3. In Project settings, show the manifest (`appsscript.json`) and replace it with the included manifest from the same folder.
4. Add Script Properties: `CRON_SECRET` equal to the Vercel secret, and optionally `DAILY_EMAILS_ENABLED` = `true` for daily borrower/lender/split reminders. **Do not put the Gmail app password into Apps Script.**
5. Select and run `setupLifeOSReminders`. Approve Google's authorization for external requests and trigger management. Setup creates one minute trigger and does not send a test email.
6. Apps Script → Triggers should show `runLifeOSReminders`. Executions shows status and HTTP failures. `stopLifeOSReminders` removes this project's Life OS triggers.

The trigger runs the due-reminder endpoint every minute. The daily job runs once per India calendar day when enabled, retrying failed runs. Both use server-side receipts; parallel trigger runs are locked. Vercel's previous daily cron was removed—use only this scheduler and disable any older cron-job.org jobs. Script triggers are approximate and subject to Google's runtime/URL-fetch quotas, not guaranteed real-time scheduling.

## 3. Finish activation and test

- Deploy the existing `timetable.remindAt` ascending collection-group index from `firestore.indexes.json` if not already deployed.
- Redeploy after setting the variables.
- Check `https://lifeos53.vercel.app/api/deliver` for Python transport configuration and `/api/notify-due?status=1` for the full reminder setup. Presence checks do not prove credentials are valid or a trigger is installed.
- Life OS Profile → Notifications: enable email reminders and **re-enable browser push**. Old Firebase Messaging subscriptions must be replaced with the new Web Push subscription.
- Schedule a real task a few minutes ahead. Check Apps Script Executions, Gmail Sent, inbox/spam, and Chrome notifications with the tab closed.
- If Gmail rejects SMTP, inspect the sanitized failure class in Vercel logs, then check 2-Step Verification, app password, sender address and account sending limits. Do not paste private keys, app passwords or authentication tokens into logs/issues/chat.

## Google/email sign-in and password resets

Google sign-in uses OAuth; an SMTP app password cannot activate it. The existing site already uses Firebase's Google and email/password sign-in code. Those providers must be enabled in Firebase Authentication and the site's domain authorized. This update preserves those accounts and authentication flows.

Password reset/verification emails remain Firebase Auth emails. The new SMTP reminder sender does not automatically replace their secure link-generation flow. Welcome templates exist but automatic welcome delivery is not enabled by this change.

## Reliability boundaries

This is a small-volume, best-effort reminder system. Each job handles at most 20 deliveries and tasks due within five minutes. Per-channel receipts suppress ordinary duplicate runs. SMTP Message-ID is stable but is not provider-side idempotency: a timeout after Gmail accepts a message may duplicate it on retry; a crash after acquiring a receipt may lose a reminder. Larger workloads need a durable queue and receipt retention/TTL. Completing/deleting a task or settling a loan/bill stops future selection; a message already in flight cannot be recalled.
