# Life OS active assistant

## What users can do

Open Assistant or the message icon in the header of any screen. Describe a
change in natural language, review the proposed actions, then press **Confirm
changes**. A new message replaces an unconfirmed proposal. Typing “yes” keeps
the review visible and directs the user to the confirmation button.

Supported changes:
- Add tasks, edit their titles/priorities, and mark them complete or open.
- Schedule existing tasks or newly proposed tasks in the same confirmation.
- Move existing timetable blocks after reviewing their original and new times.
- Create or update monthly category budget limits.

The assistant can also explain selected records, help decide whether a purchase
fits recorded cash flow, and analyze spending. It cannot execute payments,
contact friends, access live bank balances, or send background push notifications.

Budget now includes **Purchase Advisor**, **Subscriptions** and **Bill splits**.
The latter two are record-keeping tools: subscriptions store renewal dates and
costs; bill splits calculate exact equal shares and track settlement. They do not
automatically debit accounts or create transactions. The local planner and weekly
summary remain available without a Gemini request in the Assistant screen.

## Existing Vercel setup

No new keys are needed. Use the repository root, Vite, `npm run build`, and `dist`.
Keep `GEMINI_API_KEY` as a Production secret and `GEMINI_MODEL` as Production
config. The default is `gemini-3.1-flash-lite`; whitespace and accidental trailing
full stops in the model value are removed. Optional `FIREBASE_PROJECT_ID`
defaults to the existing `lifeos-61443` Firebase project. No Tencent, Supabase,
Firebase Admin service-account key, Blaze upgrade or cron setup is required.

## Privacy and confirmation

The sharing controls let users include tasks/timetable, budget, and/or health
records. Selected records plus recent conversation messages go to Gemini.
Tasks/timetable are included by default; budget is included when opening from
Budget; health requires selection. Changing sharing controls clears the context
history sent with subsequent messages. Visible chat history stays in memory for
the current panel session.

At most 150 records per included collection and 30 health records are shared;
transaction details cover the current month. Aggregate recorded income/expense
totals cover all current-month records, even when detail rows are truncated.
The model is explicitly told about incomplete data and cannot directly execute
operations. All returned action fields are validated against an allowlist.

`POST /api/assistant` produces proposals. `POST /api/assistant-apply` saves only
when the frontend confirmation button is pressed. Both require Firebase ID-token
signature and claim verification using Google's public keys via `jose`.
Firestore requests carry that user's token; the existing ownership rules in
`firestore.rules` continue to apply, including to the new `subscriptions`,
`billSplits` and `assistantApplied` user subcollections.

## Save safeguards and limits

A Firestore transaction re-reads tasks, timetable and budgets, compares original
fields for edits, rejects completed-task/past-time/overlapping schedules, and
writes all changes together with an idempotency receipt. Retrying the same
confirmation does not duplicate records. Task completion also updates linked
blocks. Patch masks preserve unrelated existing fields. Timetable timestamps
use the browser's timezone offset for each target date, including DST changes.

Up to 20 actions are accepted per proposal, 1,000 records per queried collection,
and 450 resulting changed records. A conflict requires a fresh proposal. The
best-effort per-instance request throttle is not a distributed quota or billing
cap. Gemini, Firestore and Vercel free-tier quotas still apply. ID-token revocation
lookups are not performed; already-issued tokens can remain valid until expiry.

## Verification and smoke test

Automated tests cover action validation, create-and-schedule linkage, atomic
receipts/retries, stale updates, timetable conflicts/swaps, budget limits, Firebase
signatures/claims, exact-paisa bill splits, local reminders and prior analytics.
The production build is checked. Provider calls and Firestore writes in tests
are mocked. Browser access to the local test page was blocked by the environment.

After deployment, sign in and try:
1. “Add a high-priority revision task and schedule it tomorrow at 7 pm for 30 minutes.”
2. Review and confirm; verify both Tasks and Timetable.
3. “Move that revision block to 8 pm tomorrow.” Review and confirm.
4. In Budget, Ask Gemini to analyze spending and propose a Food budget.
5. Confirm a budget change, then check Budgets. Save a subscription and a bill
   split using their new tabs.

The previous recovery retained the Firebase app and preserved the pre-recovery
migration on `backup/before-firebase-recovery`. No database was deleted.
