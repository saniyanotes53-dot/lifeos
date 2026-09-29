# Groq connection setup

Gemini remains available. Groq runs through the existing private Python delivery endpoint, now a FastAPI application, without an additional Vercel function.

1. Sign in to Life OS, open Profile → AI Connections, and copy the account UID. This identifier is not a password.
2. Have the repository maintainer bind that verified owner's UID in server/owner-config.js. Empty configuration denies all key writes; no first-user ownership claim exists.
3. After deployment, sign in again, open connection settings, and paste the Groq key into the password field. Save & test verifies the credential and selected model availability. An actual chat is the final inference check.

Only the configured, email-verified owner with a login within five minutes can save or disconnect the key. The API checks authentication and same origin, throttles mutations, and uses revision checks. Keys are AES-256-GCM encrypted in the privateIntegrations/groq server record, never returned to the browser, and decrypted only in the Python service. Firestore rules must deny client access to this root collection (the repository rules do).

The vault derives an encryption key from the existing CRON_SECRET with a dedicated context; no Groq Vercel variable is required. CRON_SECRET must have at least 32 characters. After rotating it, re-enter the Groq key because existing ciphertext can no longer be decrypted. Never commit or paste provider keys into chat, logs, or source files.

The initial operator supports validated task, timetable, budget and transaction proposals plus navigation. Users confirm proposals before writes. It does not execute arbitrary code, send messages, or control every feature. Health sharing is opt-in; meals and health preferences are included when selected. Nutrition can suggest general meals without a health report; optional missing logs are explicitly marked unknown. Medical restrictions remain enforced.
