"""
IziCost Phase 0 - score benchmark results against ground_truth.json.

Reads phase0/results/<model>/<receipt>.json (written by bench.py), compares each field to
the hand-checked ground truth, prints a summary table and writes phase0/REPORT.md.

Usage (from the phase0 folder):   python score.py
"""
from __future__ import annotations

import json
import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

HERE = Path(__file__).resolve().parent
GT_FILE = HERE / "ground_truth.json"
RESULTS_DIR = HERE / "results"
REPORT_FILE = HERE / "REPORT.md"

# The fields we grade at receipt level, in report order.
HEADER_FIELDS = ["store_name", "date", "total", "store_tax_id", "currency", "time", "payment_method"]


# ---------------------------------------------------------------------------
# normalisation helpers
# ---------------------------------------------------------------------------
def norm_str(s) -> str:
    if s is None:
        return ""
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.casefold()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(s.split())


def digits(s) -> str:
    return re.sub(r"\D", "", str(s)) if s is not None else ""


def num_eq(a, b, tol=0.011) -> bool:
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    try:
        return abs(float(a) - float(b)) <= tol
    except (TypeError, ValueError):
        return False


def sim(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def store_match(gt, pred) -> bool:
    g, p = norm_str(gt), norm_str(pred)
    if not g or not p:
        return g == p
    if g in p or p in g or sim(g, p) >= 0.8:
        return True
    # same leading brand word (e.g. "EMME - Empresa Municipal..." vs "EMME - Estacionamento...")
    gw, pw = g.split()[0], p.split()[0]
    return len(gw) >= 3 and gw == pw


def field_ok(field: str, gt, pred) -> bool | None:
    """True/False, or None when the field is not gradable for this receipt (not in ground truth)."""
    if field == "store_name":
        return store_match(gt, pred)
    if field in ("date", "currency", "payment_method"):
        if gt is None:
            return None
        return norm_str(gt) == norm_str(pred)
    if field == "time":
        if gt is None:
            return None
        return digits(gt) == digits(pred)[:4]
    if field == "total":
        return num_eq(gt, pred)  # null==null counts (blank Valor case)
    if field == "store_tax_id":
        if gt is None:
            return None
        return digits(gt) == digits(pred)
    return None


# ---------------------------------------------------------------------------
# item matching
# ---------------------------------------------------------------------------
def match_items(gt_items: list, pred_items: list) -> dict:
    """Greedy one-to-one match on name similarity + line total. Returns counts."""
    used = set()
    matched = 0
    price_ok = 0
    qty_ok = 0
    misses = []
    for g in gt_items:
        gname = norm_str(g["name"])
        best, best_i, best_score = None, None, 0.0
        for i, p in enumerate(pred_items):
            if i in used:
                continue
            s = sim(gname, norm_str(p.get("name")))
            if num_eq(g.get("line_total"), p.get("line_total")):
                s += 0.5  # same money strongly suggests the same line
            if s > best_score:
                best, best_i, best_score = p, i, s
        if best is not None and best_score >= 0.6:
            used.add(best_i)
            matched += 1
            if num_eq(g.get("line_total"), best.get("line_total")):
                price_ok += 1
            else:
                misses.append(f"price {g['name']!r}: gt {g.get('line_total')} vs {best.get('line_total')}")
            if num_eq(g.get("qty"), best.get("qty")):
                qty_ok += 1
            else:
                misses.append(f"qty {g['name']!r}: gt {g.get('qty')} vs {best.get('qty')}")
        else:
            misses.append(f"missing item {g['name']!r}")
    extras = [p.get("name") for i, p in enumerate(pred_items) if i not in used]
    for e in extras:
        misses.append(f"extra item {e!r}")
    return {
        "gt": len(gt_items), "pred": len(pred_items), "matched": matched,
        "price_ok": price_ok, "qty_ok": qty_ok, "extras": len(extras), "misses": misses,
    }


# ---------------------------------------------------------------------------
def score_model(model: str, gts: list[dict]) -> dict:
    rows = []
    for gt in gts:
        f = RESULTS_DIR / model / f"{gt['id']}.json"
        if not f.exists():
            continue
        res = json.loads(f.read_text(encoding="utf-8"))
        row = {"id": gt["id"], "doc_type": gt["doc_type"], "latency_s": res.get("latency_s"), "cost_usd": res.get("cost_usd", 0)}
        if "error" in res or "parsed" not in res:
            row["error"] = res.get("error", "no parsed output")
            row["fields"] = {k: False for k in HEADER_FIELDS}
            row["items"] = match_items(gt["items"], [])
            rows.append(row)
            continue
        p = res["parsed"]
        row["fields"] = {k: field_ok(k, gt.get(k), p.get(k)) for k in HEADER_FIELDS}
        row["items"] = match_items(gt["items"], p.get("items") or [])
        row["pred_total"] = p.get("total")
        rows.append(row)

    def pct(num, den):
        return None if den == 0 else round(100.0 * num / den, 1)

    summary = {"model": model, "n": len(rows)}
    for k in HEADER_FIELDS:
        vals = [r["fields"][k] for r in rows if r["fields"][k] is not None]
        summary[k] = pct(sum(1 for v in vals if v), len(vals))
    gt_items = sum(r["items"]["gt"] for r in rows)
    summary["item_recall"] = pct(sum(r["items"]["matched"] for r in rows), gt_items)
    summary["item_price"] = pct(sum(r["items"]["price_ok"] for r in rows), gt_items)
    summary["item_qty"] = pct(sum(r["items"]["qty_ok"] for r in rows), gt_items)
    summary["extra_items"] = sum(r["items"]["extras"] for r in rows)
    summary["perfect_receipts"] = sum(
        1 for r in rows
        if all(v is not False for v in r["fields"].values())
        and r["items"]["matched"] == r["items"]["gt"] and r["items"]["price_ok"] == r["items"]["gt"] and r["items"]["extras"] == 0
    )
    summary["errors"] = sum(1 for r in rows if "error" in r)
    lat = [r["latency_s"] for r in rows if r.get("latency_s")]
    summary["avg_latency_s"] = round(sum(lat) / len(lat), 1) if lat else None
    summary["total_cost_usd"] = round(sum(r["cost_usd"] or 0 for r in rows), 4)
    summary["cost_per_scan_usd"] = round(summary["total_cost_usd"] / len(rows), 4) if rows else None
    summary["rows"] = rows
    return summary


PCT_COLS = {"store_name", "date", "total", "store_tax_id", "currency", "time", "payment_method", "item_recall", "item_price", "item_qty"}


def fmt(v, col=None):
    if v is None:
        return "-"
    if col in PCT_COLS:
        return f"{v:.1f}%"
    if col in ("cost_per_scan_usd", "total_cost_usd"):
        return f"${v:.4f}"
    return str(v)


def main() -> int:
    gt = json.loads(GT_FILE.read_text(encoding="utf-8"))["receipts"]
    models = sorted(d.name for d in RESULTS_DIR.iterdir() if d.is_dir()) if RESULTS_DIR.exists() else []
    if not models:
        print("No results yet. Run bench.py first.")
        return 1
    summaries = [score_model(m, gt) for m in models]

    lines = []
    lines.append("# IziCost Phase 0 - OCR benchmark report\n")
    lines.append(f"Receipts graded: {len(gt)}. Ground truth: `ground_truth.json`. Raw model output: `results/<model>/`.\n")
    lines.append("## Summary (higher is better, except cost and latency)\n")
    cols = ["model", "n", "perfect_receipts", "store_name", "date", "total", "store_tax_id", "item_recall", "item_price", "item_qty", "extra_items", "errors", "avg_latency_s", "cost_per_scan_usd", "total_cost_usd"]
    lines.append("| " + " | ".join(cols) + " |")
    lines.append("|" + "---|" * len(cols))
    for s in summaries:
        lines.append("| " + " | ".join(fmt(s[c], c) for c in cols) + " |")
    lines.append("")
    lines.append("- **perfect_receipts**: every header field right AND every item found with the right price, no extras.")
    lines.append("- **item_recall**: % of true item lines the model found. **item_price**: % with the right line total. **extra_items**: invented/duplicated lines (bad).")
    lines.append("- **store_tax_id** = NUIT / VAT number. **total** counts a correct `null` on the blank parking ticket (r15) as right.\n")

    for s in summaries:
        lines.append(f"## {s['model']} - per receipt\n")
        lines.append("| receipt | type | store | date | total | tax id | items found | price ok | extras | secs | $ | problems |")
        lines.append("|---|---|---|---|---|---|---|---|---|---|---|---|")
        for r in s["rows"]:
            f = r["fields"]
            def mark(v):
                return "-" if v is None else ("✓" if v else "✗")
            it = r["items"]
            probs = r.get("error") or "; ".join(it["misses"][:6]) + (" ..." if len(it["misses"]) > 6 else "")
            lines.append(
                f"| {r['id']} | {r['doc_type']} | {mark(f['store_name'])} | {mark(f['date'])} | {mark(f['total'])} | {mark(f['store_tax_id'])} "
                f"| {it['matched']}/{it['gt']} | {it['price_ok']}/{it['gt']} | {it['extras']} | {r.get('latency_s') or '-'} | {r['cost_usd']:.4f} | {probs} |"
            )
        lines.append("")

    REPORT_FILE.write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines[:6 + len(summaries)]))
    print(f"\nFull report written to {REPORT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
