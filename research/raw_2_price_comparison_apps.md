# Raw research 2 — grocery price-comparison apps & crowdsourced price databases (web research, 2026-09-02)

## A. Brazil: government e-receipt price apps (same data model as IziCost, but fed by the tax authority instead of camera scans)

1. Menor Preço – Nota Paraná (Paraná, BR) — iOS/Android/web; free, run by state treasury (SEFAZ-PR).
- Source: every NFC-e (consumer e-invoice) feeds store name, address, item, price in real time. ~10M prices/week from 60k+ stores; 3.8M products. Price shown is the last sold price, with timestamp.
- Location: radius 1–20 km (GPS or fixed on Curitiba), time window 1 h–15 days; distance and route. Shopping list -> store with cheapest total (late-2024 redesign).
- Matching: barcode/GTIN when on the invoice, otherwise free-text description (same SKU appears under several descriptions).
- Trust: no outlier filtering documented; relies on legally authoritative invoices. Complaints: forced login, App Store 1.7★ (429 ratings — uncertain).
- https://www.notaparana.pr.gov.br/Pagina/Aplicativo-Menor-Preco ; https://www.fazenda.pr.gov.br/Noticia/Aplicativo-Menor-Preco-ganha-funcoes-que-facilitam-pesquisa-de-produtos-em-listas-de ; https://www.parana.pr.gov.br/aen/Noticia/Alta-nos-alimentos-Parana-tem-app-que-permite-ao-consumidor-encontrar-o-menor-preco

2. Preço da Hora Bahia (SEFAZ-BA) — iOS/Android/web; free, government.
- Source: NFC-e/NF-e from ~240k establishments; ingested every 5 min, displayed with ~1 h delay; default window 3 days (min 12 h). 500k+ products; also fuel and medicine.
- Location: 10 km default, max 30 km, or pick a municipality; GPS directions; favourite store groups.
- Matching: name, brand or GTIN. Screens: search -> prices per store with time -> store map; shopping list -> cheapest total; price alerts; price history; "report irregularity".
- Trust: FAQ disclaimer "no price guarantee, prices are past sales".
- Outcome: 1.1M downloads, ~110k monthly users, 4.8★ (3.5k). Complaints: GPS permission failures.
- https://precodahora.ba.gov.br/faq ; https://apps.apple.com/br/app/pre%C3%A7o-da-hora-bahia/id1503335648 ; https://www.sefaz.ba.gov.br/destaque/preco-da-hora-bahia-supera-1-milhao-de-downloads-em-2025-e-amplia-aprovacao-dos-usuarios/

3. Menor Preço Nota Gaúcha (Rio Grande do Sul) — free, government. NF-e/NFC-e loaded on issue; 200–300k stores; search by description/brand/barcode; shopping list compares totals within ≤5 km; favourite stores; fuel filter. App Store 2.8★ (278): redesign removed barcode refinement, 1-minute launch, login issues.
- https://apps.apple.com/br/app/menor-pre%C3%A7o-nota-ga%C3%BAcha/id1350542444 ; https://atendimento.receita.rs.gov.br/menor-preco-nota-gaucha-o-que-e

## B. Government-mandated retailer feeds
4. Precios Claros (Argentina) — web; free. Chains legally obliged to upload daily prices; ~12M prices/day, 70k products, 3,600 stores. Location -> compare across 30 nearest branches; build/print a list. Consumers can file complaints and demand the listed price; chains correct until 10 am. Criticisms: stale prices, missing branches.
- https://www.argentina.gob.ar/noticias/esta-disponible-precios-claros-el-sistema-de-informacion-de-precios-online-para-los ; https://www.infobae.com/economia/2024/08/20/el-gobierno-dara-a-conocer-una-base-de-12-millones-de-precios-diarios-que-le-informan-los-supermercados/
5. PriceSenseNG (Nigeria, Bank of Industry) — staple commodity prices in 8 states; charts by location/date; likely field agents (uncertain).
- https://www.legit.ng/business-economy/money/1617464-bank-announces-introduces-app-nigerians-check-food-price-list/

## C. Retailer-scraped / online-catalog comparators
6. Trolley.co.uk (UK) — sponsor-funded, four volunteers; 130k products, 14+ chains from online listings; price history, alerts, barcode, deals. No branch-level pricing. 3M+ users claimed. Trustpilot 1.9★: wrong/outdated prices, no support, no Clubcard prices.
- https://www.trolley.co.uk/about/ ; https://uk.trustpilot.com/review/trolley.co.uk
7. Grocify (South Africa, 2026) — free, solo developer. Scrapes Checkers, PnP, Woolworths, SPAR, Shoprite, Dis-Chem, Clicks (~1,000+ products); 4 nearest branches per chain; basket total per store AND mixed-basket split with fuel-cost estimate.
- https://mybroadband.co.za/news/smartphones/630347-south-african-app-launched-that-shows-if-checkers-pick-n-pay-spar-or-woolworths-is-cheapest.html ; https://grocifyapp.co.za/
8. PriceCheck (South Africa) — since 2006; affiliate; 6.5M products, 1,500 online stores; "Deal Score" vs own price history; barcode; alerts. https://www.pricecheck.co.za/about_us
9. Kabaz by KuantoKusta (Portugal, 2024) — Continente, Minipreço, Auchan, Pingo Doce, 360 Hyper, updated several times daily; radius; cheapest store for list and split-basket optimizer. Also PT: Preço Fresco (barcode -> 3 chains, DECO test ratings beside prices), Super Save, PoupeX.
- https://observador.pt/2024/01/29/kuantokusta-lanca-plataforma-kabaz-para-comparar-precos-nos-supermercados/ ; https://www.deco.proteste.pt/familia-consumo/supermercado/noticias/app-compara-precos-supermercados-inclui-resultados-deco-proteste
10. Soysuper (Spain) — 108k products × 7,200 postcodes = 15M prices daily; basket re-priced across chains; barcode. https://www.alimarket.es/alimentacion/noticia/155801/-soysuper--publica-su-barometro-de-precios-de-supermercados-online
11. Instagrocer (Nairobi, Accra, Abuja, Cape Town) — branch-level partner-retailer prices; history; cheapest multi-store basket; scale unverified. https://www.instagrocer.co/compare/nairobi
12. Flipp (US/CA) — 1,600 retailers upload weekly flyers; only promoted prices. https://corp.flipp.com/faq/
13. ShopSavvy (US) — barcode scanner; multi-retailer price-history chart; deal score. https://shopsavvy.com/app
14. Google Shopping — "Price insights" low/typical/high vs 3-month history; local in-stock. https://blog.google/products/shopping/save-money-price-insights-price-alerts/

## D. Crowdsourced (user-entered) price databases
15. Basket (US, 2014) — ~5-mile radius; total-cart price per store; crowdsourced in-store confirmations + retailer data. Reviews: stale where few contributors; development slowed. https://basketsavings.com/index.html ; https://reluctantfrugalist.com/basket-grocery-price-comparison-app-review/
16. Frugl (Australia, ASX) — manual user price entry; 2023 restructure after "low returns": manual entry "unappealing", downloads fell; revenue A$725k, loss A$880k; pivot to retail analytics. https://thesentiment.com.au/frugl-restructures-business-after-seeing-low-returns-for-its-grocery-price-tracking-app/
17. Grosh (Europe) — shopping-list app with opt-in crowdsourced prices typed per store; last price auto-fills, user verifies. https://groshapp.com/crowdsourced-grocery-prices/
18. Numbeo (worldwide incl. Maputo) — cost of living by city; user + staff data (weighted 3×); 30+ heuristic filters; adaptive archiving 3–24 months by contributor count; paid API. https://www.numbeo.com/common/motivation_and_methodology.jsp
19. Zimpricecheck (Zimbabwe) — table of basic groceries across chains; USD/ZiG conversion; national. https://zimpricecheck.com/price-updates/grocery-prices-from-selected-supermarkets/

Africa gaps: Mozambique — no price-comparison app found (only Shoprite/MozaBuy delivery). Angola — MarcheApp claims "largest price comparison platform" but unreachable. Pricepally (Nigeria) is e-commerce, not comparison. Kenya — SmartCart prototype, Instagrocer.

## Comparison table
| App | Price source | Coverage | Location granularity | Basket optimizer | Price history | Matching | Trust mechanism |
|---|---|---|---|---|---|---|---|
| Menor Preço PR | Gov NFC-e | 60k stores | Branch, 1–20 km, 1h–15d | Yes | List-level | GTIN else text | Legal invoices; timestamp |
| Preço da Hora BA | Gov NFC-e | 240k stores, 500k SKUs | Branch, 10–30 km / municipality | Yes | Yes + alerts | Name/brand/GTIN | Invoices; disclaimer; report tool |
| Nota Gaúcha | Gov NF-e | 200–300k stores | Branch, ≤5 km | Yes | ? | Text/barcode | Invoices |
| Precios Claros | Mandated feed | 3,600 stores | 30 nearest branches | List only | No | Retailer | Complaints, legal duty |
| Trolley UK | Retailer online | 14 chains | Chain | Group by store | Yes | Catalog/barcode | None |
| Grocify ZA | Scraped | 7 chains | 4 nearest branches/chain | Yes + split + fuel | ? | Catalog | None |
| Kabaz PT | Retailer online | 5 chains | Radius | Yes + split | Planned | Catalog | None |
| Soysuper ES | Retailer online | 9 chains, 7,200 postcodes | Postcode | Yes | Barometer | Catalog/barcode | None |
| Basket US | Crowd + retailer | ~50 chains | 5-mile radius | Yes | ? | Barcode | Freshness by contribution |
| Frugl AU | Manual entry | 2 chains | Chain | Yes | ? | Catalog | None -> failed |
| Numbeo | Crowd + staff | Cities worldwide | City | No | Archived series | Fixed list | Filters, weighting, archiving |

## Lessons for a receipt-crowdsourced database
Why the Brazilian apps work: zero user effort (every sale feeds the DB); each price tied to a real, timestamped, branch-level transaction (hard to game); they SHOW timestamp and distance; the shopping-list "cheapest total store" feature drove adoption in all three; explicit disclaimers. Weaknesses = IziCost's opportunity: free-text product matching (duplicates), no outlier removal, poor UX/login friction (1.7–2.8★ for PR/RS vs 4.8★ for BA whose UX is better).
Why crowdsourced ones fail: manual entry is "unappealing" (Frugl, Basket); data density collapses outside dense areas; stale prices -> users churn; even retailer data gets 1★ when wrong and unanswered (Trolley). Numbeo survives by accepting city-level granularity, weighting trusted sources, filtering aggressively, ageing out data.
Implications: scanning must be a by-product of something the user wants anyway (expense tracking); show "seen N days ago at X" with confidence; decay/expire prices; seed with scraped catalog prices (shoprite.co.mz etc.) so search never returns empty; normalise to GTIN where printed, else fingerprint store+description+unit; median-of-recent with outlier rejection; detect fake receipts via duplicate hashes and store-level anomaly checks.

## Best UI patterns for cross-town/region comparison
- Radius slider + time-window slider, with distance, timestamp and route per store (Menor Preço PR / Preço da Hora BA).
- "Fix position on city centre X" to browse another city's prices without being there (Menor Preço PR); municipality picker (Bahia).
- Shopping list -> per-store total ranking + split-basket suggestion with fuel cost of the detour (Grocify; Kabaz).
- Branch-level, not chain-level, prices (Instagrocer, Precios Claros).
- Price-history line with low/typical/high badge and historical-low marker (ShopSavvy, PriceCheck, Google).
- City-vs-city fixed-basket index and multi-currency display (Numbeo; Zimpricecheck).
- Price alerts on favourites and a "report wrong price" button (Bahia, Precios Claros).
