# IziCost app

Expo SDK 57 · expo-router · English + Portuguese · Supabase backend (`../supabase/`).

## Run on a phone (development)
```
cd app
npm start
```
Then open the `exp://<this PC's IP>:8081` address in Expo Go (needs an Expo Go that supports SDK 57).

## Build an installable APK (no Expo Go needed)
From the project root:
```
powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
```
Output lands in `../builds/izicost-v<version>-<date>.apk`. Install it on the phone (allow "unknown sources").

## Backend helpers (project root, need `passwords/supabase.txt`)
- `node scripts/sync-env.js` — writes `app/.env` with the public Supabase URL + publishable key.
- `node scripts/setup-supabase.js all` — applies `supabase/schema.sql` and auth settings.
- `node scripts/deploy-function.js` — publishes the `extract-receipt` function + its secret.
- `node scripts/test-backend.js [photo]` — end-to-end test with a Phase 0 receipt photo.
- `python scripts/i18n-audit.py` — checks every string has a Portuguese translation.

## Where things are
- `src/app/(tabs)/` — Home, Scan, Receipts, Me screens
- `src/app/confirm.tsx` — the "check what we read" screen
- `src/app/receipt/[id].tsx` — receipt detail
- `src/components/onboarding.tsx` — first-launch intro cards
- `src/lib/` — i18n, Supabase client, receipt logic, types
