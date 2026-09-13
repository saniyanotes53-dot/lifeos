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
