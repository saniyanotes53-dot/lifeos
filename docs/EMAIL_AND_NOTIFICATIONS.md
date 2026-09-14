# Current reminder setup

**The Resend/FCM configuration below is superseded for reminder delivery.** Follow [Gmail SMTP + Google Apps Script + Web Push](GOOGLE_REMINDER_SETUP.md). Firebase Authentication and Firestore remain in use. The authentication-email guidance below still applies.

# Authentication emails and reminders

## Shipped code

- `/reset` is the in-app password reset screen using a secure 6-digit OTP system.
  Firebase password-reset links have been completely replaced.
- The user enters their email, receives a 6-digit numeric OTP via Gmail SMTP (expires in 10 minutes),
  enters and verifies the code in Life OS, receives a short-lived one-time reset token,
  and updates their Firebase Authentication password directly via the secure server backend.
- Generic responses are returned on password reset requests to prevent user enumeration.
- Endpoints:
  - `POST /api/auth/password-reset/request`
  - `POST /api/auth/password-reset/verify`
  - `POST /api/auth/password-reset/confirm`
- One-time Welcome Email:
  - Genuinely new users receive a one-time welcome email via existing Gmail SMTP upon registration
    or first-time Google sign-in.
  - Endpoint `POST /api/auth/welcome` verifies the Firebase ID token and uses atomic Firestore receipts
    at `users/{uid}/emailReceipts/welcome` for idempotency.
- Profile reminder controls manage in-app and background reminders.
- Background delivery uses Gmail SMTP and Web Push.

## Welcome emails, alert emails and closed-app push

The welcome and reminder HTML templates are ready in `email-templates/`, but no
custom mail sender is configured. Firebase's Trigger Email extension needs an SMTP
provider and a Blaze project, which is outside this app's current Spark setup.
An alternative is a transactional mail provider called from Vercel, requiring its
API key and verified sender. Do not claim welcome/digest emails are enabled until
that sender and an opt-in delivery schedule are actually configured.

Closed-app push needs a push subscription/VAPID configuration and a trusted sender
with a scheduler. Gemini access alone does not provide these. No paid plan or
billing settings were enabled by this update.

## Check without changing an account password

Open `/reset`, request one email for your own registered address, then inspect
Inbox/Spam. If testing a configured custom handler, opening its link should show
the branded reset screen; stop before changing the password unless you intend to
change it. Never paste reset codes or passwords into issue reports or logs.

## Daily loan and split-bill emails

The `/api/reminder-emails` Vercel cron runs daily at 08:00 UTC. It is disabled until ALL of these production variables are configured:

- `RESEND_API_KEY`: secret, from Resend.
- `EMAIL_FROM`: verified sender, e.g. `Life OS <reminders@your-domain.com>` (use a real domain you control).
- `FIREBASE_SERVICE_ACCOUNT_JSON`: secret JSON for **lifeos-61443**, with Firestore read access. Never add this to a VITE variable or source control.
- `CRON_SECRET`: long random secret for authenticating the cron request.
- `REMINDER_EMAILS_ENABLED`: `true` only after verifying the sender and a test recipient.

Status is available at `/api/reminder-emails?status=1`; it shows configuration presence, not a delivery guarantee. Each loan/bill also needs the owner to enable its reminder checkbox. Emails are sent individually, contain the recipient's balance, and stop when the owner marks the record paid or disables reminders. Loan email is the contact's email (borrower for money lent; lender for money borrowed). Split bills send each participant their share and relevant dues. No payments are collected.

Initial bounded capacity: 1,000 records per collection and 20 recipient emails per daily run. Exceeding capacity stops the run with a logged error; add pagination/queueing before increasing it. Provider idempotency keys prevent duplicate sends on retries within its 24-hour window. Check Resend delivery/bounce logs: an accepted API request does not guarantee inbox delivery. A verified sender and recipient contact workflow are required before enabling production sending.

### Password reset still missing

Password resets use Firebase Authentication's own sender, independently of these reminder variables. Inspect Authentication → Users to verify the exact address and enabled email/password provider, then Authentication → Templates → Password reset. Use the console's reset-password action for that known account to distinguish app requests from provider delivery. Review spam/quota restrictions and the exact browser Firebase error code. Custom action URLs must retain Firebase's one-time query parameters. The code cannot repair sender/template settings without console administration access. Do not loosen Firestore rules to troubleshoot Authentication email.

## Background browser push and timed task emails

Implemented in Profile → Email & Reminders → Reminders outside Life OS. These controls show actual configuration status. Browser push uses Firebase Cloud Messaging and a push-event service worker; it does not need an open Life OS tab. Device/browser notification settings still apply. Account-level email opt-in sends to the account's email. Old reminders without `remindAt` need resaving through the timetable UI.

Production setup (credentials go only in Vercel, never chat or source):

1. Firebase project `lifeos-61443` → Project settings → Cloud Messaging → Web Push certificates → Generate key pair. Set the **public** key as `FCM_VAPID_PUBLIC_KEY` in Vercel. Enable FCM HTTP v1 and Registration APIs if disabled.
2. Set `FIREBASE_SERVICE_ACCOUNT_JSON` as a secret for the same project, with Firestore read/write and Firebase Cloud Messaging send permissions. This server credential is not the web Firebase config or Gemini key.
3. For emails, set `RESEND_API_KEY` and verified `EMAIL_FROM`. This is independent of Firebase Auth's password reset email sender.
4. Set a random `CRON_SECRET`. Deploy the timetable `remindAt` collection-group index in `firestore.indexes.json` (Firebase CLI: `firebase deploy --only firestore:indexes --project lifeos-61443`; or add an ascending collection-group index for timetable/remindAt in the console).
5. Create a scheduler at https://cron-job.org/ pointing to `https://lifeos53.vercel.app/api/notify-due`, every minute, with HTTP header `Authorization: Bearer YOUR_CRON_SECRET`. Never put the secret in the URL. Vercel Hobby's daily cron cannot deliver minute-by-minute reminders. Use only one scheduler.
6. Set `NOTIFICATION_SCHEDULER_ENABLED=true` and redeploy after configuring the job. Check `/api/notify-due?status=1`. This reports configured/enabled state; it cannot prove a scheduler exists or delivery succeeded.
7. In Life OS Profile enable background browser push, accept Chrome's permission, and enable email reminders. Schedule a real task a few minutes ahead, close the tab, and verify browser/email delivery. Review scheduler execution logs and provider delivery logs if either fails.

The endpoint authenticates scheduler requests, checks recent due blocks and linked task completion, and sends only opted-in channels. Per-event/channel receipts suppress repeated runs; stable notification tags collapse duplicate displays. Expired FCM tokens are removed. A failed provider request releases its receipt for retry. A process crash after claiming a receipt can lose a reminder; this initial scheduler is best-effort, not a guaranteed delivery queue. The active window is five minutes and a run accepts at most 20 deliveries; larger workloads need a durable queue. Receipt retention/TTL should be configured as usage grows. No emails or push tests were sent during implementation.
