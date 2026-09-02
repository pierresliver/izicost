# IziCost Phase 0 - OCR benchmark report

Receipts graded: 17. Ground truth: `ground_truth.json`. Raw model output: `results/<model>/`.

## Summary (higher is better, except cost and latency)

| model | n | perfect_receipts | store_name | date | total | store_tax_id | item_recall | item_price | item_qty | extra_items | errors | avg_latency_s | cost_per_scan_usd | total_cost_usd |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| haiku-4-5 | 17 | 5 | 94.1% | 76.5% | 82.4% | 72.7% | 96.0% | 96.0% | 93.3% | 3 | 0 | 5.6 | $0.0047 | $0.0804 |
| opus-5 | 17 | 14 | 100.0% | 100.0% | 94.1% | 100.0% | 97.3% | 97.3% | 96.0% | 0 | 0 | 9.6 | $0.0318 | $0.5413 |
| sonnet-5 | 17 | 14 | 100.0% | 100.0% | 100.0% | 100.0% | 97.3% | 97.3% | 96.0% | 0 | 0 | 10.1 | $0.0143 | $0.2424 |
| sonnet-5-low-v2 | 17 | 16 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 98.7% | 0 | 0 | 5.9 | $0.0132 | $0.2242 |
| sonnet-5-medium-v2 | 17 | 15 | 100.0% | 100.0% | 94.1% | 100.0% | 100.0% | 100.0% | 100.0% | 0 | 0 | 7.3 | $0.0146 | $0.2475 |
| sonnet-5-v2 | 17 | 17 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 0 | 0 | 10.0 | $0.0172 | $0.2928 |

- **perfect_receipts**: every header field right AND every item found with the right price, no extras.
- **item_recall**: % of true item lines the model found. **item_price**: % with the right line total. **extra_items**: invented/duplicated lines (bad).
- **store_tax_id** = NUIT / VAT number. **total** counts a correct `null` on the blank parking ticket (r15) as right.

## haiku-4-5 - per receipt

| receipt | type | store | date | total | tax id | items found | price ok | extras | secs | $ | problems |
|---|---|---|---|---|---|---|---|---|---|---|---|
| r01 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 11.18 | 0.0042 |  |
| r02 | card_slip | ✓ | ✗ | ✓ | - | 0/0 | 0/0 | 0 | 3.57 | 0.0037 |  |
| r03 | itemized_receipt | ✓ | ✓ | ✗ | ✓ | 6/6 | 6/6 | 0 | 5.35 | 0.0049 |  |
| r04 | itemized_receipt | ✓ | ✓ | ✗ | ✓ | 6/6 | 6/6 | 0 | 5.93 | 0.0053 |  |
| r05 | itemized_receipt | ✓ | ✓ | ✓ | ✗ | 1/1 | 1/1 | 0 | 5.73 | 0.0041 |  |
| r06 | bar_tab | ✓ | ✓ | ✓ | - | 18/18 | 18/18 | 0 | 9.22 | 0.0078 |  |
| r07 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 3.55 | 0.0040 |  |
| r08 | itemized_receipt | ✓ | ✗ | ✓ | ✓ | 3/3 | 3/3 | 0 | 6.98 | 0.0043 |  |
| r09 | itemized_receipt | ✓ | ✗ | ✓ | ✓ | 17/17 | 17/17 | 0 | 8.48 | 0.0078 | qty '4 CHICKEN THIGH': gt 0.592 vs 1; qty 'FR Bulk Lamb ch': gt 0.954 vs 1 |
| r10 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 2/2 | 2/2 | 0 | 4.09 | 0.0044 |  |
| r11 | itemized_receipt | ✓ | ✓ | ✓ | - | 1/1 | 1/1 | 0 | 3.77 | 0.0041 |  |
| r12 | handwritten | ✗ | ✗ | ✗ | ✗ | 0/1 | 0/1 | 2 | 3.35 | 0.0040 | missing item 'Estacionamento'; extra item 'Armada'; extra item 'Valor' |
| r13 | bar_tab | ✓ | ✓ | ✓ | - | 1/1 | 1/1 | 0 | 3.66 | 0.0039 |  |
| r14 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 6/6 | 6/6 | 0 | 5.0 | 0.0053 |  |
| r15 | handwritten | ✓ | ✓ | ✓ | ✗ | 0/1 | 0/1 | 0 | 2.94 | 0.0036 | missing item 'Estacionamento' |
| r16 | invoice | ✓ | ✓ | ✓ | - | 0/1 | 0/1 | 1 | 7.45 | 0.0039 | missing item 'TV Cabo subscription 2026-08-27 a 2026-09-25'; extra item 'Item 1' |
| r17 | bar_tab | ✓ | ✓ | ✓ | - | 9/9 | 9/9 | 0 | 5.12 | 0.0052 |  |

## opus-5 - per receipt

| receipt | type | store | date | total | tax id | items found | price ok | extras | secs | $ | problems |
|---|---|---|---|---|---|---|---|---|---|---|---|
| r01 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 6.25 | 0.0235 |  |
| r02 | card_slip | ✓ | ✓ | ✓ | - | 0/0 | 0/0 | 0 | 6.56 | 0.0250 |  |
| r03 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 6/6 | 6/6 | 0 | 10.57 | 0.0298 |  |
| r04 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 6/6 | 6/6 | 0 | 8.83 | 0.0334 |  |
| r05 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 4.86 | 0.0228 |  |
| r06 | bar_tab | ✓ | ✓ | ✓ | - | 18/18 | 18/18 | 0 | 26.68 | 0.0542 | qty 'Gin Tanqueray': gt 1 vs None |
| r07 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 4.45 | 0.0228 |  |
| r08 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 3/3 | 3/3 | 0 | 9.12 | 0.0316 |  |
| r09 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 17/17 | 17/17 | 0 | 17.16 | 0.0588 |  |
| r10 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 2/2 | 2/2 | 0 | 9.07 | 0.0309 |  |
| r11 | itemized_receipt | ✓ | ✓ | ✓ | - | 1/1 | 1/1 | 0 | 5.73 | 0.0226 |  |
| r12 | handwritten | ✓ | ✓ | ✗ | ✓ | 0/1 | 0/1 | 0 | 9.91 | 0.0299 | missing item 'Estacionamento' |
| r13 | bar_tab | ✓ | ✓ | ✓ | - | 1/1 | 1/1 | 0 | 9.56 | 0.0313 |  |
| r14 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 6/6 | 6/6 | 0 | 10.19 | 0.0358 |  |
| r15 | handwritten | ✓ | ✓ | ✓ | ✓ | 0/1 | 0/1 | 0 | 4.52 | 0.0214 | missing item 'Estacionamento' |
| r16 | invoice | ✓ | ✓ | ✓ | - | 1/1 | 1/1 | 0 | 7.66 | 0.0244 |  |
| r17 | bar_tab | ✓ | ✓ | ✓ | - | 9/9 | 9/9 | 0 | 12.44 | 0.0429 |  |

## sonnet-5 - per receipt

| receipt | type | store | date | total | tax id | items found | price ok | extras | secs | $ | problems |
|---|---|---|---|---|---|---|---|---|---|---|---|
| r01 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 10.67 | 0.0108 |  |
| r02 | card_slip | ✓ | ✓ | ✓ | - | 0/0 | 0/0 | 0 | 8.43 | 0.0085 |  |
| r03 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 6/6 | 6/6 | 0 | 8.23 | 0.0135 |  |
| r04 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 6/6 | 6/6 | 0 | 11.51 | 0.0180 |  |
| r05 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 4.16 | 0.0090 |  |
| r06 | bar_tab | ✓ | ✓ | ✓ | - | 18/18 | 18/18 | 0 | 32.22 | 0.0283 | qty 'Gin Tanqueray': gt 1 vs None |
| r07 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 4.31 | 0.0090 |  |
| r08 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 3/3 | 3/3 | 0 | 10.03 | 0.0151 |  |
| r09 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 17/17 | 17/17 | 0 | 20.36 | 0.0302 |  |
| r10 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 2/2 | 2/2 | 0 | 4.71 | 0.0098 |  |
| r11 | itemized_receipt | ✓ | ✓ | ✓ | - | 1/1 | 1/1 | 0 | 3.99 | 0.0089 |  |
| r12 | handwritten | ✓ | ✓ | ✓ | ✓ | 0/1 | 0/1 | 0 | 17.94 | 0.0207 | missing item 'Estacionamento' |
| r13 | bar_tab | ✓ | ✓ | ✓ | - | 1/1 | 1/1 | 0 | 6.04 | 0.0106 |  |
| r14 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 6/6 | 6/6 | 0 | 7.97 | 0.0134 |  |
| r15 | handwritten | ✓ | ✓ | ✓ | ✓ | 0/1 | 0/1 | 0 | 4.39 | 0.0086 | missing item 'Estacionamento' |
| r16 | invoice | ✓ | ✓ | ✓ | - | 1/1 | 1/1 | 0 | 4.82 | 0.0096 |  |
| r17 | bar_tab | ✓ | ✓ | ✓ | - | 9/9 | 9/9 | 0 | 11.67 | 0.0184 |  |

## sonnet-5-low-v2 - per receipt

| receipt | type | store | date | total | tax id | items found | price ok | extras | secs | $ | problems |
|---|---|---|---|---|---|---|---|---|---|---|---|
| r01 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 5.02 | 0.0113 |  |
| r02 | card_slip | ✓ | ✓ | ✓ | - | 0/0 | 0/0 | 0 | 4.05 | 0.0105 |  |
| r03 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 6/6 | 6/6 | 0 | 6.83 | 0.0144 |  |
| r04 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 6/6 | 6/6 | 0 | 7.14 | 0.0146 |  |
| r05 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 4.84 | 0.0111 |  |
| r06 | bar_tab | ✓ | ✓ | ✓ | - | 18/18 | 18/18 | 0 | 10.73 | 0.0213 | qty 'Gin Tanqueray': gt 1 vs None |
| r07 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 4.38 | 0.0112 |  |
| r08 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 3/3 | 3/3 | 0 | 5.23 | 0.0127 |  |
| r09 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 17/17 | 17/17 | 0 | 10.51 | 0.0205 |  |
| r10 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 2/2 | 2/2 | 0 | 4.85 | 0.0118 |  |
| r11 | itemized_receipt | ✓ | ✓ | ✓ | - | 1/1 | 1/1 | 0 | 4.85 | 0.0110 |  |
| r12 | handwritten | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 4.47 | 0.0110 |  |
| r13 | bar_tab | ✓ | ✓ | ✓ | - | 1/1 | 1/1 | 0 | 4.65 | 0.0112 |  |
| r14 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 6/6 | 6/6 | 0 | 6.23 | 0.0140 |  |
| r15 | handwritten | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 4.13 | 0.0108 |  |
| r16 | invoice | ✓ | ✓ | ✓ | - | 1/1 | 1/1 | 0 | 4.69 | 0.0116 |  |
| r17 | bar_tab | ✓ | ✓ | ✓ | - | 9/9 | 9/9 | 0 | 6.96 | 0.0153 |  |

## sonnet-5-medium-v2 - per receipt

| receipt | type | store | date | total | tax id | items found | price ok | extras | secs | $ | problems |
|---|---|---|---|---|---|---|---|---|---|---|---|
| r01 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 4.96 | 0.0113 |  |
| r02 | card_slip | ✓ | ✓ | ✓ | - | 0/0 | 0/0 | 0 | 4.08 | 0.0105 |  |
| r03 | itemized_receipt | ✓ | ✓ | ✗ | ✓ | 6/6 | 6/6 | 0 | 7.13 | 0.0147 |  |
| r04 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 6/6 | 6/6 | 0 | 10.25 | 0.0185 |  |
| r05 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 4.44 | 0.0111 |  |
| r06 | bar_tab | ✓ | ✓ | ✓ | - | 18/18 | 18/18 | 0 | 18.28 | 0.0272 |  |
| r07 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 4.04 | 0.0111 |  |
| r08 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 3/3 | 3/3 | 0 | 7.21 | 0.0138 |  |
| r09 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 17/17 | 17/17 | 0 | 18.41 | 0.0292 |  |
| r10 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 2/2 | 2/2 | 0 | 5.42 | 0.0118 |  |
| r11 | itemized_receipt | ✓ | ✓ | ✓ | - | 1/1 | 1/1 | 0 | 4.91 | 0.0110 |  |
| r12 | handwritten | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 4.78 | 0.0111 |  |
| r13 | bar_tab | ✓ | ✓ | ✓ | - | 1/1 | 1/1 | 0 | 4.53 | 0.0112 |  |
| r14 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 6/6 | 6/6 | 0 | 6.42 | 0.0142 |  |
| r15 | handwritten | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 4.54 | 0.0108 |  |
| r16 | invoice | ✓ | ✓ | ✓ | - | 1/1 | 1/1 | 0 | 5.21 | 0.0117 |  |
| r17 | bar_tab | ✓ | ✓ | ✓ | - | 9/9 | 9/9 | 0 | 9.24 | 0.0182 |  |

## sonnet-5-v2 - per receipt

| receipt | type | store | date | total | tax id | items found | price ok | extras | secs | $ | problems |
|---|---|---|---|---|---|---|---|---|---|---|---|
| r01 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 9.67 | 0.0132 |  |
| r02 | card_slip | ✓ | ✓ | ✓ | - | 0/0 | 0/0 | 0 | 3.89 | 0.0105 |  |
| r03 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 6/6 | 6/6 | 0 | 13.94 | 0.0216 |  |
| r04 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 6/6 | 6/6 | 0 | 13.46 | 0.0219 |  |
| r05 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 4.3 | 0.0111 |  |
| r06 | bar_tab | ✓ | ✓ | ✓ | - | 18/18 | 18/18 | 0 | 23.44 | 0.0351 |  |
| r07 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 5.11 | 0.0111 |  |
| r08 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 3/3 | 3/3 | 0 | 9.83 | 0.0162 |  |
| r09 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 17/17 | 17/17 | 0 | 23.71 | 0.0359 |  |
| r10 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 2/2 | 2/2 | 0 | 7.17 | 0.0133 |  |
| r11 | itemized_receipt | ✓ | ✓ | ✓ | - | 1/1 | 1/1 | 0 | 4.83 | 0.0110 |  |
| r12 | handwritten | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 4.76 | 0.0110 |  |
| r13 | bar_tab | ✓ | ✓ | ✓ | - | 1/1 | 1/1 | 0 | 7.44 | 0.0138 |  |
| r14 | itemized_receipt | ✓ | ✓ | ✓ | ✓ | 6/6 | 6/6 | 0 | 7.47 | 0.0154 |  |
| r15 | handwritten | ✓ | ✓ | ✓ | ✓ | 1/1 | 1/1 | 0 | 4.87 | 0.0109 |  |
| r16 | invoice | ✓ | ✓ | ✓ | - | 1/1 | 1/1 | 0 | 15.08 | 0.0205 |  |
| r17 | bar_tab | ✓ | ✓ | ✓ | - | 9/9 | 9/9 | 0 | 11.25 | 0.0203 |  |
