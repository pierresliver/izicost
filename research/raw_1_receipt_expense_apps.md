# Raw research 1 — consumer receipt-scanning / expense-tracking apps (web research, 2026-09-02)

## A. Apps that extract LINE ITEMS from grocery receipts (the top 3, plus runners-up)

### 1. Yomio (Artsiom Hontar) — best-rated item-level scanner
- iOS, Android, web; "50+ countries", 10+ UI languages incl. Portuguese. Free tier (scanning + history + analytics); Premium $5.99/mo or $49.99/yr (AI chat "Yopilot", CSV/PDF export, 6-member family sharing, budget alerts); $1.99 for 30 extra scans.
- Capture: photo + e-receipt import; no bank sync by design. Full line items; self-reported 92% line-item accuracy on supermarket receipts, ~95% overall.
- Data use: per-item categories, merchant/product-level history, recurring detection, weekly reports, calendar view, family cost-splitting, CSV export.
- Screens: web dashboard + mobile; scan -> extracted items shown for correction -> save (details of tabs not published).
- Praise: item-level visibility, privacy (no bank creds), languages. Complaints: date misread (Play review), OCR on damaged receipts, no bank integration.
- Ratings: US App Store 5.0 (only 3 ratings) https://apps.apple.com/us/app/yomio-budget-expense-tracker/id6757447181 ; site claims 4.8 avg / Play "4.8 with 85K reviews" — uncertain, could not verify. Sources: https://yomio.app/en , https://yomio.app/en/blog/best-receipt-scanning-apps

### 2. GroceryTracker Pro / "Grocery Tracker: Receipt Scan" (Nemanja Pecanin)
- iOS + Android. EN/DE/ES/FR/JA. Free: 15 scans/mo, guest mode, no signup; Premium $2.99/mo or $19.99/yr (unlimited scans, price history, PDF/CSV export). App Store IAP also lists $4.99/mo Pro.
- Capture: camera or PDF; extracts per line: name, qty, unit price, line total, tax flag + subtotal/tax/total/store/date in ~10 s; ~95% claimed. Crop-and-stitch for long receipts; auto image enhancement. Users can save custom names per product that are re-recognised next time.
- Data use: 70+ item categories + subcategories (milk vs cheese), per-item price history per store ("shrinkflation" alerts, "personal grocery inflation"), monthly budget with "left to spend per day", household sharing in real time, AI Q&A over your receipts.
- Screens: personalised Home (goal, category breakdown, daily budget left), Stats tab (insights feed, category/store breakdowns, trends), receipt list, scan -> every field editable by single tap -> save.
- Praise (few reviews yet): speed, no signup, price history. Complaints: too new to have a review corpus; App Store 4.2 (5 ratings) https://apps.apple.com/us/app/grocery-tracker-receipt-scan/id6753721422 ; site claims 5.0 on Play. Source: https://grocery-tracker-pro.com/ , https://grocery-tracker-pro.com/receipt-scanner-app/

### 3. Groceries Tracker (groceriestracker.com)
- Web + iOS + Android; US/Canada focus; multi-currency. 30-day free trial then ~$5/mo; explicitly "we never sell your data, no ads."
- Capture: photo at checkout or PDF e-receipt; 90–95% on clean receipts; edit names/prices/categories/delete before saving.
- Data use: item-level history, cross-store price comparison from your own receipts (personal history, not community), discount totals, monthly pattern comparisons, shared household groups, savings goals vs "comparable households". 1,700+ users / 70K items.
- Screens: capture -> review/edit list -> history; price comparison section; web dashboard.
- Praise: "the only app that compares what you actually paid"; fast bug fixes. Complaints: paywall after trial; post-purchase only. Ratings not published. Sources: https://groceriestracker.com/features/receipt-scanning , https://groceriestracker.com/blog/best-grocery-price-comparison-apps-2026

### Runners-up
- GroceryTrack (grocerytrack.food): iOS (offline mode, widget), Android beta, web. Free 10 scans/mo; Pro $3.99/mo. Email-forward for Instacart/Walmart/Amazon; two-step review (store/total/items, then categories); per-store price history, perishable freshness countdown, "Grocery Year" heatmap, CSV, household invites, MCP/Claude integration. https://grocerytrack.food/
- BudJet (PWA, offline, 9 currencies, Gemini-based line items + nutrition, household sharing) https://www.budjet.app/blog/best-receipt-scanner-apps ; Receiptix (per-line categories, splits a Walmart receipt into groceries/household/electronics, WhatsApp/Telegram/voice entry) https://receiptix.io/features/smart-categorization ; Skwad (line items, ~$49–65/yr) https://grocerytrack.food/blog/best-grocery-tracking-apps-2026

## B. Cashback receipt apps (line items read, but shown to the user only partially)

### Fetch (Fetch Rewards) — US only
- Free; monetised by selling brand purchase data + brand-funded points. iOS/Android, EN/ES.
- Capture: camera, eReceipts via Gmail/Amazon link, 14-day window. Line items are parsed (points depend on brands bought) and you can open a receipt, tap the pencil and add/correct items via barcode scan or product search.
- Data: points only; "shopping stats" and receipt history; no budgets/categories/export.
- Tabs: Discover (offers), Play (games), central orange Snap button (camera / blue eReceipt), Social, Rewards/My Account.
- Praise: dead-simple, any store accepted, $3 cashout. Complaints: glitchy eReceipts, low points on non-partner items, privacy of purchase data, points expire after 90 days inactivity.
- App Store 4.9 (7.6M ratings) https://apps.apple.com/us/app/fetch-americas-rewards-app/id1182474649 ; https://dollarsprout.com/fetch-rewards-review/ ; correction flow https://help.fetch.com/hc/en-us/articles/360036972413-How-to-Correct-Receipts-and-Get-Missing-Points

### Receipt Hog — US + Canada only
- Free; coins for receipts (5–20 per receipt; 1,000 coins = $5), surveys, slots, sweepstakes; Amazon/email connect. Processing up to 7 days; users never see extracted items.
- Layout: Receipts (camera), Surveys, profile menu.
- Praise: easy, gamified, many payout options. Complaints: tiny earnings, rejections, no support, 14-day limit.
- App Store 4.7 (~240K) / Play 4.6 (~300K) per https://www.sidehustlenation.com/receipt-hog-review/ ; countries https://receipthog.zendesk.com/hc/en-us/articles/227155008-Where-can-Receipt-Hog-be-used

## C. Budget/expense apps with receipt scanning (totals, not items)

| App | Platforms / markets | Price | Capture | Line items? | Data use | Ratings + main praise / complaints |
|---|---|---|---|---|---|---|
| Spendee (CZ) | iOS/Android/web, global, 27 languages | Free (1 wallet, 1 budget); Plus ~$1.99–2.49/mo; Premium $2.99–5.99/mo, lifetime $59.99+ | Bank sync, manual, AI Receipt Scanner (Plus+) pre-fills price/category/description/photo | Total only | Budgets + alerts, shared wallets, labels, multi-currency, web | App Store 4.6 (6.2K). Praise: visuals, no ads, single-screen add flow (v6). Complaints: crashes, slowness, chart bugs. https://www.frugalforless.com/spendee-review/ |
| Wallet by BudgetBakers (CZ) | iOS/Android/web, 50 languages, 15K banks | Free (3 accounts); Premium ~£5.49/mo, £17.99–19.99/yr, £48.99 lifetime | Bank sync, manual, receipt photo + OCR (OpenAI-based per privacy policy) | Total/date (line items claimed by a competitor blog — unverified) | Budgets, goals, planned payments, group sharing, reports | App Store 4.6 (5K) / Play 4.5 (340K). Complaints: bank sync failures, support, data corruption on web. https://www.finder.com/uk/budgeting/wallet-budgetbakers-review |
| Expensify (US) | iOS/Android/web, global | Free 25 SmartScans/mo, $0.20 overage; $5–9/user | Photo, email, card import | Merchant/date/amount/currency; partial items at best | Reports, approvals, accounting sync | Tabs: Home, Inbox, Spend, Workspaces, Account. Complaints: 25-scan cap, false "success", learning curve. |
| Smart Receipts (Reactive Apps) | iOS/Android, 25 languages | Plus $29.99, PRO $12.99/mo / $99.99/yr, 50 OCR scans $6.99 | Photo OCR, email forward, CSV/PDF import | Inconsistent (75–85% per BudJet test) | Custom PDF/CSV/ZIP reports, mileage, tax | App Store 4.8 (13K). Complaints: free tier removed, PDF broke, data loss. |
| Foreceipt (CA) | iOS/Android/web; EN/AR/FR/PT/ZH/VI | Free 100 receipts; $5–6.99/mo, $59.99/yr | Photo, email import, bank CSV | Vendor/date/total; items partial | Categories, tax/expense reports, accountant share, recurring receipts | App Store 4.7 (6.7K). Complaints: date misreads, can't scan PDF attachments, slow support. |
| Wave Receipts (CA) | iOS/Android/web, US/CA | $8/mo add-on or Pro $19/mo | Photo, email, bulk 10 | Totals -> bookkeeping txn | Accounting categories | Business-only. https://www.waveapps.com/receipts |

## D. Manual-entry trackers (no OCR) — benchmark for UX only
- Monefy: donut-chart home, one-tap add; Premium became a subscription (~€34.99–69.99/yr) — App Store 4.7 (90K) but 3.5 on written reviews; complaints: "lifetime" purchases lost, sync, support.
- Money Manager (Realbyte): 50M installs, 4.8 (19K) App Store, $2.49/mo or ~$10 one-time; offline, double-entry, calendar view; complaint: "daily logging tax", no intelligence.
- Cashew: open-source, 46 languages, 4.9 (498), Pro $1.49/mo / $19.99 lifetime; CSV in/out, subcategories, no receipts.
- Buxfer: $3.99/mo, bank sync, no OCR; sync failures, confusing budgets.
- Fina: web-first spreadsheet-style PFM; no receipt OCR, no native app yet.

## 1. Feature matrix

| Feature | Yomio | GroceryTracker Pro | Groceries Tracker | GroceryTrack | Fetch | Receipt Hog | Spendee | Wallet | Expensify | Smart Receipts | Foreceipt | Monefy / Cashew / MoneyMgr |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Line-item OCR | Y | Y | Y | Y | Y (internal) | internal | N | ? | partial | partial | partial | N |
| Per-item categories | Y | Y | Y | Y | N | N | N | N | N | N | N | N |
| Receipt image archive | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | N |
| Budgets | Premium | Y | goals | Y | N | N | Y | Y | N | N | limited | Y |
| Recurring-item detection | Y | ? | N | N | N | N | scheduled txns | planned pmts | N | N | recurring receipts | recurring txns |
| Per-item price history | ? | Y (per store) | Y | Y | N | N | N | N | N | N | N | N |
| Community / crowd prices | N | N | N (personal only) | N | N | N | N | N | N | N | N | N |
| Family sharing | Premium (6) | Y | Y | Y | N | N | Plus | Premium | teams | N | accountant | N |
| Export | CSV/PDF prem. | CSV/PDF prem. | ? | CSV | N | N | Premium | Premium | Y | PDF/CSV/ZIP | Y | CSV |
| Offline | claimed | ? | N | iOS yes | N | N | partial | partial | N | Y | N | Y |
| Languages | 10+ | 5 | EN | EN | EN/ES | EN | 27 | 50 | many | 25 | 7 incl. PT | 19–46 |

## 2. Features nobody does well (gaps IziCost can own)
1. Community price database: none of the 20+ apps pools anonymised item prices across users; Groceries Tracker's comparison is strictly your own history and Flipp/Basket use store feeds and are US/CA only. "Where is this product cheapest near me, from real receipts" is unowned worldwide.
2. Emerging markets / Portuguese / Africa: every line-item app targets US/CA/EU stores; no coverage of Mozambican chains, MZN, thermal receipts with Portuguese abbreviations, or informal-market cash spend. Only Foreceipt and Yomio even have PT UI.
3. Offline-first scanning + low-data sync (cheap phones, expensive data): only Money Manager/Cashew are offline, and they don't scan.
4. Product normalisation across stores ("LEITE UHT 1L" = "Leite Mimosa 1L"): GroceryTracker Pro's "remember my custom name" is the closest; nobody does cross-store canonical products.
5. Honest, non-data-selling monetisation with a real free tier: Fetch/Receipt Hog sell purchase data; Smart Receipts/Monefy angered users by killing free/lifetime tiers.
6. Trust in OCR accuracy: every app self-reports 92–99% but users complain about dates/totals; nobody shows a per-field confidence or flags "check this line".

## 3. UI patterns worth copying
- Central big Snap button in the bottom bar with camera vs e-receipt choice (Fetch); tabs: Home / Receipts / Stats / Budget / Profile.
- Guest mode, no signup, 15 free scans (GroceryTracker Pro) — lowest onboarding friction found.
- Two-step review: (1) store/date/total + item list, every field tap-editable, (2) category breakdown, then save (GroceryTrack, Groceries Tracker).
- Crop-and-stitch for long receipts + auto-enhance faded paper (GroceryTracker Pro).
- Receipt correction flow: open past receipt -> pencil -> tap item -> barcode scan / product search -> "Update details" (Fetch).
- Custom product names remembered for future scans (GroceryTracker Pro) — seed for canonical product mapping.
- Home answers "what's left per day" plus "your personal inflation: what got cheaper/pricier since last time" (GroceryTracker Pro).
- Category-first, one-tap add + donut chart home for manual cash entries at markets (Monefy); calendar view of spend (Money Manager, Yomio).
- Discount total and "you saved X this month" card (Groceries Tracker); Grocery Year heatmap (GroceryTrack).
- AI chat over your own receipts ("why was last month higher?") — Yomio Yopilot, GroceryTracker Pro; premium hook.
- Single-screen add-transaction flow and one-tap category change (Spendee 6) for fast confirms.

Additional sources: https://www.bill.com/blog/best-receipt-scanning-app , https://foreceipt.com/blogs/best-receipt-scanner-apps-for-2026-compare-pricing-ocr-accuracy-and-irs-cra-recordkeeping/ , https://getfinny.app/blog/app-that-scans-receipts-for-budget , https://walletgrower.com/blog/best-receipt-scanning-apps-earn-money-from-groceries , https://github.com/jameskokoska/Cashew
