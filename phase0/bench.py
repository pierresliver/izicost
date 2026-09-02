"""
IziCost Phase 0 - receipt extraction benchmark.

Sends every photo in phase0/receipts/ to one or more Claude vision models, asks for a
structured JSON extraction, and saves the raw answer + token usage + latency + cost to
phase0/results/<model>/<receipt>.json.  Re-running skips receipts already done
(use --force to redo).

Usage (from the phase0 folder):
    python bench.py                       # all models, all receipts
    python bench.py --models opus-5       # one model
    python bench.py --receipts r09 r04    # a few receipts
    python bench.py --force               # redo everything

Then:  python score.py
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
RECEIPTS_DIR = HERE / "receipts"
RESULTS_DIR = HERE / "results"
ENV_FILE = HERE / ".env"

# ---------------------------------------------------------------------------
# Models under test.  Prices are USD per 1M tokens (Anthropic first-party API).
# ---------------------------------------------------------------------------
MODELS = {
    "haiku-4-5": {"id": "claude-haiku-4-5", "in": 1.00, "out": 5.00},
    "sonnet-5":  {"id": "claude-sonnet-5",  "in": 2.00, "out": 10.00},
    "opus-5":    {"id": "claude-opus-5",    "in": 5.00, "out": 25.00},
    # same model, less thinking -> fewer output tokens -> cheaper. Does accuracy hold?
    "sonnet-5-low":    {"id": "claude-sonnet-5", "in": 2.00, "out": 10.00, "effort": "low"},
    "sonnet-5-medium": {"id": "claude-sonnet-5", "in": 2.00, "out": 10.00, "effort": "medium"},
}

STORE_TYPES = ["supermarket", "convenience_store", "restaurant", "bar_cafe", "fuel_station", "pharmacy",
               "parking", "utility_provider", "clothing_store", "market_informal", "other"]

# category -> allowed subcategories (item level)
CATEGORIES = {
    "food": ["vegetables", "fruit", "red_meat", "poultry", "fish_seafood", "dairy_eggs", "bakery_bread",
             "pantry", "breakfast_cereal", "snacks_sweets", "frozen", "baby_food", "other_food"],
    "drink": ["water", "soft_drink", "juice", "coffee_tea", "energy_drink"],
    "alcohol": ["beer", "wine", "spirits", "cider"],
    "restaurant": ["meal", "starter_snack", "dessert", "drink", "alcohol", "coffee"],
    "household": ["cleaning", "kitchen", "bags_packaging", "home_decor", "garden"],
    "personal_care": ["toiletries", "cosmetics"],
    "pharmacy": ["medicine", "supplements"],
    "pet": ["pet_food", "pet_supplies"],
    "clothing": ["clothing", "shoes", "accessories"],
    "electronics": ["electronics"],
    "fuel": ["fuel"],
    "parking": ["parking"],
    "transport": ["transport"],
    "utilities": ["tv", "internet", "electricity", "water", "phone"],
    "services": ["services"],
    "other": ["other"],
}
CATEGORY_TEXT = "\n".join(f"  {c}: {', '.join(subs)}" for c, subs in CATEGORIES.items())

# ---------------------------------------------------------------------------
# What we ask the model to return.  Same shape as ground_truth.json.
# ---------------------------------------------------------------------------
NUM_OR_NULL = {"type": ["number", "null"]}
STR_OR_NULL = {"type": ["string", "null"]}

SCHEMA = {
    "type": "object",
    "properties": {
        "doc_type": {
            "type": "string",
            "enum": ["itemized_receipt", "card_slip", "handwritten", "invoice", "bar_tab", "other"],
        },
        "store_type": {"type": "string", "enum": STORE_TYPES},
        "country": {"type": "string", "description": "ISO code like MZ or ZA, or empty string if unknown"},
        "currency": {"type": "string", "description": "ISO code like MZN or ZAR, or empty string if unknown"},
        "store_name": STR_OR_NULL,
        "store_branch_address": STR_OR_NULL,
        "store_tax_id": STR_OR_NULL,
        "receipt_number": STR_OR_NULL,
        "date": STR_OR_NULL,
        "time": STR_OR_NULL,
        "payment_method": STR_OR_NULL,
        "subtotal": NUM_OR_NULL,
        "tax_total": NUM_OR_NULL,
        "discount_total": {"type": "number", "description": "0 if no discount shown"},
        "total": NUM_OR_NULL,
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "qty": NUM_OR_NULL,
                    "unit_price": NUM_OR_NULL,
                    "line_total": NUM_OR_NULL,
                    "category": {"type": "string", "enum": list(CATEGORIES)},
                    "subcategory": {"type": "string"},
                },
                "required": ["name", "qty", "unit_price", "line_total", "category", "subcategory"],
                "additionalProperties": False,
            },
        },
        "legibility": {"type": "string", "enum": ["good", "partial", "poor"]},
        "notes": {"type": "string", "description": "empty string if nothing to note"},
    },
    "required": [
        "doc_type", "store_type", "country", "currency", "store_name", "store_branch_address", "store_tax_id",
        "receipt_number", "date", "time", "payment_method", "subtotal", "tax_total",
        "discount_total", "total", "items", "legibility", "notes",
    ],
    "additionalProperties": False,
}

SYSTEM = """You extract structured data from photos of shopping receipts, bills and invoices.
Receipts come mainly from Mozambique (Portuguese, currency MZN / MT / MZM, tax id = NUIT, tax = IVA)
and South Africa (English, currency ZAR / R, tax id = VAT reg no).

Rules:
- Read only what is printed or handwritten on the paper. Never invent a value: if a field is
  not present or not readable, return null. A blank "Valor" line means total = null.
- date -> "YYYY-MM-DD". time -> "HH:MM" (24h). Dates like "28/08/26" mean 2026-08-28.
- Amounts are plain numbers. "1.384,20" and "1,384.20" both mean 1384.20. Strip currency symbols.
- store_name = the trading name (e.g. "Shoprite", "Woolworths"), not the legal company name.
- store_type = what kind of place issued it (supermarket, restaurant, bar_cafe, parking, ...).
- store_branch_address = the full street address of THIS branch as printed anywhere on the
  receipt (header or footer), including the city if printed. Franchises have many branches, so
  the address matters. Do not invent a city that is not printed.
- store_tax_id = the STORE's NUIT or VAT number, digits only. Never the customer's tax id.
- items = one entry per purchased product line. Do NOT include discount lines, subtotals,
  tax lines, headers, category labels or payment lines as items.
  qty = quantity (weights like 0,720 kg are qty 0.72). unit_price = printed unit price, or
  line_total / qty when only the line total is printed, or null if it cannot be determined.
- Every item gets a category AND a subcategory from this list (use the closest one):
""" + CATEGORY_TEXT + """
  At a restaurant, bar or cafe, every line uses category "restaurant" with subcategory
  meal / starter_snack / dessert / drink / alcohol / coffee. Beer, wine and spirits bought in a
  shop use category "alcohol". Bread from a supermarket is food/bakery_bread; a plastic bag is
  household/bags_packaging; cat food is pet/pet_food.
- Parking tickets, tolls and other single-amount service receipts: create ONE item line
  (e.g. "Estacionamento", qty 1, unit_price = line_total = the amount, category parking) so the
  amount shows up in spending reports. If the amount is blank, the item has null prices.
- payment_method: one of "cash", "card", "mobile_money", "other", or null if not shown.
  Labels like "Ned", "POS", "EFT", "Visa", "Nedbank", "BIM" mean card; "M-Pesa", "Emola",
  "mKesh" mean mobile_money.
- A card-terminal slip (no products, just an amount) is doc_type "card_slip" with items = [].
- legibility: your honest read of how readable the photo was.
- notes: anything odd (garbled quantity, stamp over text, stapled slip, etc.), 1 sentence max."""

USER_TEXT = "Extract this receipt."


def load_env() -> None:
    """Find the API key without any extra dependency.

    Accepted, in order: an already-set ANTHROPIC_API_KEY, phase0/.env (KEY=VALUE lines),
    or any phase0/key*.txt file that contains a key starting with 'sk-ant-'.
    """
    if os.environ.get("ANTHROPIC_API_KEY"):
        return
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        if os.environ.get("ANTHROPIC_API_KEY"):
            return
    import re

    for f in sorted(HERE.glob("key*.txt")):
        m = re.search(r"sk-ant-[A-Za-z0-9_\-]+", f.read_text(encoding="utf-8", errors="ignore"))
        if m:
            os.environ["ANTHROPIC_API_KEY"] = m.group(0)
            return


def image_block(path: Path) -> dict:
    data = base64.standard_b64encode(path.read_bytes()).decode("utf-8")
    media = "image/jpeg" if path.suffix.lower() in (".jpg", ".jpeg") else "image/png"
    return {"type": "image", "source": {"type": "base64", "media_type": media, "data": data}}


def run_one(client, model_key: str, receipt: Path) -> dict:
    import anthropic

    cfg = MODELS[model_key]
    output_config = {"format": {"type": "json_schema", "schema": SCHEMA}}
    if cfg.get("effort"):
        output_config["effort"] = cfg["effort"]
    t0 = time.perf_counter()
    try:
        resp = client.messages.create(
            model=cfg["id"],
            max_tokens=16000,
            system=SYSTEM,
            messages=[{"role": "user", "content": [image_block(receipt), {"type": "text", "text": USER_TEXT}]}],
            output_config=output_config,
        )
    except anthropic.APIStatusError as e:
        return {"error": f"{type(e).__name__} {e.status_code}: {e.message}", "latency_s": time.perf_counter() - t0}
    except anthropic.APIConnectionError as e:
        return {"error": f"connection error: {e}", "latency_s": time.perf_counter() - t0}
    latency = time.perf_counter() - t0

    usage = resp.usage
    cost = (usage.input_tokens * cfg["in"] + usage.output_tokens * cfg["out"]) / 1_000_000
    out = {
        "model": cfg["id"],
        "stop_reason": resp.stop_reason,
        "latency_s": round(latency, 2),
        "usage": {"input_tokens": usage.input_tokens, "output_tokens": usage.output_tokens},
        "cost_usd": round(cost, 6),
        "request_id": getattr(resp, "_request_id", None),
    }
    if resp.stop_reason == "refusal":
        out["error"] = "refusal"
        return out
    text = next((b.text for b in resp.content if b.type == "text"), "")
    out["raw_text"] = text
    try:
        out["parsed"] = json.loads(text)
    except json.JSONDecodeError as e:
        out["error"] = f"bad JSON: {e}"
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", nargs="*", default=list(MODELS), choices=list(MODELS))
    ap.add_argument("--receipts", nargs="*", help="receipt ids like r01 r09 (default: all)")
    ap.add_argument("--force", action="store_true", help="redo receipts that already have results")
    ap.add_argument("--tag", default="", help="suffix for the results folder, e.g. v2 -> results/sonnet-5-v2")
    args = ap.parse_args()

    load_env()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("No API key found. Either copy your key file into this folder as key1.txt, or create phase0/.env with:  ANTHROPIC_API_KEY=sk-ant-...")
        return 1

    import anthropic

    client = anthropic.Anthropic()

    receipts = sorted(RECEIPTS_DIR.glob("r*.jpeg")) + sorted(RECEIPTS_DIR.glob("r*.jpg")) + sorted(RECEIPTS_DIR.glob("r*.png"))
    # receipt id = the part before the first "_" (files may be named r09_Woolworths_17_items.jpeg)
    rid = lambda p: p.stem.split("_")[0]
    if args.receipts:
        wanted = set(args.receipts)
        receipts = [r for r in receipts if rid(r) in wanted]
    if not receipts:
        print("No receipts found in", RECEIPTS_DIR)
        return 1

    grand_cost = 0.0
    for model_key in args.models:
        out_dir = RESULTS_DIR / (model_key + (f"-{args.tag}" if args.tag else ""))
        out_dir.mkdir(parents=True, exist_ok=True)
        print(f"\n=== {out_dir.name} ({MODELS[model_key]['id']}, effort={MODELS[model_key].get('effort', 'default')}) ===")
        for receipt in receipts:
            out_file = out_dir / f"{rid(receipt)}.json"
            if out_file.exists() and not args.force:
                prev = json.loads(out_file.read_text(encoding="utf-8"))
                if "parsed" in prev and "error" not in prev:
                    print(f"  {rid(receipt)}: cached")
                    continue
                # previous attempt failed -> retry
            result = run_one(client, model_key, receipt)
            result["receipt"] = receipt.name
            out_file.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
            if "error" in result:
                print(f"  {rid(receipt)}: ERROR {result['error']}")
            else:
                p = result["parsed"]
                grand_cost += result["cost_usd"]
                print(
                    f"  {rid(receipt)}: {result['latency_s']:>5.1f}s  ${result['cost_usd']:.4f}  "
                    f"{(p.get('store_name') or '?')[:28]:<28} total={p.get('total')}  items={len(p.get('items') or [])}"
                )
    print(f"\nSpent this run: ${grand_cost:.4f}")
    print("Now run:  python score.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
