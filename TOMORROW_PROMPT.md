# Prompt for the next IziCost session

Copy everything below the line into the chat to start.

---

We are continuing IziCost (folder D:\AI\Claude\Projects\izicost, one project per session, nothing shared with IziCamera).

Start by reading MASTER_PLAN.md section 12 ("Next steps"), especially the "Day 2 (2026-09-03)" block, so you know what exists. In short: Phases 1–4 of the app (camera + multi-photo + offline queue, reports/budgets/recap, community prices, basket optimiser + alerts), migrations 001–015 applied (011/013 = least-privilege grants and caps, 014/015 = city price index and per-store trend), Edge Functions `extract-receipt` and `parse-shopping-list` deployed with per-user and global daily caps, and everything built on 2026-09-03: photo-deletion bug fixed, category editing on receipts, market quick-add switched off (RPC revoked), Invite friends, the voice shopping list (PT/EN switch, continuous listening, "Add more" after pauses), the bargain-first Home, community prices shown from the first report (setting in migration 009), household sharing (create/join with a code in the Me tab, Me / Household switch on Home, Receipts and Reports), the "My items" price watch (auto-filled from receipts, green/red vs what I paid, bell alerts when the app opens, ☆ on product pages), animated charts, category inflation, the city price index report and the per-store price chart on product pages.

Day 3 (2026-09-04, see the "Day 3" block in section 12) added: demo data (`node scripts/seed-demo.js`, `clean` removes it — it is still in the database), background price alerts while the app is closed, share cards (product, basket result, inflation, city index, weekly story), open data in the app (staples table per city + CSV download + live ticker on Prices), the weekly story screen with household leaderboard, badges on Home, and the Update button in the Me tab (reads `latest.json` from the public `releases` bucket; publish with `node scripts/publish-release.js <apk>`; the Free plan caps files at 50 MB, so publish the slim arm64 build made with `build-apk.ps1 -Abi arm64-v8a -Slim`).

Builds: build 4 = builds\izicost-v0.3.1-2026-09-03-2010.apk is on my phone; my dad also tests. Day 3's work needs build 5 (two new native modules: background task, view capture).

Rule: **never start an APK build without my explicit yes in this session.**

Today:
1. I will give you my findings from testing (build 4 or 5). Fix them all. Ask for screenshots if something is unclear.
2. My old guest account (id d36d289a-…, last seen 2026-09-02) still holds yesterday's 5 receipts; my new account has none. If I give you the email of my new account, move those receipts (and their items) to it on the server, then check Home fills up.
3. When the fixes are done, ask me before making build 5 (scripts\build-apk.ps1); copy it to builds\ and tell me the file name.
4. Visual polish pass, screen by screen: consistent spacing, brand green, clean cards, dark mode correct, nice empty states. The app must look better than the competitor apps in research/COMPETITOR_RESEARCH.md section 3. The dashboard must feel fun, dynamic and interactive (charts that move, colours, 🎉 moments).
5. Seeding plan for the price pool (prices show from the first report, but a new city still starts empty): tester group, promotion flyers, etc. Decide with me.
6. Check the background price alerts really fire on my phone with the app closed (Android may delay them); if unreliable, plan real push (Firebase) as stage C.
7. Then continue the pre-launch security checklist in MASTER_PLAN section 12 (done: per-user + global scan caps, least-privilege grants, guest sign-ups 10/hour/IP; still open: captcha on guest sign-up, `min_reports` back to 2 before public launch, email confirmation back on, permanent signing keystore, stores insert validation, export/delete account, privacy policy, backups, final review).

Rules as always: I don't code, explain in plain language, double-check everything you build (typecheck `npx tsc --noEmit` in app\, `npx expo lint`, `python scripts/i18n-audit.py`, and review + security agents for anything big — 110% security), keep English + Portuguese complete, never put secrets in the app or in git, commit and push at the end (git add -A, then commit, then push as separate commands — the classifier blocks them when combined).

Helpful facts: Supabase project ref ehomstenpqngybtemtad, keys in passwords\supabase.txt (never print them), migrations via `node scripts/setup-supabase.js sql <file>`, function deploy via `node scripts/deploy-function.js [name]`, backend smoke test via `node scripts/test-backend.js`, ad-hoc read-only SQL via a small script that posts to the management API (see how setup-supabase.js authenticates). My Expo Go is v54 and the project is SDK 57, so testing is by APK only. The Supabase access token expires around 2 October 2026. The invite message links to the latest published APK in the public `releases` bucket (`APP_LINK` in app\src\features\share\share.ts); replace it with the Play Store link once listed.
