"""Checks that every English string passed to t('...') in the app has a Portuguese entry.
Run:  python scripts/i18n-audit.py   (exit code 1 if anything is missing)"""
import re
import sys
from pathlib import Path

src = Path(__file__).resolve().parent.parent / "app" / "src"
i18n = (src / "lib" / "i18n.tsx").read_text(encoding="utf-8")

key_re = re.compile(r"""^\s*(['"])((?:(?!\1).|\\.)*)\1\s*:""", re.M)
pt_keys = {m.group(2) for m in key_re.finditer(i18n)}

call_re = re.compile(r"""\bt\((['"])((?:(?!\1).|\\.)*)\1""")
used = set()
for f in src.rglob("*.tsx"):
    if f.name == "i18n.tsx":
        continue
    text = f.read_text(encoding="utf-8")
    used |= {m.group(2) for m in call_re.finditer(text)}

# onboarding cards pass their strings through t() as variables
onb = (src / "components" / "onboarding.tsx").read_text(encoding="utf-8")
used |= set(re.findall(r"title: '([^']*)'", onb)) | set(re.findall(r"body: '([^']*)'", onb))

missing = sorted(k for k in used if k not in pt_keys)
print(f"strings used: {len(used)} | PT entries: {len(pt_keys)} | missing PT: {len(missing)}")
for m in missing:
    print("  MISSING:", m)
sys.exit(1 if missing else 0)
