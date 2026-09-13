# Authentication emails and reminders

## Shipped code

- `/reset` is the short address to request a reset email. Firebase sends its
  standard reset message; the request no longer includes an unnecessary
  continue URL that could fail authorized-domain validation.
- `/auth/action` handles Firebase resetPassword and verifyEmail links. Reset
  codes are verified before showing the password form. Passwords must match;
  expired/used links have a recovery path. Untrusted continue URLs are ignored.
- New email/password registrations request a Firebase verification email.
  Profile includes dedicated reset and verification email buttons.
- Reset responses do not reveal whether an email is registered and do not claim
  inbox delivery. Check spam, quotas, the account address and Firebase Auth
  configuration when delivery is absent; an accepted API request is not proof
  of delivery.
- Profile reminder controls now control actual in-app reminders. Optional system
  notifications request browser permission and use a small service worker for
  mobile-compatible notification display. Life OS must remain open; background
  tabs can be throttled. This is not closed-app push.

## Firebase console setup still required

The Firebase plugin is installed but no Firebase administration tools are exposed
in this session. Project template/domain/delivery settings could not be changed.

In Authentication → Templates → Password reset:
- Sender display name: Life OS
- Subject: Reset your Life OS password
- Message: use `email-templates/password-reset.html` if the template editor accepts
  HTML, otherwise use the short equivalent: “Use this link to reset your Life OS
  password: %LINK%. If you didn’t request this, ignore this email.”
- Customize action URL: `https://lifeos53.vercel.app/auth/action`

Firebase applies the custom action URL to verification templates too. The handler
supports both modes. Keep Firebase's generated `%LINK%` intact. Its one-time
`oobCode` and mode parameters are necessary; do not send them through public link
shorteners. A short button label provides a clean email without dropping security
parameters. Sender-domain customization requires ownership/DNS verification of
that sender domain; the Vercel subdomain does not grant email-domain ownership.

Ensure Authentication has Email/Password enabled and Authorized domains includes
`lifeos53.vercel.app` (needed for the app's auth/domain flows). Default reset emails
still work without activating the custom handler.

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
