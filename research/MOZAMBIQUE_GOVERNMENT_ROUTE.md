# IziCost — Could the Mozambican state be the data source, or the client? (2026-09-02)

> Written for PS. Sources and detail in `raw_4_mozambique_einvoicing.md`. Anything marked *(uncertain)* could not be verified; the AT website was unreachable during research.

## 1. Short answer
- **Mozambique does not have what Brazil has.** There is no electronic receipt sent to the tax authority at the moment of sale, no QR code on receipts, and no public "check this invoice" service. Shops must use AT-certified invoicing software (that is the "Processado por Programa Licenciado" line on the Lokal receipt), and since May 2025 they upload a file of the month's invoices to the AT at month-end. That is a monthly batch, not a live feed, and the data stays inside the AT.
- **So OCR stays our engine for the foreseeable future.** A QR/e-invoice shortcut is unlikely before 2027–28 and would then take years to reach every till (Angola and Cabo Verde are going through exactly that now). We design the app with a small "future QR" hook and move on.
- **Proposing to government is worth doing, but not as "give us your invoice data."** The AT has no legal basis to share invoice data and the data-protection framework is weak. What the AT *does* want is citizens asking for receipts and more digital compliance. That is the pitch: **IziCost makes people want the receipt.**

## 2. What actually exists in Mozambique (plain language)
| Layer | Status |
|---|---|
| Certified invoicing software (2012 rules) | In force. Software must be approved by the AT; receipts print a certification line. No QR/hash required. |
| Fiscal machines / fiscal printers (Decreto 92/2014) | Law exists; Maputo pilot 2020–21; never rolled out nationally *(uncertain)*. |
| Monthly invoice file to the AT (Aviso 40/AT/DGI/2025) | In force since May 2025 for all VAT taxpayers. Batch, not real time. |
| SAF-T MZ (standard audit file) | Expected 2026, no gazetted date found. |
| 2026 tax package (Lei 10/2025) | "Reinforces mandatory electronic submission of invoices", details still to be regulated. |
| QR on receipts / public invoice check | None. |
| Receipt lottery ("factura premiada") | None in Mozambique. Angola started one in 2025; Tanzania in 2026. |
| Government price data | INE publishes only CPI indices (8 cities, 367 products); SIMA/WFP publish weekly food prices for rural markets. No supermarket-level price data anywhere. |

## 3. Three ways the state could be involved, ranked

**A. Endorsement + "demand your receipt" partner (recommended first step).**
Pitch to the AT: IziCost is a free consumer tool that rewards people for taking the receipt, which is the behaviour every receipt-lottery programme in Africa is trying to buy. We give the AT: anonymised statistics on receipt-taking by district and store type, a channel to run a "Exija a sua factura" campaign or a future lottery inside an app people already open, and a report on shops that issue no receipt (Bahia's app has a "report irregularity" button for this). We ask for: public endorsement, access to the certified-software list and vendor contacts, and a seat at the table if a QR/e-invoice spec is written. **Cost to us: low. Risk: low. We keep our product, our users, our data.**

**B. Paid build for a ministry: a public "Observatório de Preços" dashboard.**
The Ministério da Economia inherited price supervision of the cesta básica when the trade ministry was abolished in January 2025, and has no tool. A dashboard fed by IziCost's anonymised community prices (plus SIMA/WFP market data) is a natural product: prices by city, week by week. Funding door: the World Bank EDGE project's **GovTech Business Ecosystems component (US$30m for local tech firms, closes February 2027)**, run through the digital-transformation ministry (MCTD/INAGE). Precedent: MOPA, the Maputo waste-reporting app built by a local startup and adopted by the city. **Worth pursuing in parallel, but only once the app is live and has data. Government sales cycles are slow and the money would arrive after the product exists anyway.**

**C. "Build the national e-invoice system for the AT."**
Not realistic for us. That is a multi-year, multi-million-dollar core tax system procured from large vendors with donor advisers embedded at the AT (TEDI, ATAF, World Bank PFM). Proposing it would make IziCost look like a systems integrator rather than a consumer app, and would tie our roadmap to a government timetable. **Skip.**

## 4. A better shortcut than the government: the certified-software vendors
Every supermarket receipt we scanned was printed by AT-certified software (Cegid Vendus, Primavera, Tlantic on the Lokal receipt, PHC on Supermercado Real, wintouch at Piripiri). Those vendors already hold every line item in structured form. A retailer who opts in could send us the receipt data by API, or print an IziCost QR on the receipt, skipping OCR for that chain. This is a commercial conversation, not a political one, and it is how we would get "official" data years before the state does. Park it for Phase 5 (retailer promotions), where the same retailers are already talking to us.

## 5. Who to talk to (in order)
1. **AT — Direcção Geral de Impostos / Projecto Máquinas Fiscais (DGI-PMF)**, and the AT's innovation forum (Conselho da Fiscalidade, 2025 theme "Inovar para arrecadar"). Entry: Linha do Contribuinte 1266 / linhadocontribuinte@at.gov.mz, better via an introduction.
2. **MCTD / INAGE** for the EDGE GovTech component (time-limited, Feb 2027).
3. **Ministério da Economia — Direcção Nacional do Comércio e Prestação de Serviços** (price monitoring mandate).
4. **INE Price Department** (methodology, validation) and **WFP / SIMA** (market prices interoperability).
5. Introducers: donor tax advisers at the AT (TEDI successor, ATAF, World Bank PFM), **ProConsumers** and **Observatório do Meio Rural** as civil-society validators; **Orange Corners / Standard Bank Incubator / ideiaLab** for credibility.

## 6. What we need before knocking on any door
- A working app with real users and a few thousand price points, so the pitch is a demo, not a slide.
- The privacy design written down (what is shared, what is never shared, k-anonymity rule).
- One page in Portuguese: problem, what IziCost does, what we give the AT, what we ask for.
- A public monthly "IziCost Price Index" for Maputo, so the press has already covered us.

## 7. Decision for the plan
- OCR/vision remains the primary channel for the entire roadmap; add a parser hook for a future AT QR code.
- Government route = **A now (after launch), B in parallel once data exists, C never.**
- Add certified-software vendors to Phase 5 as an "official data" channel.
