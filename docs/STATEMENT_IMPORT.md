# Statement import and budget repairs

Budget → Import CSV / PDF opens a review flow. Choosing or scanning a file does not save transactions. The user can correct dates, amounts, income/expense direction, description and category, select an account, and choose which rows to import.

CSV is parsed locally with Papa Parse. It handles common bank/Google Pay headers, quoted fields, Indian comma formatting, debit/credit columns, signed amounts, references, and configurable day/month order. Failed, cancelled, pending and reversed rows are excluded with warnings. Unknown dates or direction require correction; a missing date is never replaced with today. Unsupported headers produce a clear error.

PDF.js is loaded only when a PDF is selected. Text pages are extracted locally and sent one page at a time to the authenticated `/api/statement-import` endpoint. Scanned pages are rendered to bounded JPEG images for Gemini extraction. Pasted statement text uses the same endpoint. The upload dialog explains this data sharing. The server uses the existing `GEMINI_API_KEY` and optional `GEMINI_MODEL`; no additional key or database migration is required. Pages and model responses are not logged or stored on the server.

Limits: 10 MB per file, 30 PDF pages, 3,000 rows per import. Password-protected PDFs must be unlocked on the user's device. PDF extraction is probabilistic: dates, amounts, direction and missing/cut-off rows must be reviewed against the statement. Scanning unavailable/malformed pages fails visibly and never silently saves a partial scan.

## Persistence and corrections

Imports use transactions of at most 100 rows with stable hashed document IDs. Retrying after a failed chunk skips completed chunks and preserves subsequent edits. Imported source identities are retained when an entry is edited. Matching UTRs and previously imported identities cannot be imported again. Similar cash payments are unchecked as possible duplicates; users can explicitly include distinct repeated payments. A repeated cash payment's occurrence number distinguishes it within a statement. Duplicate detection across differently structured exports is best effort, so review is still necessary.

Transactions now have explicit edit and delete buttons in both recent and full lists. Editing preserves reference/import metadata. Deletion needs confirmation; persistence failures keep the dialog open. Firestore document IDs take precedence over legacy `id` fields stored inside records. Search, income/expense filtering, month filtering and pagination make large imports manageable.

## Assistant and navigation

Read-only AI requests retry once after temporary network/server failures or interrupted streams. An expired authentication token is refreshed once. Permanent input/permission errors and quota responses are surfaced without retry loops. Writes use the existing separately idempotent confirmation path. A partial reply is cleared before retry and only one completed proposal reaches the save path.

The home screen focuses on priorities, the timetable and monthly money. Mobile navigation has five destinations; secondary tools remain in More. Budget has Overview and Transactions with secondary tools under More. Assistant preferences are collapsed. Tasks and reminder workflows remain intact.

## Validation

- `npm test`: existing regression tests plus parsing, duplicate, partial import, API authorization and AI retry tests.
- `npm run test:ui`: isolated component tests for transaction editing/deletion, failure recovery, CSV review and PDF review routing. These use mock persistence and mock PDF extraction, not real user data.
- `npm run build`: production bundle; PDF worker emitted as a local asset.

Live Gemini/PDF accuracy and real Firestore permissions still require verification on an authenticated deployment. Cloud Browser could not access the local development server in the authoring environment. No production user records were changed during testing.
