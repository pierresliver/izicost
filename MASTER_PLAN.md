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
- 🔨 Local APK build (`scripts/build-apk.ps1`, JDK 22 + D:\Android\Sdk, no EAS): first build in progress.
  PS's Expo Go is v54 and the project is SDK 57, so testing happens with the APK.
- Next: PS tests on the phone → fix what he finds → Phase 2 (reports/charts) → Phase 3 (community prices).

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
