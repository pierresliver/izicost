# Raw research 3 — UX patterns, user complaints, trust, gamification, emerging markets (web research, 2026-09-02)

## 1. Receipt-scan flow
- Auto-capture with visible edge outline (Apple Notes / Google Drive): shutter fires when edges detected and frame stable. https://www.usecarly.com/blog/how-to-scan-documents-with-google-drive/
- Pre-capture guidance for the documented failure cases: Expensify lists blur, low contrast, shadows/glare/folds, cut-off date/total, faded thermal paper; Fetch: lay flat on non-reflective surface, good light, line up edges, capture store/date/total. Add a post-capture blur/glare check that asks for a retake BEFORE upload. https://help.expensify.com/articles/expensify-classic/expenses/Troubleshoot-SmartScan-Issues ; https://help.fetch.com/hc/en-us/articles/115015779467-How-to-Snap-Receipts
- Long receipts: explicit "add another photo" step (Fetch). No consumer app documents automatic stitching (uncertain). Guided multi-shot with overlap hint ("keep the last line visible") is the safe pattern.
- Confirm screen: photo beside the extracted lines; tap a line to see where it came from; colour only low-confidence rows so one-tap confirm stays fast (OCR APIs like Mindee/Veryfi return per-field confidence + coordinates for exactly this). https://www.mindee.com/blog/receipt-data-extraction-ai-guide
- Always allow manual edit of every field (Expensify falls back to manual for handwritten/faded).
- Offline queueing (Expensify): photo saved locally, "scan will begin once you reconnect"; show a queued badge, never a spinner.
- QR-code path where fiscal receipts have one (Brazil NFC-e apps Minha Nota, QR Note, Economiza Club skip OCR entirely). Mozambique fiscal-receipt QR status: uncertain. https://mnapp.com.br/
- Speed: Expensify claims "a few seconds" but threads show scans "stuck in limbo" for hours; show progress and let users leave the screen. https://community.expensify.com/discussion/4715/faq-why-is-smartscan-taking-a-long-time

## 2. Home screen and retention
- Weekly recap card + weekly email/push (Monarch): total spend, drivers, recurring-charge changes, week-over-week. Copilot's weekly emails "actually useful"; automation-first apps see ~2x retention vs hands-on budgeting. https://help.monarch.com/hc/en-us/articles/37526856682260-AI-in-Monarch ; https://genwealth.io/articles/ynab-vs-monarch-vs-copilot-i-tested-all-3-for-90-days-heres
- Animated budget dials/progress bars with clear colour coding + dismissible tooltips (Copilot). https://screensdesign.com/showcase/copilot-track-budget-money
- One headline number people watch move (YNAB "Age of Money"); IziCost analogue: "you saved X MZN vs average prices this month". https://www.ynab.com/blog/what-is-the-ideal-age-of-money
- Streaks: weekly streaks, grace days, "earn back", never shaming (Duolingo weekend amulet: +4% return, -5% streak loss). Frame "47 of the last 50 days" not "streak broken". https://uxmag.com/articles/the-psychology-of-hot-streak-game-design-how-to-keep-players-coming-back-every-day-without-shame

## 3. Price-comparison UI
- Product page = price-per-store list + 12-month history chart + "set price alert" in one place (idealo; Trolley users praise alerts). https://www.idealo.co.uk/info/uk/pricealerts/
- Basket optimiser: total per store AND mix-and-match split (Grocify SA, Menor Preço BR). https://mybroadband.co.za/news/software/625844-new-south-african-app-shows-if-checkers-pick-n-pay-spar-or-woolworths-has-the-cheapest-prices.html
- Radius slider (default 20 km) + "pin location to city centre" for browsing other towns + map + barcode search (Menor Preço). https://www.notaparana.pr.gov.br/Pagina/Aplicativo-Menor-Preco
- Freshness timestamp and sample size on every price (Basket reviewers: "if no one scanned it in two weeks, it could be $3.49 when you get there"; Numbeo attacked for "as little as one random user"). https://grocerychop.com/blog/basket-vs-flipp-vs-grocerychop ; https://www.trustpilot.com/review/numbeo.com
- Separate loyalty/member prices from shelf prices (Trolley's top complaint). https://uk.trustpilot.com/review/trolley.co.uk

## 4. Top recurring complaints (quotes)
- OCR: "only recognizes the correct date, total, merchant about 50 to 60% of the time"; "the date after you scan a receipt is always one day prior". https://apps.apple.com/us/app/receipt-scanner-track-expenses/id1550270774?see-all=reviews
- Date misread as expiry (Receipt Hog read 5/4/2026 as April 5 and rejected). https://thinksaveretire.com/receipt-hog-review-why-it-isnt-worth-it/
- Crashes: "hardly scans one receipt without bugging out and closing the app".
- Stale/wrong prices: "Incorrect price shown. Reported 16 times... No reaction whatsoever" (Trolley).
- Missing stores; alerts for stores "hours of driving" away (Flipp). https://justuseapp.com/en/app/725097967/flipp-weekly-shopping/reviews
- Silent value changes (Fetch points omitted/changed). https://www.trustpilot.com/review/fetchrewards.com
- Subscription fatigue: "The paid unlocked version is way to expensive".
- Privacy: "they're literally sell your information/data" (Fetch). https://www.thebudgetdiet.com/is-fetch-rewards-safe
- Offline mode requested (Trolley).
Recommendation: close the loop on price reports visibly ("3 people confirmed this price, updated 2h ago").

## 5. Trust and privacy messaging
- Data-selling apps' wording: Receipt Hog "We may share information with our clients, including information related to your purchases" + concrete aggregated example ("Families in the Phoenix area are 20% more likely..."). Ibotta: "anonymized, aggregate information based on Receipt Data"; graded "F" by a privacy watchdog because every line is captured. Fetch refused to detail anonymisation and deleted its security post. https://receipthog.com/privacy/ ; https://terms.law/Privacy-Watchdog/cashback-apps/ibotta/ ; https://www.compassitc.com/blog/is-the-fetch-rewards-app-safe-exploring-data-privacy-concerns
- Copyable pattern: (a) one plain example sentence: "We share THE PRICE OF MILK AT SHOPRITE MATOLA ON TUESDAY, never THAT YOU BOUGHT IT"; (b) a "what we never share" list (name, phone, exact basket, location history); (c) opt-out toggle as prominent as opt-in; (d) publish the anonymisation rules.

## 6. Gamification and community contribution
- Works: Waze points/ranks + volunteer editor hierarchy; Google Local Guides (150M) join for fun/community/local pride; Nota Fiscal Paulista raised reported revenue 21%+, instant lotteries produced 227% more receipts than monthly ones. https://eprints.lse.ac.uk/101538/1/Consumers_as_tax_auditors.pdf ; https://onlinelibrary.wiley.com/doi/10.1111/apce.70003
- Backfires: Local Guides "non-answers to accumulate points"; Waze spurious reports; a Fortaleza field experiment found a lottery REDUCED registration by signalling non-enforcement; rewarding some retailers more than others biases panel data. https://publications.iadb.org/en/nudging-taxpayer-registration-field-experimental-evidence-backfiring-incentives ; https://www.circana.com/post/what-to-look-for-in-a-receipt-panel-partner-and-what-to-avoid
- Recommendations: reward confirmations of others' prices and first price for a product/store, not raw volume; equal reward per receipt regardless of store; cap per-day contributions with device-level fraud checks; small instant "chance" reward beats a monthly draw; show impact ("your price helped 40 neighbours").

## 7. Emerging markets / Mozambique
- 19.8% internet penetration (6.96M users, early 2025); among online Mozambicans 93% rely on mobile data, 69% name data cost as biggest barrier, 81% use WhatsApp, 31% cite privacy; 69% are their phone's primary user (device sharing common). https://datareportal.com/reports/digital-2025-mozambique ; https://www.geopoll.com/blog/mozambique-smartphone-social-media-report/
- Do: Google "Build for Billions" — queue outbound requests, cache, respect Data Saver, small APK; upload a compressed photo only after on-device blur check; show data estimate per scan; test on Tecno/Itel/Samsung A-series. https://developer.android.com/docs/quality-guidelines/build-for-billions/data-cost
- Device sharing: PIN-locked profiles per person on one phone (inference).
- WhatsApp as share/growth channel: Menor Preço shares prices by message; use WhatsApp deep links with deferred deep linking so a shared "price card" installs the app and opens that product. https://www.appsflyer.com/blog/deep-linking/whatsapp-deep-link/
- M-Pesa: Vodacom Moçambique developer console exposes C2B/reversal/status APIs; community SDKs exist; M-Pesa Super App hosts mini-apps (third-party access uncertain). e-Mola (Movitel) grew 169% in H1 2024 — do not assume M-Pesa only. https://github.com/thatfiredev/mpesa-node-api
- Could not verify: whether Mozambican fiscal receipts carry a machine-readable QR; Mozambique-specific app-store review data.
