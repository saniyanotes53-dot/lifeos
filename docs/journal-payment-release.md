# Journal, plugins and UPI reminders

Journal and Plugins are available under More. Journal text is manually saved, with a discard prompt for navigation. Photos are saved separately as up to three compressed JPEGs per date; originals are not retained. Attendance and Namaz use deterministic daily IDs. Missed Namaz creates a linked task; made-up or attended status completes it. Hifz records surah, ayah range and manually selected juz, with separate Murajah entries.

Profile → Receive repayments stores the account owner's UPI ID, name and explicit email opt-in. Only lend-record borrower reminders receive Pay Now. The HTTPS landing page renders a QR and standard UPI intent. Links expire after 30 days and are signed with the existing server CRON_SECRET. Recipients must verify payee and remaining balance. There is no payment processing, settlement callback or confirmation of receipt. Split bills do not inherit the owner's UPI to avoid directing another lender's repayment to the wrong person.

## Verification and security review
- 12 Node tests and 2 UI tests pass; production build passes with existing bundle-size warnings.
- Firebase rules simulator: anonymous journal read denied, owner read allowed, different UID denied, valid option creation allowed, malformed option denied. Simulations do not write production records.
- New journal schemas allow only explicit fields, bounded text/photos and owner-path access. Cross-user access does not depend on editable profile roles. Unknown/server-only collections are denied to clients.
- Legacy app collections retain ownership checks rather than newly imposed schemas, to preserve compatibility. This is not a full security audit. Hifz per-surah limits are validated by the client; rules enforce broad numeric bounds. Date rules validate format, with calendar validation in the client.
- Payment links are bearer links containing payee/amount; do not publish or share them beyond the intended borrower. HMAC rejects alteration; landing response uses no-store, no-referrer, restrictive CSP and no external QR service. An issued reminder can become stale after repayment; it explicitly asks the recipient to verify the balance. No live mail or payment transaction was performed in verification.
