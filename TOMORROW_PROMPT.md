# Prompt for the next IziCost session

Copy everything below the line into the chat to start.

---

We are continuing IziCost (folder D:\AI\Claude\Projects\izicost, one project per session, nothing shared with IziCamera).

Start by reading MASTER_PLAN.md section 12 ("Next steps"), especially the "Day 2 (2026-09-03)" block, so you know what exists: Phases 1–4 of the app, the security fixes, migrations 001–008 applied, Edge Functions `extract-receipt` and `parse-shopping-list` deployed, and yesterday's changes: photo-deletion bug fixed, category editing on receipts, market quick-add switched off, Invite friends, the voice shopping list, and the bargain-first Home screen. The last APK on my phone is still build 2 (builds\izicost-v0.2.0-2026-09-02-1842.apk); none of yesterday's work is in it.

Rule: **never start an APK build without my explicit yes in this session.** Build 3 needs `expo prebuild` because a new native module (speech recognition) was added; the build script handles that.

Today:
1. Ask me if you may make build 3 (scripts\build-apk.ps1). If I say yes, copy it to builds\ and tell me the file name. I will test: photos must now show on new receipts, the mic on Home and in My basket, category editing, Invite friends, and the new Home.
2. I will give you my findings from testing. Fix them all. Ask for screenshots if something is unclear.
3. Visual polish pass, screen by screen: consistent spacing, brand green, clean cards, dark mode correct, nice empty states. The app must look better than the competitor apps in research/COMPETITOR_RESEARCH.md section 3.
4. Decide the cold-start / seeding plan with me (community prices need ≥2 reports before they show; a new city starts empty).
5. Then continue the pre-launch security checklist in MASTER_PLAN section 12 (daily scan cap done; still open: captcha on guest sign-up, email confirmation back on, permanent signing keystore, stores insert validation, export/delete account, privacy policy, backups, final review).

Rules as always: I don't code, explain in plain language, double-check everything you build (typecheck `npx tsc --noEmit` in app\, `npx expo lint`, `python scripts/i18n-audit.py`, and a review agent for anything big), keep English + Portuguese complete, never put secrets in the app or in git, commit and push at the end (git add -A, then commit, then push as separate commands — the classifier blocks them when combined).

Helpful facts: Supabase project ref ehomstenpqngybtemtad, keys in passwords\supabase.txt (never print them), migrations via `node scripts/setup-supabase.js sql <file>`, function deploy via `node scripts/deploy-function.js [name]`, backend smoke test via `node scripts/test-backend.js`. My Expo Go is v54 and the project is SDK 57, so testing is by APK only. The Supabase access token expires around 2 October 2026. The invite message has no download link yet: set `APP_LINK` in app\src\features\share\share.ts when there is one.
