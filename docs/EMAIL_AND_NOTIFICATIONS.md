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
