"""Count style markers in agent-harness prompt files, the same way for every harness (CS-43, harnesses.md section 5).

Usage: python3 promptstats.py FILE [FILE ...]   (needs `pip install tiktoken`)

Run it on prompt files from each harness's repository at the commits listed in ../harnesses.md. A prompt embedded in
source code is first copied verbatim into a .txt file, template placeholders left as they are. Tokens are o200k_base
(the GPT-4o and GPT-5 tokenizer) as a common yardstick; other tokenizers differ by roughly 10 to 20 percent.
"""
import collections
import re
import sys

import tiktoken

ENC = tiktoken.get_encoding("o200k_base")

EMPHASIS = ["NEVER", "ALWAYS", "MUST", "IMPORTANT", "CRITICAL", "DO NOT", "DON'T",
            "NOT", "ONLY", "REQUIRED", "SHOULD", "WARNING", "NOTE"]
NEGATIVE = [r"\bnever\b", r"\bdo not\b", r"\bdon't\b", r"\bdo n't\b", r"\bmust not\b",
            r"\bshould not\b", r"\bshouldn't\b", r"\bavoid\b", r"\brefrain\b",
            r"\bcannot\b", r"\bcan't\b", r"\bnot allowed\b", r"\bforbidden\b",
            r"\bprohibited\b"]
POSITIVE = [r"\balways\b", r"\bmust\b", r"\bshould\b", r"\bprefer\b"]
EXAMPLE = [r"<example", r"\bexample\b", r"\bexamples\b", r"\be\.g\.", r"\bfor example\b",
           r"\bfor instance\b"]


def stats(path):
    text = open(path, encoding="utf-8", errors="replace").read()
    words = text.split()
    lines = text.splitlines()
    caps_words = re.findall(r"\b[A-Z][A-Z']{2,}\b", text)
    caps_counter = collections.Counter(caps_words)
    emphasis = {k: len(re.findall(r"\b" + re.escape(k) + r"\b", text)) for k in EMPHASIS}
    negative = {p.strip("\\b"): len(re.findall(p, text, flags=re.I)) for p in NEGATIVE}
    positive = {p.strip("\\b"): len(re.findall(p, text, flags=re.I)) for p in POSITIVE}
    example = {p: len(re.findall(p, text, flags=re.I)) for p in EXAMPLE}
    tags = collections.Counter(m.group(1) for m in re.finditer(r"<([a-zA-Z_][\w-]*)(?:\s[^<>]*)?>", text))
    headers = sum(1 for ln in lines if re.match(r"^\s{0,3}#{1,6}\s", ln))
    bullets = sum(1 for ln in lines if re.match(r"^\s*([-*+]|\d+[.)])\s", ln))
    code_fences = text.count("```") // 2
    print(f"== {path}")
    print(f"words={len(words)} tokens_o200k={len(ENC.encode(text))} lines={len(lines)} "
          f"md_headers={headers} bullet_lines={bullets} code_blocks={code_fences}")
    print("emphasis_caps=" + ", ".join(f"{k}:{v}" for k, v in emphasis.items() if v))
    print(f"all_caps_words_total={len(caps_words)} top=" +
          ", ".join(f"{w}:{c}" for w, c in caps_counter.most_common(12)))
    print("negative(ci)=" + ", ".join(f"{k}:{v}" for k, v in negative.items() if v) +
          f" | total={sum(negative.values())}")
    print("positive(ci)=" + ", ".join(f"{k}:{v}" for k, v in positive.items() if v) +
          f" | total={sum(positive.values())}")
    print("examples(ci)=" + ", ".join(f"{k}:{v}" for k, v in example.items() if v))
    print("xml_like_tags=" + ", ".join(f"{t}:{c}" for t, c in tags.most_common(15)))


if __name__ == "__main__":
    for p in sys.argv[1:]:
        stats(p)
