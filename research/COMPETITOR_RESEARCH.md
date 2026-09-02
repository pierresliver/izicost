# IziCost — Competitor research & feature plan (2026-09-02)

> Written for PS. Three web-research passes (receipt/expense apps, price-comparison apps, UX & user complaints)
> plus Claude's own additions. Full notes with every source link are in `raw_1_*.md`, `raw_2_*.md`, `raw_3_*.md`
> in this folder. Facts marked *(uncertain)* could not be verified.

---

## 1. The one-paragraph verdict

Nobody does what IziCost wants to do. There are two separate worlds today:

- **Receipt-scanner expense apps** (Yomio, GroceryTracker Pro, Groceries Tracker, GroceryTrack, Fetch, Spendee, Wallet…) read your receipt for *you*. The best ones now extract line items and show your own price history. **None pools prices across users.** All target the US/Canada/EU. Only two even have a Portuguese interface.
- **Price-comparison apps** (Brazil's Menor Preço / Preço da Hora, Argentina's Precios Claros, Trolley UK, Grocify SA, Kabaz PT, Basket, Numbeo…) tell you where things are cheap, but their prices come from **government e-invoices, retailer websites, or typed-in user entries**. The typed-in ones (Frugl, Basket) failed or stalled because nobody wants to type prices. The retailer-scraped ones only know chain-level online prices, not branch-level shelf prices, and get 1-star reviews when they're stale.
- **Mozambique has no price-comparison app at all.** Angola's MarcheApp appears dead. Zimbabwe has a website of tables.

The Brazilian government apps are the proof that the IziCost model works: *every real sale, tied to a branch, a date and a price, feeding one database* gave them millions of users and a 4.8★ app in Bahia. They get that data for free from the tax authority. **IziCost gets it from the camera instead, as a by-product of something people already want (tracking their spending).** That is the whole bet, and the research says it is the right one.

---

## 2. Who does what (short version)

### Receipt-scanning expense apps
| App | Line items? | Community prices? | Price | Notable |
|---|---|---|---|---|
| Yomio | Yes (~92% claimed) | No | Free / $5.99 mo | 10+ languages incl. PT, family sharing, AI chat over receipts |
| GroceryTracker Pro | Yes | No | 15 free scans/mo, $2.99 mo | Guest mode no signup, 70+ categories, per-store price history, "shrinkflation" alerts, crop-and-stitch long receipts, remembers your custom product names |
| Groceries Tracker | Yes | No (your own history only) | ~$5 mo | "compares what you actually paid", household groups, no ads/no data selling |
| GroceryTrack | Yes | No | 10 free / $3.99 mo | Offline mode, two-step review, perishable countdown, "Grocery Year" heatmap |
| Fetch (US) | Internally | No | Free (sells your purchase data to brands) | 7.6M ratings, 4.9★. Big central Snap button. Privacy complaints. |
| Receipt Hog (US/CA) | Internally | No | Free (sells data) | Gamified coins; users never see extracted items |
| Spendee / Wallet / Monefy / Money Manager | No (totals only or manual) | No | Freemium | Polished budgets, donut charts, one-tap add; users angry at "lifetime" plans turned into subscriptions |
| Expensify / Smart Receipts / Foreceipt | Partial | No | Business pricing | Scan caps, date misreads, subscription fatigue |

### Price-comparison apps
| App | Where prices come from | Granularity | Basket optimiser | Verdict |
|---|---|---|---|---|
| Menor Preço (Paraná, BR) | Government e-invoices, 10M prices/week | Branch, 1–20 km radius, "pin to another city" | Yes | The model to copy. Poor UX (1.7★) |
| Preço da Hora (Bahia, BR) | Government e-invoices, ~5 min delay | Branch, 10–30 km or pick a town | Yes + alerts + history | 1.1M downloads, 4.8★. Best UX of the three |
| Precios Claros (AR) | Chains legally forced to upload daily | 30 nearest branches | List only | Stale, missing branches |
| Trolley (UK) | Retailer websites | Chain only | Group list by store | 1.9★: wrong prices, no support, no loyalty prices |
| Grocify (ZA, 2026) | Scrapes 7 chains' websites | 4 nearest branches per chain | Yes, incl. split basket + fuel cost | Clever optimiser, thin catalogue |
| Kabaz (PT) / Soysuper (ES) | Retailer websites | Radius / postcode | Yes + split | Catalogue-only, no shelf prices |
| Basket (US) | Users confirm in-store + retailer data | 5-mile radius | Yes | Stale where few users; stalled |
| Frugl (AU) | Users type prices | Chain | Yes | Failed 2023: "manual entry unappealing" |
| Numbeo | Users + staff, heavy filtering | City | No | Survives by accepting city-level coarseness |

---

## 3. What "better than all of them" means — the checklist

### 3a. Table stakes (the best apps already do these; we must match)
1. Line-item extraction with every field tap-editable, in ~10 s (we're already at 100% on 17 receipts).
2. Guest mode, no sign-up, a handful of free scans before asking for anything (GroceryTracker Pro).
3. Big central **Scan** button in the bottom bar (Fetch).
4. Two-step confirm: (1) store / date / total + item list, (2) categories, then Save.
5. Long-receipt multi-photo capture with a "keep the last line visible" hint; auto-crop; glare/blur check *before* upload.
6. Receipt photo archive + full-text search.
7. Per-item categories and subcategories (done in Phase 0 v2).
8. Your own price history per product per store, "what got pricier since last time" (GroceryTracker Pro).
9. Budgets with "left to spend per day", weekly recap card + weekly push/email (Monarch/Copilot pattern, ~2x retention).
10. Household / family sharing; CSV/PDF export; multi-currency; offline queue with a "waiting for signal" badge, never a spinner.
11. Honest pricing: a real free tier, no "lifetime" bait-and-switch, no selling purchase data.

### 3b. Where IziCost wins (nobody has these)
1. **Community price database from real receipts** — branch-level, timestamped, hard to fake. The Brazilian model without needing the government.
2. **Cross-town / cross-region comparison** (PS request, see §5).
3. **Basket optimiser with split-basket and travel cost** (only Grocify does it, and only for 7 SA chains).
4. **Mozambique-first**: Portuguese receipts, MZN, NUIT, Shoprite/Lokal/Woolworths Mares/Supermercado Real…, M-Pesa/Emola payment labels, informal markets.
5. **Informal-market quick add**: "tomatoes 50 MT, Mercado Xipamanine" by voice or two taps → the only price data that exists for markets with no receipts.
6. **Per-field confidence on the confirm screen**: only the doubtful lines are highlighted, so confirming a clean receipt is one tap. Every competitor claims 95% and hides where it's unsure.
7. **Freshness and sample size on every community price** ("seen 3 days ago, 12 reports") and visible follow-up on "wrong price" reports. Stale prices and ignored reports are the #1 complaint about every comparison app.
8. **Privacy done loudly**: one plain sentence — "We share *the price of milk at Shoprite Matola on Tuesday*, never *that you bought it*" — plus a "what we never share" list and published anonymisation rules. The opposite of Fetch.
9. **Low-data, low-end-Android design**: compress before upload, show data used per scan, work on Tecno/Itel. 69% of online Mozambicans name data cost as their biggest barrier.
10. **WhatsApp as the growth engine**: share a price card or a receipt into IziCost; deep links that install the app and open that product. 81% of online Mozambicans use WhatsApp.
11. **A public "IziCost Price Index" per city**, published monthly → free press, and later a paid data product for banks, NGOs, researchers and retailers. A revenue line no consumer app has.

---

## 4. Proposed app layout (v1)

**Bottom tabs:** Home · Prices · **[ Scan ]** · Receipts · Me

- **Home** — this week's spend vs last week; budget ring with "left per day"; "you saved X MT vs average prices" headline; recurring-item reminders ("milk due tomorrow, cheapest at Lokal"); weekly recap card.
- **Scan** (big central button) — camera with edge outline + auto-capture; hints (flat, no glare, include the total); "add another photo" for long receipts; offline queue. → **Confirm screen**: photo on top, list below; store / date / total in a header; only low-confidence rows tinted; tap a row to edit or see where it was read; one tap **Save**. Second step (optional): category chips per line. Manual "quick add" for market purchases with no receipt.
- **Prices** — search or barcode → **Product page**: cheapest near me · in my city · by city table · by province · anywhere; price-history line with low/typical/high badge; "seen N days ago, K reports"; set alert; report wrong price. **Basket** tab: shopping list → cheapest single store and split-basket with distance/fuel; **Deals** feed (later: retailer promotions live here).
- **Receipts** — searchable archive with photo, filters by store/category/date; monthly totals; export.
- **Me** — budgets, household, contribution impact ("your 12 scans helped 340 people"), privacy toggles (contribution on/off, the honest opt-out), language EN/PT, export & delete my data.

---

## 5. Comparing prices across regions and towns (PS request)

- Every price point carries a location hierarchy: **country → province → city/town → neighbourhood → branch** (from GPS at scan time + the printed branch address + NUIT).
- Product page selector: *Near me (5 km) · My city · Choose a city · By city (table) · By province · Anywhere*. "Choose a city" is the "pin position to another city's centre" trick from Menor Preço — you can browse Beira prices while sitting in Maputo.
- **Basket-by-city**: "Your usual basket costs 4,120 MT in Maputo, 3,560 MT in Beira, 4,900 MT in Tete." Numbeo does this with typed data; we do it with receipts.
- **Regional price map**: heat colours per city for one product or the whole basket.
- **Unit-price normalisation** (per kg / per litre / per unit) so a 2 L and a 1.5 L compare fairly. Essential, and a common complaint elsewhere.
- **Freshness decay**: prices fade out after N days (Bahia uses 3 days by default; we'll start with 14 and show the age), and small towns show "not enough data yet" rather than one shopper's number.
- **Small-town privacy**: a community price only appears once ≥2–3 independent receipts exist or after a delay, so a lone shopper in a small town can't be identified.
- Comparison stays **within one currency**; ZAR receipts join the South-African pool, MZN the Mozambican one. Personal reports convert to the user's home currency at the receipt-date rate.

---

## 6. Trust, community and gamification — what the evidence says

- **Do** reward *confirming someone else's price* and *first price for a product at a branch*, equally for every store; cap per day; device-level fraud checks; show impact ("helped 40 neighbours"). Intrinsic framing outlasts points (Waze, Google Local Guides).
- **Don't** reward raw volume (spam), don't shame broken streaks (Duolingo's data: weekly streaks + grace days retain better), don't run a big monthly lottery (a Brazilian field study found it can *backfire*; small instant rewards did 227% better than monthly draws).
- **Data quality**: median of recent reports with outlier rejection; duplicate-receipt hashing; per-branch anomaly checks; seed the catalogue with scraped shoprite.co.mz prices so search never comes back empty on day one.
- **Product matching** (the hard, valuable bit): barcode/GTIN where printed, else a fingerprint of store + printed description + unit, plus "remember my custom name" (GroceryTracker Pro) as the seed for a canonical catalogue. Keep `name_as_printed` and a cleaned `product_name`.

---

## 7. Additions to the feature list (beyond MASTER_PLAN §6)

Tier 1 (build into Phase 1–3):
- Per-field confidence + "check this line" tint on confirm; guest mode; multi-photo long receipts; offline queue; blur/glare pre-check.
- Location hierarchy on every price; unit-price normalisation; freshness + sample size on every community price; "report wrong price" with visible follow-up.
- Informal-market quick add (voice/2-tap) with community prices for markets.
- Privacy sentence + "what we never share" list at sign-up and in Settings.

Tier 2:
- Cross-city basket comparison, regional price map, price alerts, split-basket optimiser with travel cost.
- Weekly recap push/email; "you saved X vs average prices" headline; recurring-item radar.
- M-Pesa / Emola / bank SMS parsing (on-device, opt-in) for cash-less spend with no receipt.
- Recurring-bill tracker (TV Cabo, EDM, water) with due-date reminders.
- WhatsApp share-in (send a receipt photo to IziCost) and share-out price cards with deferred deep links.
- Contribution impact screen + light badges; PIN-locked profiles for shared phones.

Tier 3:
- Public IziCost Price Index per city (PR + B2B data product).
- Fiscal-receipt QR path if Mozambican receipts ever carry one *(uncertain today)*.
- Retailer promotions, Google Ads free tier, Premium (already planned).

---

## 8. Things to avoid (learned from their 1-star reviews)
- Wrong dates and totals with no way to see why → we show confidence and let people fix in place.
- Stale prices with no timestamp → every price shows its age and report count.
- Ignored "wrong price" reports → visible status on every report.
- Scan caps that feel punitive (Expensify 25/mo) → generous free tier, premium sells convenience not access.
- "Lifetime" plans silently turned into subscriptions (Monefy, Smart Receipts) → never.
- Selling purchase data while claiming anonymity (Fetch) → publish the rules.
- Alerts for stores far away (Flipp) → alerts only for favourites and radius.
- Forced login before value (Menor Preço PR, 1.7★) → guest mode first.
