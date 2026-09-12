# Review regression checks

Run `npm ci`, `npm test`, and `npm run build` from the repository root.

The six tests cover Indian midnight/month boundaries, DST calendar arithmetic, inclusive report periods, duplicate sleep records, expense aggregation, small percentages, and unknown nutrition status.

For isolated visual checks, run:

```sh
npx vite --config tests/preview.config.js --host 127.0.0.1
```

Open `/tests/preview.html` on the displayed local URL. Select 320, 375, 768, or 1366 pixels and use the navigation to inspect each screen. The sample dashboard uses synthetic in-memory collections and disables authentication operations. It never saves records to Firestore. Profile credential changes are not part of this preview. The production config does not include these fixture modules.

## Change notes

- Use local calendar dates for task/timetable defaults, report periods, and monthly charts.
- Show one sleep point per wake-up date; average older duplicate entries without deleting them. New saves use the date as the document ID and update the same night.
- Replace fabricated coaching scores and default wallet balances with recorded activity and explicit missing-data states.
- Put priorities and timetable access earlier on the dashboard.
- Show fractional budget percentages, label report printing, and describe text/CSV import accurately.
- Improve form labels, password visibility, keyboard controls, dialog focus handling, and responsive sizing.
- Pass the selected task into Focus Studio.

## Validation and limitations

Six automated tests and the production build passed. The production bundle still produces Vite's large-chunk advisory. Browser visual verification could not be completed because this environment's browser could not connect to the local preview. Review the preview at mobile and desktop widths, including dialogs and print layout, before merging. Live Firebase writes and sign-in were not exercised for this change.

GitHub branch creation was rejected with HTTP 403, "Resource not accessible by integration". These changes have not been pushed or deployed.
