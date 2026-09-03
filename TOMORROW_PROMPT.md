# Prompt for the next IziCost session

Copy everything below the line into the chat to start.

---

We are continuing IziCost (folder D:\AI\Claude\Projects\izicost, one project per session, nothing shared with IziCamera).

Start by reading MASTER_PLAN.md section 12 ("Next steps"), especially the "Day 2 (2026-09-03)" block, so you know what exists: Phases 1–4 of the app, the security fixes, migrations 001–015 applied (011/013 = least-privilege grants + caps, 014/015 = city price index + per-store trend), Edge Functions `extract-receipt` and `parse-shopping-list` deployed, and yesterday's changes: photo-deletion bug fixed, category editing on receipts, market quick-add switched off, Invite friends, the voice shopping list, the bargain-first Home screen, community prices shown from the first report (setting in migration 009), and household sharing (migration 010: create/join with a code in the Me tab, Me / Household switch on Home, Receipts and Reports; testing it properly needs two accounts, e.g. my phone plus a second phone or a second account), and the "My items" price watch on Home (auto-filled from receipts, green/red vs what I paid, bell alerts when the app opens, ☆ on product pages), animated charts, category inflation, the city price index report and the per-store price chart on product pages. Build 3 = builds\izicost-v0.3.0-2026-09-03-1855.apk (made at the end of the day with my consent) contains all of it; I have been testing it.

Rule: **never start an APK build without my explicit yes in this session.** Build 3 needs `expo prebuild` because a new native module (speech recognition) was added; the build script handles that.

Today:
1. Ask me if you may make build 3 (scripts\build-apk.ps1). If I say yes, copy it to builds\ and tell me the file name. I will test: photos must now show on new receipts, the mic on Home and in My basket, category editing, Invite friends, and the new Home.
2. I will give you my findings from testing. Fix them all. Ask for screenshots if something is unclear.
3. Visual polish pass, screen by screen: consistent spacing, brand green, clean cards, dark mode correct, nice empty states. The app must look better than the competitor apps in research/COMPETITOR_RESEARCH.md section 3.
4. Seeding plan for the price pool (community prices now show from the first report, but a new city still starts empty): tester group, promotion flyers, etc.
5. Price-drop push notifications while the app is closed (stage B: scheduled server job + push tokens) — PS: "we need to do it". Then more dashboard life (budget rings more prominent, weekly line as a moving bar) — PS wants the dashboard fun, dynamic and interactive.
6. Then continue the pre-launch security checklist in MASTER_PLAN section 12 (daily + global scan caps done; still open: captcha on guest sign-up, min_reports back to 2 before public launch, email confirmation back on, permanent signing keystore, stores insert validation, export/delete account, privacy policy, backups, final review).

Rules as always: I don't code, explain in plain language, double-check everything you build (typecheck `npx tsc --noEmit` in app\, `npx expo lint`, `python scripts/i18n-audit.py`, and a review agent for anything big), keep English + Portuguese complete, never put secrets in the app or in git, commit and push at the end (git add -A, then commit, then push as separate commands — the classifier blocks them when combined).

Helpful facts: Supabase project ref ehomstenpqngybtemtad, keys in passwords\supabase.txt (never print them), migrations via `node scripts/setup-supabase.js sql <file>`, function deploy via `node scripts/deploy-function.js [name]`, backend smoke test via `node scripts/test-backend.js`. My Expo Go is v54 and the project is SDK 57, so testing is by APK only. The Supabase access token expires around 2 October 2026. The invite message has no download link yet: set `APP_LINK` in app\src\features\share\share.ts when there is one.
