# Life OS security review — 28 September 2026

Scope: the five checks in the supplied vibe-coding-security-prompts.pdf. This is a code audit and regression test pass, not an independent penetration-test certification. Production Firebase configuration, provider security settings, authenticated browser workflows, backups and historical log contents were not accessible for verification.

## 1. Secrets and credentials

Removed the source-controlled admin password verifier and its runtime fallback. Admin login now fails closed unless LIFEOS_ADMIN_PASSWORD_HASH is configured. Set a NEW password (the previously shared password must not be reused), generate a random salt and scrypt verifier, and place only the verifier in Vercel. It is deliberately not copied from git history. Existing admin sessions become invalid when the verifier changes.

Added .env.example and ignored environment variants/private-key files. Firebase browser configuration is public project identification, not a private service-account credential. Restrict its API usage in Google Cloud and enforce Firebase App Check where supported. A targeted current/history scan is not a substitute for Gitleaks or credential-provider rotation. No production secret values were downloaded or printed.

## 2. Personal data

| Data | Storage / processing | Changes / retention |
| --- | --- | --- |
| Email, profile, authentication | Firebase Auth and owner Firestore profile | Passwords handled by Firebase Auth; OTPs/tokens HMAC hashed, single use, short expiry |
| Tasks, finances, health logs | Owner Firestore subcollections | Existing per-section reset remains; user-specific IDs come from verified token |
| Meal planning | Private Python service; USDA food IDs; bounded nutrient/activity summary to Gemini with consent | No name/email or free-text log notes in nutrition payload; recipe exclusions applied before AI |
| AI conversations | In-memory browser session; selected context sent to Gemini | Removed plaintext localStorage persistence; old assistant entry removed on use; chat cleared on explicit logout |
| Active workout | Owner Firestore workoutSessions/active | Removed plaintext localStorage persistence; old entry cleared on opening workout screen |
| Reminder delivery | SMTP provider; Web Push endpoints | Sanitized raw error logging; sender identity and escaped templates retained |
| Uploaded statement screenshots | Transient Gemini request after local conversion | Size and JPEG signature validated server-side; user reviews before saving |

Firebase SDK-managed authentication persistence remains in the browser; this is separate from application-managed sensitive content. Provider retention policies and backups require account-owner review. Full account deletion/export is still an open item: section reset does not delete Firebase Auth, profile, mail-provider records or backups. Do not represent section reset as complete erasure.

## 3. Production safeguards

Added CSP, HSTS, nosniff, frame-denial, referrer policy and restricted camera/microphone/location policy. COOP allows Firebase Google sign-in popups. Private source/config paths explicitly return 404. Browser style inline support remains necessary for the existing React UI. Images allow HTTPS for product photos and wallpapers.

Reset requests have a persistent 3/hour/IP quota; code verification and confirmation have 5/minute/IP quotas, plus OTP attempt limits and resend cooldown. Records use HMAC IP keys rather than raw addresses. Configure Firestore TTL cleanup for securityLimits.expiresAt after migrating it to a Firestore timestamp, or schedule server-side deletion of expired numeric records; current expiration is enforced logically but documents are retained. Existing AI quotas are instance-local and need durable global quotas/App Check for stronger cost-abuse protection. Firebase direct login throttling and abuse controls must be configured in Firebase; Vercel middleware cannot govern direct Firebase SDK requests.

Updated affected npm packages, including PDF.js, Firebase, Vite and Vitest. npm audit reports zero known vulnerabilities at this review; this is point-in-time evidence, not future assurance. Build and tests validate compatibility, but production OAuth sign-in must still be checked on a real account.

## 4. Authentication and business logic

Password reset now uses Firestore revision preconditions to atomically consume OTPs and reset tokens, including concurrent attempts. A consumed token is not restored if a downstream password update fails; request a new code. JWT signature/issuer/audience/expiry validation is retained; authenticated API requests additionally check deleted/disabled accounts and token revocation state with Firebase. Admin credentials are server-only, with HttpOnly Secure SameSite cookies and origin validation.

The repository Firestore rules now explicitly allow only legitimate owner collections and deny client access to internal email receipts/reset/admin/rate-limit records. IMPORTANT: Vercel deployment does NOT publish Firestore rules. Publish firestore.rules in Firebase Console and test with two separate accounts. This live configuration was not verified or changed in this session.

No payment processor is integrated: finance data is personal recordkeeping and product links are outbound recommendations. Recipe preferences are not medical diagnoses; unknown nutrients remain unknown. Allergy filters cannot be changed by model output.

## 5. Attack-path checks and limits

Automated tests cover concurrent OTP/token replay, persistent rate-limit contention, deleted/disabled/revoked accounts, unsafe upload content, invalid JWTs, owner-only health context, admin cookie/origin tampering, invalid product URLs, action validation and duplicate-safe imports. No destructive test was run against a real user account, and no real reminder emails were sent as a test.

Remaining owner actions before claiming security sign-off:
1. Set a NEW LIFEOS_ADMIN_PASSWORD_HASH in Vercel and redeploy. Admin remains unavailable without it.
2. Publish and verify the supplied Firestore rules; review Firebase API restrictions, App Check, authentication abuse controls, service-account IAM and MFA for project administrators.
3. Implement a complete account-erasure/export workflow and a documented backup/provider retention policy.
4. Use two disposable accounts for live authenticated isolation tests and Google/email sign-in verification; run a professional penetration test before handling sensitive data at scale.
5. Rotate any credentials previously disclosed outside secret storage, review provider audit logs and configure durable quotas/monitoring for AI costs.
