# Phase 0 - OCR reality check (how to run)

Goal: find out how accurately cloud vision-AI reads real receipts, and what a scan costs, before we build the app.

## What is here
- `receipts/` - the 17 photos (r01..r17).
- `ground_truth.json` - what is *actually* printed on each receipt, hand-checked. The answer key.
- `bench.py` - sends each photo to each Claude model and saves the answers in `results/`.
- `score.py` - marks the answers against the answer key and writes `REPORT.md`.

## One-time setup
Either of these works (the script looks for both):
- **Easiest:** copy your existing key file (e.g. `Advertising_Report\key1.txt`) into this `phase0` folder. Keep the name `key1.txt`.
- Or create a file named `.env` here (copy `.env.example`) containing one line:
  ```
  ANTHROPIC_API_KEY=sk-ant-...your key...
  ```
Never commit or share these files (they are git-ignored).

## Run it
Open a terminal in this folder and run:
```
python bench.py
python score.py
```
The first command takes a few minutes (17 receipts x 3 models) and prints one line per receipt.
Expected cost for a full run is roughly 1 US dollar. The second command prints the summary table
and writes the full `REPORT.md`.

Useful variants:
```
python bench.py --models opus-5            # only one model
python bench.py --receipts r09 r04         # only some receipts
python bench.py --force                    # redo everything (otherwise finished receipts are skipped)
```

## Models compared
| key | model | input $/1M tok | output $/1M tok |
|---|---|---|---|
| haiku-4-5 | claude-haiku-4-5 | 1.00 | 5.00 |
| sonnet-5 | claude-sonnet-5 | 2.00 | 10.00 |
| opus-5 | claude-opus-5 | 5.00 | 25.00 |

A receipt photo is about 1,600 input tokens, so the image itself costs well under a cent on every model.

## Results
Run on 2026-09-02: see `REPORT.md`. Verdict: Claude Sonnet 5 (100% on every readable field, about $0.014 per scan). Details in MASTER_PLAN.md section 12.
