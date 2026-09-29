"""Offline probe of khodrobin's explanation guard (services/ai/app/explain.py) with hand-written candidate explanations.

No model is called: each text below is invented and checked against fixed facts. Clone
https://github.com/sobhanaz/khodrobin (MIT), check out 2e5e77d (the commit read on 2026-09-29), and set KHODROBIN_DIR
to the clone.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.environ.get("KHODROBIN_DIR", "khodrobin"), "services/ai"))
from app import explain as e  # noqa: E402

facts = {
    "title": "پژو ۲۰۶",
    "year": 1400,
    "median_price": 1_000_000_000,
    "median_reliable": True,
    "min_price": 790_000_000,
    "max_price": 1_200_000_000,
    "offer_count": 6,
    "source_count": 2,
    "offers": [
        {"source_fa": "دیوار", "price": 790_000_000, "mileage_km": 120_000, "vs_median_pct": -21.0},
        {"source_fa": "باما", "price": 950_000_000, "mileage_km": 60_000, "vs_median_pct": -5.0},
    ],
    "flags": [],
}

cases = {
    "true, digits": "این پژو ۲۰۶ با ۷۹۰٬۰۰۰٬۰۰۰ تومان، ۲۱٪ زیر میانه است. در عوض ۶۰٬۰۰۰ کیلومتر بیشتر از گزینه‌ی بعدی کار کرده است.",
    "false price, scale word under 100 (2 billion)": "این پژو ۲۰۶ با ۲ میلیارد تومان عرضه شده است.",
    "false mileage, scale word under 100 (40 thousand km)": "این خودرو فقط ۴۰ هزار کیلومتر کار کرده است.",
    "false price, number words": "این خودرو با هفتصد میلیون تومان ارزان‌تر از همه است.",
    "false ratio claim": "این خودرو ۳ برابر ارزان‌تر از میانه است.",
    "false percentage": "این خودرو ۴۵٪ زیر میانه است.",
    "false year": "این پژو ۲۰۶ مدل ۱۳۹۸ است.",
    "invented condition, not in list": "این خودرو فنی سالم و بی‌خط و خش است.",
    "invented superlative, not in list": "این ارزان‌ترین پژو ۲۰۶ کل ایران است.",
}
for name, text in cases.items():
    ok, nums, topics = e.check(text, facts)
    print(f"{'PASS' if ok else 'REJECT':6}  {name:52}  unsupported={nums} topics={topics}")
