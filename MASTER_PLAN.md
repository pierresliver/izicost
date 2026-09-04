# 💸 IziCost — Master Plan

> **What this is:** the single source of truth for IziCost. Written for a non-coder (PS steers +
> tests, Claude writes the code). Draft **v0.2 — 2026-07-27** (renamed from "IziShop"; community
> price model + retailer promotions + groceries-first, per PS).
>
> **Isolation:** IziCost is its own project — **own folder (`D:\AI\Claude\Projects\izicost`), own
> git repo, own backend.** It reuses proven *patterns* from IziCamera (Expo stack, EN/PT bilingual
> system, auth, the "Izi" brand) but shares **no repo and no backend**, so nothing can affect the other.

---

## 1. 🎯 The idea (one sentence)
**Scan your shopping receipts → IziCost files every item and, by pooling everyone's prices, tells
you where each thing is cheapest — near you or in any city — plus where your money goes.**

Two jobs:
1. **Effortless expense tracking** — no typing; scan the receipt, it's categorized and reported (**private to you**).
2. **Community price intelligence** — for any item: cheapest store/price **across all users, cities and
   (eventually) countries**, your last price, when you last bought it, and the price trend.

**Start narrow: GROCERIES first** (frequent, itemized, most comparable), then expand to pharmacy,
fuel, restaurants, bars, clothes, everything else.

**Market:** **Mozambique first → then the world.**

---

## 2. 🧠 The core model — two data layers (READ THIS FIRST)
This is the heart of the app, and the answer to your privacy question.

- **Personal layer (PRIVATE — yours only):** your receipts, your total spending, your categories,
  your budgets. Never shared, never sold.
- **Community layer (SHARED — anonymized):** every scanned receipt produces price points —
  `product · store · city/country · date · price`. These are contributed **without your identity**
  into a shared database. Any user can then ask *"where is rice cheapest near me / in Maputo / anywhere?"*

So: **what you spent stays private; the price tags become a shared public good.** More users →
more prices → better deals for everyone = the **network effect** that makes IziCost hard to copy.

---

## 3. 👤 Who it's for & why it wins
- Shoppers who want to **stop overpaying** and see spending without effort.
- **Huge in Mozambique / high-inflation markets:** big store-to-store price gaps; "where's it cheapest"
  and "how much more is my basket than last month" are real, felt questions.
- **Groceries-first** = the sweet spot: bought often, itemized clearly, and the same staples are sold
  everywhere → price comparison is most valuable exactly there.
- On-brand privacy stance (your spending is yours) + a genuine community benefit.

---

## 4. 🧩 Core features (your requirements)
1. **Scan a receipt** with the camera (or import a photo / e-receipt).
2. **Auto-extract EVERYTHING useful:** **store name, store address / branch, date & time, each item,
   quantity, unit price, line total, receipt total**, plus **payment method, tax (VAT), the store's
   tax id (NUIT in MZ), receipt number, and any discounts** — and anything else on the receipt that
   could matter. (Store address is important: it pins the price to a specific *branch* for location-aware deals.)
3. **Categorize PER ITEM, not per receipt** (PS 2026-07-27): a hypermarket receipt can mix groceries +
   clothes + pharmacy on one bill, so the AI tags each *line item* with its own category. This is why
   "groceries first" still works on mixed receipts — we pull the grocery lines out of any receipt.
   Reports then roll up by **store / date / category / item**.
4. **Reports (private):** spend by **date / category / store**, trends, charts, top items & stores.
5. **Price intelligence (community):** per item — **cheapest store & price (near you / any city)**,
   **last price you paid**, **last purchase date**, rising/falling trend.

---

## 5. 💰 Monetization — three pillars
1. **🏪 Retailer / shop promotions (B2B — your idea, and a strong one).** Shops claim their profile and
   **pay to promote products & advertise promotions/deals** to users who are *actively price-shopping*
   = very high-intent advertising. Clearly labelled "Promoted/Deal". This could be the main revenue line.
2. **📣 Google Ads** on the **free tier** (standard banner/interstitial), removed on Premium.
3. **⭐ Premium (small monthly):** ad-free, unlimited scans, basket optimizer, budgets, warranty
   reminders, export, family sharing, deeper price history.
- *(Optional, later: a Business/tax tier — expense/tax exports for freelancers & small shops. Parked.)*

---

## 6. 💡 Ideas I'm adding (ranked by real-world impact)
**Tier 1 — make it sticky (shape the roadmap):**
1. **Basket optimizer** — for a shopping list, tell the user which store (or split) is cheapest for the
   whole basket, using community prices. The "wow."
2. **Deals feed / "best deals near you"** — surfaces the cheapest current prices + retailer promotions.
   (This is also where shop ads live — product + revenue in one screen.)
3. **Recurring-item radar** — "you buy milk ~every 5 days; due tomorrow — and it just dropped at Shop B."
4. **Budgets + alerts** — monthly budget per category; nudge at 80% / over.
5. **Easy manual add / edit + OCR correction** — cash buys & fixing mis-reads (accuracy = trust = the product).

**Tier 2 — differentiators:**
6. **"My basket" inflation tracker** — what your typical basket costs month over month (very MZ-relevant).
7. **Overcharge / duplicate detection** — flag a price above the known community price, or a double-scanned receipt.
8. **Warranty & return reminders** — receipts as proof of purchase; alert before windows expire.
9. **Household / family sharing** — shared spending view (reuse IziCamera's "Trust Circle" pattern).
10. **Keep the receipt image** — a searchable photo archive.

**Tier 3 — platform / later:**
11. **Barcode scanning** — log/compare a product's price in-store without a receipt.
12. **Store map + location-aware deals** — "cheapest within 2 km."
13. **E-receipt / email import**, **loyalty-card wallet**, **spend insights** ("groceries up 18%, mostly meat").

**Added 2026-09-02 after competitor research** (full document: `research/COMPETITOR_RESEARCH.md`, raw notes + sources in
`research/raw_*.md`). Headline: no app anywhere pools prices from scanned receipts; Brazil's government e-invoice
apps (Menor Preço, Preço da Hora Bahia — 1.1M downloads, 4.8★) prove the model; typed-in crowdsourcing (Frugl,
Basket) failed; Mozambique has no price-comparison app at all.
14. **Cross-town / region comparison** (PS): location hierarchy country → province → city → neighbourhood → branch
    on every price; product page selector *near me / my city / choose a city / by city / by province / anywhere*;
    basket-by-city ("your basket: Maputo 4,120 · Beira 3,560 · Tete 4,900 MT"); regional price map;
    **unit-price normalisation** (per kg / litre); freshness decay + "seen N days ago, K reports" on every price;
    small-town k-anonymity (≥2–3 receipts before a price shows).
15. **Per-field confidence on the confirm screen** — only doubtful lines tinted; clean receipts confirm in one tap.
16. **Informal-market quick add** (voice / 2 taps: "tomates 50 MT, Xipamanine") → community prices for markets.
17. **Guest mode, no sign-up** for the first scans; multi-photo long receipts; blur/glare pre-check; offline queue badge.
18. **Weekly recap** card + push; "you saved X MT vs average prices" headline; recurring-bill tracker (TV Cabo, EDM).
19. **WhatsApp**: share receipts in, share price cards out with deferred deep links (81% of online MZ uses WhatsApp).
20. **M-Pesa / Emola / bank SMS parsing** (on-device, opt-in) for cash-less spend with no receipt.
21. **Low-data mode** (compress before upload, show MB per scan), low-end Android testing, PIN profiles for shared phones.
22. **Public IziCost Price Index per city** — monthly, for press + a B2B data product (banks, NGOs, retailers).
23. **Community mechanics that work:** reward *confirming* prices and *first price at a branch*, equal for all stores,
    daily caps, impact screen ("your scans helped 340 people"); no volume rewards, no shaming streaks, no big lottery.
24. **Proposed v1 layout:** tabs Home · Prices · **[Scan]** · Receipts · Me (details in the research doc §4).

---

## 7. ⚠️ The hard parts (honest)
1. **OCR + receipt parsing — accuracy is EVERYTHING** (PS: "we need 110% accuracy"). Honest truth:
   no reader is literally 100% (a torn/faded thermal receipt sometimes has no ink left to read) — but
   we design *for* near-perfect and catch the rest. Approach:
   - **Cloud vision-AI, accuracy-first** (PS decided). In **Phase 0** we benchmark the top vision models
     (e.g. Claude vision, Google) on your *real* receipts and pick the **most accurate**, then the
     **cheapest among the accurate ones** — not the other way round. (I'll pull exact current model
     options + per-image pricing when we run Phase 0.)
   - **A 1-tap confirm step** — the app shows what it read (total especially) so a rare mis-read is
     fixed in 2 seconds before it's saved. This is what makes the *saved* data effectively 100%.
   - **Community cross-validation** — many users scanning the same product/store means outliers get
     rejected automatically, so one bad read never pollutes the shared price.
   Bad reads are dangerous *because* they'd poison the community prices, so these three layers matter.
2. **Item normalization across stores** — recognizing Shop A's `COCA COLA 2LT` = Shop B's `Coca-Cola 2L`
   is what powers community price comparison. Fuzzy matching + a canonical product catalog (AI-assisted).
   Groceries-first helps: staples repeat, so the catalog builds fast. **This is the clever, valuable bit.**
3. **Community-data trust** — pooled prices can be noisy or gamed (fake prices, wrong store). Needs
   **validation**: multiple confirmations, outlier rejection, recency weighting, store/location tagging.
4. **Store + location normalization** — clean store identities; price varies by city/country → location-aware.
5. **Privacy done right** — strip identity from contributed price points; make "what I spent" clearly
   private; easy export/delete. It's both the right thing and on-brand.

---

## 8. 🏗️ Architecture (v1)
- **Mobile app:** React Native / Expo (reuse IziCamera's stack + EN/PT i18n + auth + brand), **separate repo**.
- **Scan → structured data:** camera photo → **cloud vision-AI** → JSON
  `{ store, date, items:[{name, qty, unitPrice, total}], total, currency }`. (On-device OCR later for cost/privacy.)
- **Backend:** **separate Supabase project** (shared — required for the community layer): users, receipts
  (private rows, RLS-scoped), and a **shared** `prices` table (anonymized: product × store × city × date × price).
- **Data model (rough):** `users`, `receipts`, `receipt_items`, `products` (canonical), `stores`,
  `store_locations`, `prices` (community), `categories`, `budgets`, `promotions` (retailer ads).
- **Offline-first scanning** (you're in a shop with no signal) → sync + contribute prices later.

---

## 9. 🔐 Privacy model (explicit)
- **Private (RLS-locked to the user):** receipts, items as *your purchases*, totals, categories, budgets.
  **This is never shared.**
- **Shared (anonymized, NO user id):** the price points (`product·store·address·city·date·price`).
  For "anonymous" to be *honest*, these rows must carry **no link back to a person** — that's a hard
  design rule.
- **Contribution: ON by default** (PS 2026-07-27) — everyone contributes prices; this is what makes the
  community data strong. **Prominent, repeated "100% anonymous — only prices are shared, never who you
  are or what you spent" messaging** at sign-up and in-app.
- **Opt-out: DECIDED (PS 2026-07-27) — keep a *real* opt-out, buried low-key in Settings (not prominent,
  not removed).** Contribution stays ON by default; the opt-out simply isn't advertised. This keeps ~all
  the data (almost nobody digs for it) while covering us for **Google Play Data-Safety** + **GDPR/LGPD**
  when we go global ("we share data with no way to refuse" can get an app rejected/fined). Cheap insurance.
- Easy full **export + delete** of personal data regardless.

---

## 10. 🗺️ Phased roadmap (GROCERIES first)
- **Phase 0 — Reality check (½ day, do FIRST):** feed 10–15 *real Mozambican grocery receipts* to a
  vision-AI; measure how clean the store/date/items/prices come out. This decides the whole approach.
- **Phase 1 — MVP:** scan a grocery receipt → parse → save (private) → list + running totals + manual edit;
  keep the photo.
- **Phase 2 — Categorize + private reports:** categories; spend by date/category/store; simple charts.
- **Phase 3 — Community prices:** contribute anonymized price points; per-item **"cheapest store / last
  price / last bought / trend"** + item normalization for groceries.
- **Phase 4 — Money-saver layer:** **basket optimizer**, deals feed, recurring-item radar, budgets.
- **Phase 5 — Retailer promotions (revenue):** shop profiles + promoted deals; Google Ads on free tier; Premium.
- **Phase 6 — Expand + platform:** pharmacy/fuel/restaurants/bars/clothes; barcode scanning; more countries;
  location-aware deals; e-receipt import.

---

## 11. ❓ Open questions still to settle
1. **OCR cost ceiling** — ✅ ANSWERED by Phase 0 (2026-09-02): Claude Sonnet 5 at ~$0.014/scan is both the
   most accurate tested and cheap enough; see §12. Still to decide: the free-tier monthly scan cap.
2. **Retailer promotions** — self-serve (shops sign up in-app) or we onboard them manually at first?
   (Manual first is simpler.)
3. **Government / e-invoice route** — ✅ RESEARCHED 2026-09-02 (`research/MOZAMBIQUE_GOVERNMENT_ROUTE.md`):
   Mozambique has no Brazil-style live e-receipt, no QR on receipts, no public invoice check; shops use
   AT-certified software and (since May 2025) upload a monthly invoice file. A QR shortcut is unlikely before
   2027–28 → **OCR stays the engine; add a hook for a future AT QR.** Government: pitch the AT as a
   "demand your receipt" partner after launch (endorsement, not data); a paid price-observatory dashboard for
   the Ministério da Economia via the World Bank EDGE GovTech fund (closes Feb 2027) once we have data;
   never "build the national e-invoice system". Faster "official data" path: AT-certified software vendors
   (Cegid Vendus, Primavera, Tlantic, PHC, wintouch) as opt-in API partners in Phase 5.

**Decided 2026-07-27:** cloud vision-AI, **accuracy-first** (benchmark cheapest-accurate at Phase 0);
extract everything incl. **store address**; **per-item** categorization (mixed receipts); **contribute-
to-community ON by default with a real-but-low-key opt-out in Settings** + strong "anonymous" messaging;
**Mozambique → world**; **groceries first**.

---

## 12. ✅ Next steps (nothing built yet)
1. PS confirms the §11 items (esp. OCR cost + contribute-by-default).
2. **Phase 0 spike** — I test grocery receipt → structured data on your real receipts before committing.
   **Status 2026-09-02:** 17 real receipts photographed (`phase0/receipts/`, a mix of MZ + SA supermarkets,
   restaurants, handwritten parking tickets, a card slip and a TV Cabo invoice); answer key written
   (`phase0/ground_truth.json`); benchmark + scoring scripts ready (`phase0/bench.py`, `phase0/score.py`,
   how-to in `phase0/README.md`).
   **RESULT (run 2026-09-02, full report in `phase0/REPORT.md`):**

   | model | receipts fully right | store | date | total | NUIT/VAT | items found | item prices | invented items | avg secs | cost / scan |
   |---|---|---|---|---|---|---|---|---|---|---|
   | Claude Haiku 4.5 | 5 / 17 | 94% | 76% | 82% | 73% | 99% | 99% | 3 | 5.6 | $0.005 |
   | **Claude Sonnet 5** | **15 / 17** | 100% | 100% | 100% | 100% | 100% | 100% | 0 | 10.1 | **$0.014** |
   | Claude Opus 5 | 15 / 17 | 100% | 100% | 94% | 100% | 100% | 100% | 0 | 9.6 | $0.032 |

   - Sonnet 5's only two "misses" are the payment-method field on two receipts where the paper is
     ambiguous (a handwritten parking ticket; "Ned:" on Supermercado Real) — not OCR errors. Every
     item line, price, quantity (incl. weighed 0.592 kg / 0,720 kg), date, total and NUIT was right,
     including the bleed-through Woolworths receipt, the Lokal receipt with decimal commas, and the
     crumpled tickets. It correctly returned *null* for the blank "Valor" and the garbled gin quantity
     instead of inventing numbers. Per-item categories were sensible (grocery/drink/alcohol/snack/household/utilities).
   - Opus 5 was equally accurate but missed the faint handwritten "20" on the crumpled parking ticket
     (returned null) and costs ~2.3x more. No benefit over Sonnet here.
   - Haiku 4.5 is cheap and fast but **not safe**: invented a wrong total on 2 receipts (Sasol, Lokal),
     got 4 dates wrong, 3 NUITs wrong, treated weighed items as qty 1, and hallucinated "Eiffel" as a store.
   - **Decision: Claude Sonnet 5 is the Phase 1 extraction model.** ~$0.014 per scan (≈ MZN 0.9) →
     a free tier of e.g. 30 scans/month costs ~$0.42/user/month; Premium at even $2/month covers hundreds.
   - Answers §11.1 (OCR cost ceiling): ~1.5 US cents per scan, accuracy first — no trade-off needed.
   - Not tested: Google Gemini (no key). Not needed unless cost becomes a problem at scale.
   - Caveat: 17 receipts, one photo each, daytime lighting. Phase 1 should log every user correction
     so we keep measuring real-world accuracy.

   **Round 2 (2026-09-02, after PS review) — extraction v2 + cost experiment.** Added per PS:
   `store_type` (supermarket / restaurant / bar_cafe / parking / fuel_station / utility_provider ...),
   two-level item categories (`food/vegetables`, `food/red_meat`, `food/poultry`, `food/fish_seafood`,
   `food/dairy_eggs`, `food/bakery_bread`, `food/pantry`, `food/snacks_sweets`, `drink/*`, `alcohol/*`,
   `restaurant/meal|starter_snack|dessert|drink|alcohol|coffee`, `household/*`, `pet/*`, `parking`,
   `utilities/*` ...), parking tickets become one item line, full branch address rule, MZ payment
   labels (Ned/POS/EFT = card, M-Pesa/Emola/mKesh = mobile_money).

   | Sonnet 5 setting | receipts fully right | item lines / prices / qty | avg secs | cost / scan |
   |---|---|---|---|---|
   | default effort (v2) | **17 / 17** | 100% / 100% / 100% | 10.0 | $0.017 |
   | effort = medium (v2) | 15 / 17 | 100% / 100% / 100% | 7.3 | $0.015 |
   | effort = low (v2) | 16 / 17 | 100% / 100% / 99% | 5.9 | $0.013 |

   - Medium's misses: read the faint "EFT 216.40" as the total on the Sasol receipt (real error, same
     one Haiku made) + a cosmetic payment field. Low's misses: gin qty left null (garbled on paper,
     defensible) + wrote "MZM" because that's what the bill prints. Low was faster and cheaper than
     default with no real error — but 17 receipts is too few to trust that; the medium miss shows
     the risk. **Decision: ship Phase 1 on default effort (~$0.017/scan); re-test effort=low once we
     have 50+ real receipts from the app. Every scan that gets corrected by a user is a free test case.**
   - Categories came out sensible: Woolworths lamb = food/red_meat, chicken = food/poultry, rocket =
     food/vegetables, wine = alcohol/wine; whole Piripiri bill = restaurant/*; Whiskas = pet/pet_food.
   - v2 expands abbreviations in item names ("Solo Washed Roc" → "Solo Washed Rocket"). Good for
     readability, but Phase 1 should keep BOTH: `name_as_printed` (for verification / receipt image
     match) and `product_name` (cleaned, for the community catalog).
   - **Currency (PS q.):** every receipt already carries its currency (ZAR vs MZN, 100% right). Plan:
     store amounts in the receipt's currency; user picks a home currency; reports convert using the
     exchange rate of the receipt date (free daily-rate API, cached in Supabase); show original in
     brackets. Community price comparison stays within one currency/country — comparing a Malalane
     price with a Maputo price makes no sense anyway.
   - **Branch address (PS q.):** extracted on 15/17 (the parking tickets have none). Phase 1 adds GPS
     at scan time + geocoding of the printed address → one `store_locations` row per branch, so
     "Shoprite Costa do Sol" and "Shoprite Matola" are different price points.
3. `git init` this folder; scaffold the Expo app (reuse IziCamera setup); stand up a **separate** Supabase
   project with the private/shared split.
4. Build the Phase 1 grocery MVP.

**Phase 1 status (2026-09-02, one session):**
- ✅ git repo (GitHub `pierresliver/izicost`, private; first push pending PS running `git commit`/`git push`).
- ✅ Supabase project `izicost` (ref `ehomstenpqngybtemtad`): tables `receipts`, `receipt_items`, `stores`
  with row-level security; private `receipts` photo bucket; guest (anonymous) sign-in on; email autoconfirm on
  for testing (revisit before launch). Schema in `supabase/schema.sql`, applied via `scripts/setup-supabase.js`.
- ✅ Edge Function `extract-receipt` (holds the Anthropic key; validates the caller; Sonnet 5 with the Phase 0 v2
  prompt + per-line confidence). Deployed via `scripts/deploy-function.js`. End-to-end tested from the PC
  (`scripts/test-backend.js`): Shoprite 10.5 s, Lokal 18 s, all fields right.
- ✅ App (`app/`, Expo SDK 57, expo-router): 4-card intro (Snap → Check → See where money goes → Cheapest,
  anonymous) · tabs Home / **Scan** / Receipts / Me · take or pick photo → compress → upload → read (~10 s) →
  **Confirm** (photo + editable header + items, low-confidence lines highlighted, sum-vs-total check, category
  chips) → Save · Receipts list + detail with photo + delete · Home month total / top stores / by category ·
  Me: guest → "Create account" (email+password, keeps data, IziCamera pattern), sign in, sign out, EN/PT switch,
  privacy statement, replay intro. Fully bilingual (English string is the key; PT dictionary).
- ✅ Code review by a second agent applied (number inputs, language init, navigation after save, function auth).
- ✅ Local APK build 1 (`scripts/build-apk.ps1`, JDK 22 + D:\Android\Sdk, 48 min first time, then fast):
  `builds/izicost-v0.1.0-2026-09-02-1746.apk` (101 MB; next builds ARM-only ≈ 40% smaller). PS's Expo Go is
  v54 and the project is SDK 57, so testing happens with the APK.

**Same evening — "don't hold anything back" build (Phases 1.5–4 in parallel, 4 builder agents + review):**
- ✅ **Scanning:** full-screen camera (receipt frame, torch, shutter, per-shot "sharp?" review), up to 4 photos per
  long receipt (function reads them as one), gallery multi-select, **offline queue** (photos kept on the phone,
  auto-retry when online, badge + Retry now), haptics, multi-photo viewer on Confirm and receipt detail.
  Daily scan cap (40/user/day, `scan_events` table) in the function.
- ✅ **Phase 2 reports:** Home dashboard (month total + vs last month, 6-month bars, category ring, top stores,
  weekly recap card, due-soon recurring items, inflation teaser), Reports hub (by month / categories / stores /
  budgets / inflation / search / CSV export), budgets with "left per day" rings (80%/100% colours), weekly
  recap notification (Sunday 18:00, asked politely after the first receipt). Migration 002.
- ✅ **Phase 3 community prices:** migration 003 — `products` (fingerprint `product_key`, size parsing),
  `price_points` with **no user or receipt id**, trigger copies anonymised price points on save (skips
  restaurants/parking/utilities), `community_prices` view with **k-anonymity ≥2 reports in 60 days**, cities table,
  quick-add RPC (30/day, separate log table that never joins to prices), price reports, price alerts, nearby
  stores (haversine). Prices tab: search, Near me / My city / By city / Anywhere, freshness badges; product page:
  cheapest now, per store / per city, 90-day trend, your last price, report wrong price, set alert; market
  quick-add screen. GPS pin of a branch on first scan (migration 004, only fills empty coordinates).
- ✅ **Phase 4:** shopping basket (autocomplete from the catalogue, qty stepper, tick/delete) → "Where is it
  cheapest?" ranked store cards (items found, total, distance, "you save X" pill) + **split-basket suggestion**
  (2 stores) + cheapest-per-item + missing-items; follows the Prices scope (Near me / My city / By city / Anywhere);
  price alerts checked on Prices-tab focus (10-min throttle, banner, never repeats a hit), "My alerts" screen,
  "Add to basket" on the product page. Migration 005 (`shopping_lists`, `shopping_list_items`,
  `price_alert_hits`, RPCs `basket_quote`, `check_price_alerts`, all reading only the anonymised view).
- ✅ **Build 2:** `builds/izicost-v0.2.0-2026-09-02-1842.apk` (all of the above; 25-min build). Basket review fixes
  (commit 91da570) landed after its bundle → they ship in build 3.
- ✅ Security/code review by a separate agent, fixes applied the same evening: raw `price_points` table was
  readable by any signed-in user (bypassing the ≥2-reports rule) → now readable ONLY through the owner-run
  `community_prices` view + definer trend RPC, verified from a guest session; migration 003 made re-runnable;
  duplicate-line and 400-lines/day flood guards in the price-point trigger; `receipt_items` policy now checks
  the parent receipt belongs to the caller; clients can no longer set store coordinates/city; quick-add input
  caps; read RPCs revoked from anon; daily-cap env guard + CORS in the function; GPS only requested when a
  branch has no coordinates and "Not now" respected for 7 days; corrected line totals recompute unit price;
  unreadable dates fall back to today instead of hiding the receipt; cancelled scans delete their uploads;
  CSV export neutralises formula injection. Remaining known limits: k-anonymity counts reports, not people;
  price alerts stored but only checked in-app (no push); `price_reports` has no rate limit yet.

**Day 2 (2026-09-03) — PS's build-2 findings + refocus on bargains:**
- 🐞 **Photos gone on every saved receipt (fixed):** the Confirm screen's "delete uploads when the user cancels"
  cleanup also fired right after a successful save (it re-ran whenever the `saved` flag changed), so every photo
  was deleted seconds after saving. Verified in the DB: storage bucket empty, 5 receipts pointing at missing files.
  Fixed with a ref + unmount-only effect. Photos of receipts saved with build 1/2 cannot be recovered; the detail
  screen now says so instead of showing a blank space.
- ✅ Receipt detail: tap an item → change its **category** (chips), saved immediately. Prices stay read-only.
- ✅ **Market quick-add switched off** (PS: a troll could poison the pool): buttons removed from the Prices tab,
  the screen shows "coming later" if opened by deep link, and **migration 008 revokes the RPC** server-side (003's
  grant commented out so re-running it cannot re-enable it). Bring back later with trust rules (ignore brand-new
  accounts, medians — the community view already uses medians).
- ✅ **Invite friends**: phone share sheet (WhatsApp etc.) from Home and Me, message in the user's language.
  `APP_LINK` in `app/src/features/share/share.ts` is empty until there is a download page / Play listing.
- ✅ **Voice shopping list** (PS idea): mic on Home and in My basket → phone's own speech recogniser
  (`expo-speech-recognition`, pt-PT / en-ZA, free) → Edge Function `parse-shopping-list` (Sonnet 5, effort low,
  ~3–5 s, structured items name/qty/size, 60/day cap via `assist_events`, migration 007) → matched to the
  catalogue → review sheet → "Add N items and compare" → straight to *Where is it cheapest?*. Offline fallback
  splits the sentence locally. Tested from the PC: "dois quilos de arroz, leite, uma dúzia de ovos e três pães"
  → arroz [2kg], leite, 12× ovos, 3× pão; chit-chat → empty list.
- ✅ **Home is now bargain-first** (PS decision: the main promise is *where to buy cheaper*, expenditure is the
  private reward that makes people scan): hero "What do you need to buy?" (type / speak) + basket pill →
  scan card ("keeps prices fresh, tracks your spending") → community prices / invite → spending dashboard below.
  Intro cards reordered: say what you need → see where it is cheapest → scan to keep prices fresh → better together.
- ✅ **Cold start decided (PS):** show community prices from the FIRST report ("a bargain with one option is still a
  bargain"). Migration 009 makes the threshold a setting (`community_settings.min_reports`, read by
  `min_reports()`) used by the view and the trend RPC; set to 1 now, one-row update to go back to 2 before a public
  launch if we want k-anonymity back. App texts no longer promise "at least two reports"; the report count is shown
  on every price so users can judge.
- ✅ **Household sharing** (PS: "how much is my household spending"): migration 010 — `households` +
  `household_members` (one household per user, max 12, owner/member roles), 6-character invite code (rotatable),
  needs a real account (guests refused), 20 join attempts/day. Members READ each other's receipts, lines and
  photos (extra SELECT policies); edit/delete stay owner-only. RPCs create/join/leave/remove/rotate/rename/
  set-name/overview, all security definer with fixed search_path. App: Me tab card (create / join / members /
  share code / leave), **Me / Household switch** on Home, Receipts and Reports (persisted; every receipt query goes
  through `scopeUserId()`), "Household this month" per-person card, "Scanned by X" on shared receipts, read-only
  detail for others' receipts. 27-check live test passed (RLS boundaries, owner-only RPCs, code rotation, leave).
  Budgets stay personal (a household budget is a later feature). Review-agent fixes applied: account check reads
  `auth.users.is_anonymous` (the phone's token still says "guest" for up to an hour after upgrading) + the app
  refreshes the token after creating an account; roster refreshed on every Home visit; budgets + weekly recap +
  "your usual items" always personal (`onlyMe`); CSV gets a `scanned_by` column; scope caption on every report.
- ✅ **Migration 011 — least-privilege grants:** anon (no session) had the default "everything" grants on every
  table and could read the `community_prices` view without signing in; authenticated could TRUNCATE. Now anon has
  nothing in `public`, authenticated has exactly the verbs its RLS policies allow, and the defaults for future
  tables are locked. Verified from the PC: no-session read of the view / search RPC / stores is refused; every
  backend test (security, household, voice list, scan) still passes.
- ✅ **"My items" price watch** (PS: make the dashboard fun and dynamic): migration 012 — `watch_items` (own rows),
  `watchlist_autofill()` fills the list from products bought ≥2× in 180 days (groceries only; hidden items never
  return), `watchlist_overview()` returns per item the cheapest current community price (store · city · when ·
  reports), 60-day low, 14-day vs earlier medians, the user's own last price, and an 8-week sparkline. Home card:
  green ▼ / red ▲ / grey pill with % vs *what you paid* (fallback: community median before), 🔥 "lowest in 60 days",
  sparkline, bell per item, long-press to remove, 🎉 banner when items got cheaper. Product page: ☆ Watch this item.
  Notifications (stage A): local notification per new drop when the app checks the list (Home focus), permission
  asked on the first bell; `last_notified_price` prevents repeats. **Stage B = server push while the app is closed
  (needs a scheduled job + push tokens) — next.** 15-check live test passed.
- ✅ **Security review (agent, 4th attempt after 3 server-overload failures) → migration 013 + function changes:**
  authenticated now has an explicit function allowlist (extension functions re-granted; internal helpers never);
  sequences locked (only `price_reports_id_seq`); caps: 300 lines per receipt, 100 receipts per user per day;
  household default display name no longer derived from the email; both Edge Functions got a **global daily brake**
  (600 scans ≈ US$10, 2000 list parses) because guest accounts are free to create, plus try/catch around the
  Anthropic call and generic error text (details stay in the server log); anonymous sign-ups limited to 10 per hour
  per IP (Auth setting). `deleteReceipt` now errors when nothing was deleted; receipts list capped at 500 rows.
  Agent's open points for the launch checklist: **captcha on guest sign-up** (still #1) and **`min_reports` back
  to ≥2** before public launch (with 1, a single fake receipt sets a visible community price).
- ✅ **Dashboard charts (PS: fun, dynamic, interactive):** bars, rings and budget rings now animate in; the weekly
  bars slide; **category inflation** ("alcohol ▲8%, vegetables ▼3%") as ± horizontal bars on the Inflation report
  and as pills on the Home teaser; **community price index per city** (migration 014 `city_price_index`: median
  month-over-month change of the same products, chained to base 100, a month needs ≥3 products) with a multi-line
  chart report + Home teaser ("Maputo ▲4% in Sep"); **price by store over time** on the product page (migration 015
  `product_store_trend`: weekly medians per store, 180 days) so PS can watch how each shop moves picanha / whisky.
  Both new RPCs security definer, authenticated only. Empty states explain what data is still needed.
**Day 4 (2026-09-04, afternoon) — Shelf scan + brands (no build yet; build 7 needs PS's yes):**
- ✅ **Shelf scan** (tester-only): Scan tab card → `/shelf` setup (shop from GPS within 1 km, name search, or create;
  interval 3/5/8/12 s remembered) → `/shelf/capture` (5-s countdown, then a silent photo every N s with the screen
  almost black, `shutterSound:false`, keep-awake, tap to pause, AppState pause, max 120 shots, originals deleted after
  the 1200-px copy) → `/shelf/photos` (grid, cheap sharpness score = JPEG bytes per 1000 px of a 320-px copy, blurry
  ones flagged and skipped by default, tap to keep, gallery add, upload in batches of 12) → `/shelf/review` (name,
  brand, price, each / per kg / per l, promo, category; typed lines marked `manual`) → publish. Files
  `features/shelf/*`, `app/shelf/*`, `features/shelf/i18n.ts`.
- ✅ **Backend:** migration 024 (`price_points.source` 'shelf', `scan_events.kind`, `trusted_seeders`, setting
  `shelf_scan_open` = '0', private `shelf_scans` / `shelf_items`, RPCs `shelf_scan_allowed`, `save_shelf_scan`,
  `my_shelf_stats`); Edge Function `read-shelf` (Claude Sonnet 5, JSON schema, photos deleted from the bucket in a
  `finally`, fail-closed caps: 300 photos/person/day + 1500/day global reserved in `scan_events` before the model
  call, guest sessions refused). `scripts/trust-seeder.js <email|id-prefix>` flags testers; the three real accounts
  (PS's household) were flagged 2026-09-04. Open to everyone later with
  `update community_settings set value='1' where key='shelf_scan_open'` (needs a real account even then).
- ✅ **Brands** (migration 025): `brands` reference list (~170 MZ/ZA brands, grows from trusted shelf scans),
  `detect_brand()`, `products.brand` + `products.generic_key` (name without the brand words) backfilled,
  `upsert_product(..., p_brand)`; `shopping_list_items.brand_pref` (null = any brand); `basket_quote` now prices, per
  shop, the cheapest brand that fits each line (result items carry `product_name`, `brand`, `product_key`);
  `item_brand_options` (brand picker), `product_brands` (Compare-brands card on the product page). App: brand chip on
  every list line ("Any brand" / a brand) with a picker sheet showing the cheapest price per brand; voice/typed
  "leite parmalat" keeps to Parmalat; quote card shows the brand actually priced; product page "Compare brands".
- ✅ **Reviews (3 agents):** security (no critical/high; fixed: fail-open caps, orphaned photos, guest accounts, 0.00
  prices, subcategory free text, currency vs shop country, weekly instead of daily dedupe of shelf readings so a daily
  walk cannot inflate report counts, sequence revoke), functional (fixed: Android shutter click, lost price unit,
  wrong currency for a nearby shop, "Take more photos" losing shots, cache leak, per-l chip, photo numbering,
  accessibility labels, dark-mode card). Live tests: 32 shelf checks + 24 brand/hardening checks + one real read of a
  synthetic label picture (3/3 labels right, promo and per-kg handled, photo gone from storage). Typecheck clean,
  lint: nothing new (9 pre-existing style errors in older files), translation audit 0 missing.
- ✅ **Third review (brands + shelf fixes) → migration 026:** a product named only "brand + size" ("Parmalat 1L") no
  longer collapses to the generic "1l" (milk, oil and water would have become one family); only trusted seeders can
  teach new brands and typed lines of non-seeders never touch the catalogue; 'Oleo'/'Rooibos' removed from the brand
  list; LATERAL join in `basket_quote` / `item_brand_options` (the candidate function ran once per price row);
  brand picker uses the region's currency, de-duplicates brands, reverts on failure; whole-word brand match when
  parsing speech. All live suites re-run: pass.
- ✅ **Build 7 (PS's yes, 2026-09-04 ~15:30):** `builds/izicost-v0.5.0-2026-09-04-1549.apk` (0.5.0 / versionCode 7,
  74 MB) handed to PS. **Slim download published:** `builds/izicost-v0.5.0-2026-09-04-1606-arm64-slim.apk` (44 MB)
  → public `releases` bucket as `izicost-latest.apk` + `latest.json` (Update button and invite link now work). The
  slim build script now sets `android.enableMinifyInReleaseBuilds` (SDK 57 name; the old ProGuard flag alone made
  Gradle fail). **PS never installed builds 5 and 6** (phone was still on 0.3.1 / build 4), so build 7 is the first
  look at everything since Day 3: the build-7 findings cover Day 3 + rounds 2–3 + Day 4.
- 🐞 **Build-7 findings, evening (PS was on build 4 until today):** (1) "permission denied for function
  city_price_index" — since 013 new functions need an explicit grant and 014–016 forgot it for `city_price_index`,
  `city_staples`, `community_ticker`, `product_store_trend` (price-index screen, staples table, ticker and per-store
  chart were refused for everyone). Migration 027 grants them and switches every function still callable through
  PUBLIC (i.e. by anon without a session) to an explicit authenticated grant; live test: 15 app RPCs × account /
  guest / no-session all behave, 4 internal functions refused. Server-side, works on build 7. (2) Demo data only
  covered June–Sept, never used Woolworths for personal receipts and had no photos → `seed-demo.js` now seeds
  **12 months** (Sept 2025 → today; 8–10 receipts/month, denser in the last two weeks, ~100 per account),
  Woolworths as an occasional third shop, restaurant/parking extras spread over the year, 17 881 community price
  points, and **PS's own phase-0 receipt photos** attached as sample photos (93 uploads, 9.5 MB; `clean` deletes
  them too; the photos do not match the fake lines — say so to testers). Reseeded 2026-09-04 evening. (3) Reports
  and the Home bar chart now cover **12 months** (label every other month when > 8 bars) — needs build 8.
- ✅ **Build 8 (PS's yes, ~16:45):** `builds/izicost-v0.5.1-2026-09-04-1706.apk` (0.5.1 / versionCode 8) = build 7 +
  12-month charts; slim `builds/izicost-v0.5.1-2026-09-04-1722-arm64-slim.apk` (44 MB) published as the download.
- 🐞 **Build-8 screenshots (17:39):** "Este mês 0.00 MZN" and the category ring at 0 while the Set bar and the legend
  showed 1 900 — my 12-month change left `thisMonth = monthPoints[5]` (and `trend[5]` in detail.ts) hard-coded from
  the 6-month layout → March. Fixed (`length - 1`); needs build 9. The phone showed only the 5 real receipts because
  **PS's phone IS the old guest d36d289a** (no account was ever created), which the seed skips on purpose; added
  `seed-demo.js user <id>` and gave that account the demo year (110 receipts + 9 photos; real receipts untouched).
  Creating the account in the Me tab upgrades this guest in place, so no receipt move is needed after all.
- ✅ **Build 9 (PS's yes, ~17:50):** the "this month" index fix on Home, the category ring and the category detail page
  (a sweep found the third leftover, `trend[5]` in `app/reports/category.tsx`), plus PS's two asks: the month headline
  card now opens that month's report page (chevron shown) and the weekly summary card opens the week story.
  File: `builds/izicost-v0.5.2-2026-09-04-1904.apk` (0.5.2 / versionCode 9); slim published as the download.
- 🐞🐞 **Build 9 first attempt was BROKEN (18:26):** I stopped a running build to add the tappable cards and restarted
  it. The stop landed in the middle of `expo prebuild`, which had already rewritten `android/app/build.gradle` with the
  bare template; the restart saw build.gradle newer than app.json, skipped prebuild and built the template:
  package `com.helloworld`, versionCode 1, light theme, no IziCost config. It installed on PS's phone as a SECOND app
  (empty, white, new guest 925a0c8b) next to the real IziCost (build 8, all data intact). PS: uninstall the white one.
  File renamed `builds/BROKEN-do-not-install-…-helloworld.apk`. Fixes: `expo prebuild --clean` re-run; the build
  script now refuses to build when build.gradle lacks the app's applicationId and, after Gradle, checks the APK's
  package + versionCode with `aapt` before copying it to builds\. Lesson (also in memory): never stop a build
  mid-way — let it finish or kill Gradle AND re-run prebuild --clean.
- 🐞 **Build-9 findings (19:16):** "12 items in your basket" → "no community prices yet": all 12 lines were free text
  and matching needed an exact product key ("cebola amarela 1kg" ≠ "Cebola kg"). Migration 028: `list_item_candidates`
  also matches free-text lines by first word + pg_trgm similarity ≥ 0.3 + compatible sizes (`sizes_compatible()`,
  so "água 500ml" never meets "Água Vumba 5L"); PS's two onion lines now price at Shoprite/Recheio; the other 10 are
  simply not in the pool. Server-side, live on build 9. In the app (build 10): the empty result lists every item with
  "no price yet" and explains why; the brand chip moved under the item name (it was squeezing names to "sal fino de
  mes…"); the Home pill "N items in your basket" opens the basket (it went straight to the comparison); basket icon
  in the Home and Prices headers (PS: "hard to find the basket"); list menu gains "Empty this list" (`clearList`).
- 🏁 **Session ended 2026-09-04 ~19:40.** On PS's phone: build 9 (`izicost-v0.5.2-2026-09-04-1904.apk`); slim 0.5.2
  published. Waiting on PS: uninstall the white `com.helloworld` app; create the account (Me tab) → then
  `trust-seeder.js` for Shelf scan; yes/no for build 10 (basket fixes). Migrations 001–028 applied; demo data (12
  months, photos) still in the DB. Repo clean, last commit pushed.
- 🐞 **Correction (evening):** the three "real" accounts were NOT PS's household — they were my own Day-3 test
  accounts (hhtest.*@example.com) that the household test never cleaned up. Deleted them (with their seed receipts)
  and their seeder flags. **PS has no account yet: the phone is still a guest** (pcmdsiziadvertising@gmail.com is not
  in auth.users). Next: PS creates the account in the Me tab (the guest is upgraded in place, same id, receipts kept),
  then `node scripts/trust-seeder.js pcmdsiziadvertising@gmail.com` and move the 5 old guest receipts (d36d289a,
  photos too: storage move + `image_path` rewrite). `shelf_scan_open` stays '0'; the "photo N" link opens nothing yet.

**Day 3 (2026-09-04) — "make it shareable, alive and talked about":**
- ✅ **Demo data** (`scripts/seed-demo.js`, `clean` to remove): 12 fake branches in Maputo/Matola/Beira/Nampula, 30 products,
  ~4,400 community price points over 90 days, ~26 receipts per test account (`notes='SEED'`). PS's phone had a fresh
  account with 0 receipts → that is why Home showed no charts.
- ✅ **Alerts while the app is closed (stage B, no Firebase needed):** `expo-background-task` wakes the app every few
  hours, checks the watch list and fires local notifications; armed when a bell is turned on. Tapping any
  notification opens the right screen (`data.route`). "Lowest in 60 days" gets its own 🔥 title.
- ✅ **Share cards** (`features/share/share-card.tsx`, react-native-view-shot + share sheet): branded PNG with the
  invite line — on product pages (cheapest + per-store list), the basket result ("you save X at A vs B"), the
  inflation number + category movers, the city index, and every slide of the weekly story.
- ✅ **Open data in the app** (PS: push app users, not a web page): Price index report now has a staples table per
  city (migration 016 `city_staples`: 30-day medians, spread, counts, change vs the 60 days before), a **CSV download**
  (index + staples for every city, free to use with a mention) and a share card. **Live ticker** on the Prices tab
  (`community_ticker`: this week's movers per city + prices arriving today).
- ✅ **Weekly story** (`app/recap.tsx`): full-screen swipeable slides — your week, biggest shop, best find, category
  movers, **household leaderboard** — each shareable; opened from Home's weekly card and the Sunday notification.
- ✅ **Badges** on Home (receipts scanned, weeks in a row, stores explored, with progress rings); month total counts up.
- ✅ **Update button** (PS asked, like IziCamera): Me tab shows the installed version, "Check for updates", and a
  Download button when `latest.json` in the public `releases` bucket (migration 017) has a higher versionCode;
  `scripts/publish-release.js <apk>` publishes. The invite link now points at the latest APK. Caveat: the Free plan
  caps files at 50 MB, so the published download must be the slim arm64 build (`build-apk.ps1 -Abi arm64-v8a -Slim`);
  PS's test builds stay dual-ABI. Build 4 (74 MB) could not be published for that reason.
- ✅ **Day 3 reviews:** security agent (medium: the "before" medians in the new RPCs skipped the `min_reports()` floor →
  fixed; URL allowlist tightened; date index for the ticker; releases bucket verified write-proof for anon and
  guests). Correctness agent (high: the background task was defined from the router layout, which never loads in a
  headless wake → moved to `app/index.js` as the app entry; high: streak badge used UTC dates → always 0 in UTC+2 →
  local dates; notification taps parked until the stack is mounted and de-duplicated; alerts re-armed at startup for
  users who were already "on"; headless notifications honour the chosen language; recap skips an empty week; update
  card distinguishes "could not check"; seed clean-up deletes products in a second statement; ticker "today" = today).
  Build 5 needed for all of Day 3 (new native modules: background task, view capture).
- ✅ **Round 2 (PS's requests):** "Near me" **radius** 2/5/10/25 km (remembered, Prices + basket result; same GPS fix
  reused when the radius changes); demo branches now have real coordinates so Near me works on the seed data.
  Basket result: **Latest / Typical price** toggle (`basket_quote(..., p_typical)` uses 60-day medians), **Rank by
  items found / Estimated total** (missing items counted at their typical price so partial stores compare fairly),
  **Worth the trip** card (saving vs the nearest store per extra km, threshold 15 MZN/km). **Several shopping lists**
  (create, rename, delete, switch, **merge** via `merge_shopping_lists` — same product or name adds up, sources
  removed; max 20 lists; active list remembered; product-page "add to basket" uses the active list).
  **Dashboard**: duplicate cards removed (scan card = tab-bar button, community prices = Prices tab, invite moved to a
  small link at the bottom), numbers and charts first, and the "Loading…" that never went away fixed (Home waited for
  the household lookup before loading anything; now it loads at once and refreshes when the household is known) with
  a retry button on errors.
- ✅ **Round 2 reviews:** correctness agent (high: the list menu used a system alert, which Android caps at three
  buttons → Delete would have been unreachable → replaced by a bottom sheet that also targets the pressed list;
  Home cold start could run two loads and keep the stale one → sequence guard; estimates now use only stores in
  scope; no "locating" flash on a radius change; live chip counts; currency-aware trip threshold; consistent share
  card; merge respects the 200-item cap and matches names symmetrically; 013's allowlist tolerant of renamed
  signatures; server messages translated). Security agent (low: trigger helpers and the price-point trigger get
  explicit revokes — migration 020; `nearby_stores` radius clamped 0.5–50 km; merge takes ≤20 lists; rename/delete
  filter by owner). Verified: zero own functions callable without a session; trigger still fires; merge test passes.
- ✅ **Round 3 (PS: "go for it, then build"):** **shared household lists** (migration 021: `shopping_lists.household_id`,
  `can_use_list()`; members read/add/tick/remove items of a shared list, only the owner renames/shares/deletes;
  basket quote works on shared lists; list menu "Share with the household"), **Buy again** on receipt detail (all lines
  → active list, weights rounded to packs, then "Compare stores?"), **price alerts for a whole list**
  (`watch_list_items`: every product of the list joins My items with the bell on), **store page** (`/store/[id]`:
  median % vs its city with cheaper/dearer counts, weekly store index "how this shop moves its prices", per-product
  list vs city typical, share card; linked from product pages and basket results), small polish (card corners unified).
- ✅ **Round 3 reviews:** correctness (high: a shared list stayed usable by the household after its owner left →
  migration 022 unshares on leave/remove and requires the owner to still be a member; merging a shared list kept
  only the owner's items → fixed; store page hard-wired to MZN → follows the store's country; Buy again used the raw
  OCR name → uses the confirmed name; weights round up; cap checked first; menu/merge gates; chip order).
  Security (medium: a member could move items between lists or change their author via a direct update, bypassing the
  200 cap → migration 023 trigger: author immutable, moves only inside the server merge via a transaction flag;
  store index honours `min_reports()`). Verified live.
- ✅ **Build 5:** `builds/izicost-v0.4.0-2026-09-04-1146.apk` (Day 3 rounds 1–2). **Build 6** = `builds/izicost-v0.4.1-2026-09-04-1206.apk`
  (0.4.1 / versionCode 6) with round 3 (shared lists, buy again, list alerts, store page) — handed to PS.
- ✅ **Next (PS ideas, agreed) → built on Day 4:** *Shelf scan* (interval capture, sharpness filter, GPS shop, source
  'shelf', trusted seeders) and *brands* (brand + generic key on every product, brand chip on list items, cheapest brand
  per shop, Compare brands). See the Day 4 block above.
- 🐞 **Basket add failed** ("infinite recursion detected in policy for shopping_list_items", PS's 20-item voice list):
  the 200-item cap from 006 counted the table inside its own policy. Migration 018 moves the cap to a definer
  trigger; verified from the PC (6 adds OK, other user still refused). Server-side only — no new build needed.
- ✅ Checks: typecheck clean; `expo lint` set up (eslint + eslint-config-expo added; today's files clean, 16
  pre-existing "setState in effect" style warnings left in older files); translation audit 0 missing (now also
  scans .ts files); review agent's 11 findings fixed (offline splitter, cancel-during-parse race, sheet never
  hangs, half-added lists, function fetch guard, FK on assist_events); security script: function refuses callers
  without a session, RLS blocks cross-user category edits/reads, quick-add RPC refused, assist_events hidden.
  extract-receipt smoke test still passes after the redeploy.
- ✅ **Build 3 (PS consented 2026-09-03 evening):** `builds/izicost-v0.3.0-2026-09-03-1855.apk` (74 MB, phone-only ABIs,
  versionCode 3, prebuild ran: microphone permission present). Contains everything from Day 2. Handed to PS for testing.
- 🐞 **First phone test (PS's dad):** Portuguese not understood (recogniser followed the app language) and listening
  stopped after 2–3 s (single-phrase mode). Fixed: PT/EN switch on the sheet (remembered, defaults to PT in
  PT-speaking regions), continuous listening until Done, "Paused → Add more" when the phone stops early.
  PS's phone was on a fresh account with 0 receipts (yesterday's 5 receipts sit on the old guest) → no charts;
  added a placeholder chart card before the first receipt. Receipt migration to PS's new account: pending PS's email.
- ✅ **Build 4:** `builds/izicost-v0.3.1-2026-09-03-2010.apk` (versionCode 4) — voice fixes + placeholder chart.

**Security — in place (2026-09-02):** AI key only on the server function, never in the app; the app ships only
the public URL + publishable key (grant nothing without a session); row-level security on every table (a user
can only read/write rows where `user_id = auth.uid()`, enforced by the database, not the app); private photo
bucket with per-user folders; the function validates the caller's token and refuses paths outside the caller's
folder; all traffic HTTPS; secrets git-ignored; 30-day management token; upload limits (JPEG/PNG, 5 MB).

**Security — MUST DO before public launch (checklist):**
1. **Abuse / cost cap:** anyone can create a guest session and call the AI function → add a per-user daily scan
   cap in the function + Supabase captcha (Turnstile) on anonymous sign-ups + per-IP rate limit.
2. **Turn email autoconfirm OFF** (on for testing; without it anyone can claim any email address).
3. **Permanent signing keystore** (APK is debug-signed for testing) stored with IziCamera's, backed up offline.
4. `stores` insert policy: validate/limit (currently any signed-in user can add store rows).
5. Data export + delete-my-account flow; privacy policy + Play Data-Safety form; k-anonymity rule before any
   community price is shown (≥2–3 independent receipts).
6. Supabase paid plan for daily backups + point-in-time recovery once real users exist.
7. Security review pass (like IziCamera's) before launch: RLS audit script, dependency audit, no sensitive logs.

> Decisions locked 2026-07-27: **name = IziCost**; **Mozambique → world**; **shared community prices**
> (cloud); **groceries first**, then all categories; **retailer promotions + Google-ads free tier + Premium**;
> business/tax tier parked. **This is a plan only — no code written yet.**
