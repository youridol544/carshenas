"""Offline probe of Capot's keyword risk scanner (backend/app/enrich.py: scan_text) on negated Persian phrases.

No model and no network: scan_text is a pure keyword function. Clone https://github.com/mhnasajpour/Capot, check out
b1eb287 (the commit read on 2026-09-29), and set CAPOT_DIR to the clone. Capot declares no licence, so its code is read
at run time and not copied here.
"""
import ast
import os
import pathlib

src = (pathlib.Path(os.environ.get("CAPOT_DIR", "capot")) / "backend/app/enrich.py").read_text(encoding="utf-8")
tree = ast.parse(src)
keep = [n for n in tree.body if isinstance(n, (ast.Assign, ast.AnnAssign)) and any(
    getattr(t, "id", None) in ("RISK_PATTERNS", "POSITIVE_PATTERNS", "CONTEXT_PATTERNS")
    for t in ([n.target] if isinstance(n, ast.AnnAssign) else n.targets))]
keep += [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "scan_text"]
ns = {"Any": object}
exec(compile(ast.Module(body=keep, type_ignores=[]), "enrich_subset", "exec"), ns)
scan = ns["scan_text"]
for text in [
    "بدون رنگ شدگی، بدون تصادف، فنی سالم",
    "سند آزاد است و در رهن نیست",
    "بدون دور رنگ",
    "تصادفی نیست",
    "موتور تعویض نشده",
    "فقط یک لکه رنگ روی درب",
]:
    r = scan(text)
    print(f"{text:40} red_flags={[f['code'] for f in r['red_flags']]} positives={r['positives']}")
