# Life OS assistant setup

No additional API keys, paid Firebase plan or messaging SDK is needed. Keep
`GEMINI_API_KEY` (Production secret) and `GEMINI_MODEL` (Production config) in
Vercel. The default model is `gemini-3.1-flash-lite`. The app continues to use
Firebase project `lifeos-61443`; the Gemini key stays on the server.

## Actions and event tags

The shared assistant can create/edit/complete/delete tasks, schedule tasks,
move/remove timetable blocks, set monthly category limits, log income/expenses,
tag existing transactions, and delete transactions/category budgets after review. Deleting a task also removes its linked blocks;
removing a block keeps the task. Destructive changes appear in the preview.
Confirm changes or type “yes” while a proposal is visible to save. A request to
revise it sends the previous unconfirmed proposal back to Gemini. No provider
reply executes database changes automatically.

Budget → Event tags groups entries under names such as `#summer-vacation`.
Add a tag when creating a transaction, or assign/edit/remove it on existing
entries. Event totals span all months. Tags normalize case and spaces to dashes.
Gemini receives tags and aggregate event totals when budget sharing is enabled.
Wallet balances are manual records, not automatically adjusted bank balances.
Subscriptions and bill splits remain record trackers, not payment services.

## Saving repair

Production logs showed `/api/assistant` returning replies while
`/api/assistant-apply` returned 403. The refreshed frontend saves through the
Firebase Web SDK and the same signed-in connection as the normal app controls.
It does not use the failing server REST transaction path. The older REST routes
remain for compatibility/diagnostics; refresh stale pages to load the new flow.

A transaction reads the user's profile revision, loads only needed collections,
validates original fields and timetable occupancy, and commits all changes plus
a receipt. Normal CRUD helpers also increment that profile revision, allowing
concurrent current-version app edits to trigger transaction retries. No Firestore
rules are weakened: the existing owner-only rules in `firestore.rules` still
apply to both profile and nested documents. If manual writes also fail, the
actual Firebase rules/account access must be checked separately.

Confirmation receipts keep the latest 100 IDs; proposals expire after 24 hours.
Deterministic creation IDs and receipts prevent duplicate saves on normal retries.
Limits: 20 actions, 1,000 records per read collection, 450 changed records.
Changes preserve unrelated record fields; stale edits, invalid amounts, past
schedules, overlaps and duplicate targets are rejected before any writes.

## Conversation and speed

Replies stream from Gemini through `/api/assistant` as NDJSON, so text appears
before the full structured proposal is ready. Only the final validated proposal
can be confirmed. Interrupted streams never save anything. Safe defaults for
new tasks avoid failing on omitted priority/completion fields. Logs record status,
action count and duration, without message bodies or tokens.

Recent chat (80 displayed messages), up to 40 context messages and an editable
3,000-character summary are stored per account on this device. All assistant
panels share that conversation and pending proposal. Memory does not sync across
devices. Use Memory & shared records → Clear chat & memory to erase it. Sharing
changes clear outgoing history, summary and pending actions.

Selected records, messages and memory go to Google Gemini. Tasks/timetable are
selected by default, budget when opening from Budget, health only by selection.
Context favors open tasks (up to 400), future blocks (300), recent transactions
across months (200), other records (200), and health rows (30). Context is bounded
to fit requests; full monthly/event aggregates remain available where enabled.
The model is told about truncation and to use actual records instead of invented
facts. The local canned summary/planner has been removed from the chat screen;
existing manual timetable controls and dashboard summaries remain independent.

## Verification

Run `npm test` and `npm run build`. Tests mock the provider/database and cover
atomic saves, failed permissions without partial writes, retry receipts, stale
updates/deletes, linked-block deletion, schedule conflicts, event totals,
transaction tagging, session isolation and split-chunk streaming.

Live signed-in smoke checks:
1. “Add a revision task for tomorrow at 7 pm for 30 minutes.” Confirm; check Tasks
   and Time. Retry the same confirmation if the network is interrupted.
2. “Delete that revision task.” Review the named task and linked blocks; confirm.
3. “Log ₹500 for travel under #summer-vacation.” Confirm; check Budget → Event tags.
4. Change a tag on an older entry and verify the event total.
5. Navigate between screens or refresh; the conversation should remain.

Browser access to the local preview is blocked in the agent environment. This
means automated local tests do not prove real signed-in permissions or provider
latency. Deployment checks and the above account test are separate gates.

Date/time and email follow-up: see `EMAIL_AND_NOTIFICATIONS.md`. Relative dates now use a device-based 14-day calendar; common 12-hour and DD/MM/YYYY inputs are parsed before the model proposes changes. Legacy records without dates remain visible. Live Gemini proposal generation was verified; automatic approval review blocked the unrequested test-record save, so account write verification still needs explicit approval.
