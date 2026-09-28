# Connected health and screenshot import

## User flows
- Reminder setup is invited only by successful email signup, email login or Google login. Invitations live in memory and are consumed on display; restoration, token refresh and page reload never create one. Notification settings remain available in Profile.
- Budget → Import / scan screenshot accepts JPEG, PNG and WebP, alongside existing CSV/PDF import. Images are resized on-device and sent to Gemini only after Scan. Review and import use the existing validated, duplicate-aware transaction flow. No screenshot is persisted in Firestore.
- Health → Preferences saves account-scoped food exclusions, adult/medical checks, goals and optional user-supplied nutrient targets. Unknown values are left blank.
- Health → Food & plan offers an explicit health-data processing opt-in, next-meal suggestions, swaps, portions, a saved daily plan and separate “I ate this” actions. Saving a plan does not change consumed totals. Planned meal logging uses deterministic day/slot IDs to prevent duplicate clicks from adding another meal.
- Health → Gym & movement includes timed, pausable sessions, completed sets, reps, loads, perceived effort, comparisons and scheduling into the existing timetable/reminder system. Manual logs support editing/deletion. In-progress timers are stored per account on the device.

## Service
The authenticated `/api/assistant` action `health-plan` reads only the verified account's saved preferences and recent meals, workouts and sleep. The existing private Python `/api/deliver` endpoint runs `server/nutrition/engine.py` under the `nutrition` channel. No extra Vercel function is added. Email/push delivery behavior is unchanged.

Existing `CRON_SECRET` secures the internal service call. Existing `GEMINI_API_KEY` / optional `GEMINI_MODEL` allow bounded AI recipe selection. The AI only chooses an ID from recipes already filtered for exclusions; it cannot invent nutrient values, foods or medical prescriptions. When AI fails, the deterministic selector is labelled as such.

Optional **USDA_API_KEY**: register a free API key at https://fdc.nal.usda.gov/api-key-signup/ and add it to Vercel Production, then redeploy. Without it, USDA's low-quota DEMO_KEY is used. A food lookup fetches the exact FoodData Central records listed in `foods.json`; responses cache for 15 minutes. Failed/throttled lookups use the dated USDA reference snapshot and visibly say live data is unavailable. An API response must preserve each food's identity/preparation and include core nutrients before being accepted.

The endpoint's GET status includes `nutritionReady` to verify Python packaging without accessing health data or making AI requests.

## Limits
The starter recipe library is vegetarian/vegan or includes eggs; it is not a comprehensive food database or a therapeutic diet. A day's sample portions are not guaranteed to meet the user's energy needs. Oil, sauces and added ingredients must be logged separately. Medical conditions, pregnancy/breastfeeding, eating-disorder history, minors and unlisted allergies block personalized planning pending qualified advice. Missing logs cannot establish deficiencies. User-set targets are comparisons, not recommended doses. No supplement dosing is generated.

Nutrition provenance: https://fdc.nal.usda.gov/api-guide/ and per-food links returned in the interface. General diet context: https://www.who.int/health-topics/healthy-diet.

## Verification
`npm test`, `npm run test:ui`, `python -m unittest discover -s tests -p 'test_*.py'`, `npm run build`.
Tests cover owner-scoped health reads, exclusions, provider failures, source labels, unknown nutrients, explicit-login prompting, screenshot review, and plan-versus-consumption writes. No real emails or user health data are used in these tests.
