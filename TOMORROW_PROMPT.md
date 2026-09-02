# Prompt for the next IziCost session

Copy everything below the line into the chat to start.

---

We are continuing IziCost (folder D:\AI\Claude\Projects\izicost, one project per session, nothing shared with IziCamera).

Start by reading MASTER_PLAN.md section 12 ("Next steps") and research/COMPETITOR_RESEARCH.md section 3 so you know exactly what was built yesterday (2026-09-02): Phase 0 benchmark (Sonnet 5 chosen), Phases 1–4 of the app (camera + multi-photo + offline queue, reports/budgets/recap, community prices, basket optimiser + alerts), the security review fixes, migrations 001–006 applied, build 2 = builds/izicost-v0.2.0-2026-09-02-1842.apk.

Today:
1. I will give you my findings from testing build 2 on my phone (bugs, ugly screens, confusing bits, receipts it read badly). Fix them all. Ask me for screenshots if something is unclear.
2. Make build 3 with scripts\build-apk.ps1 (it now produces phone-only APKs and includes the basket fixes from commit 91da570 that are not in build 2). Copy it to builds\ and tell me the file name.
3. Visual polish pass: the app must look better than the competitor apps in the research. Consistent spacing, brand green, clean cards, dark mode correct, nice empty states. Go screen by screen.
4. Then start the pre-launch security checklist in MASTER_PLAN section 12 (daily scan cap is done; still open: captcha on guest sign-up, email confirmation back on, permanent signing keystore, stores insert validation, export/delete account, privacy policy, backups, final review).

Rules as always: I don't code, explain in plain language, double-check everything you build (typecheck, translation audit, bundle, and a review agent for anything big), keep English + Portuguese complete, never put secrets in the app or in git, commit and push at the end (git add -A, then commit, then push as separate commands — the classifier blocks them when combined).

Helpful facts: Supabase project ref ehomstenpqngybtemtad, keys in passwords\supabase.txt (never print them), migrations via `node scripts/setup-supabase.js sql <file>`, function deploy via `node scripts/deploy-function.js`, backend smoke test via `node scripts/test-backend.js`, translation audit via `python scripts/i18n-audit.py`. My Expo Go is v54 and the project is SDK 57, so testing is by APK only. The Supabase access token expires around 2 October 2026.
