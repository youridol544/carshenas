# Lab (CS-43)

Three small tools behind `../../2026-09-29-prompting-context-engineering-and-agents.md`:
- `tokens.mjs`: what Persian costs in tokens against English, per model family [L1];
- `promptstats.py`: prompt-style counts for the harness prompts in `../harnesses.md` §5;
- `rival-probes/`: offline probes of three Torob-challenge rivals' checks [L3].

## tokens.mjs

It measures what Persian text costs in tokens against the same text in English, on the tokenizers of the model families Carshenas can call through Metis. It also measures what three kinds of messy Persian do to the count:
- Persian digits against Latin digits;
- the Arabic yeh and kaf that some keyboards type;
- a space instead of the zero-width non-joiner.

```bash
cd docs/research/2026-09-29-prompting-context-engineering-and-agents/lab
npm install --no-package-lock   # js-tiktoken, pinned in package.json; node_modules/ is ignored by git
OFFLINE=1 node tokens.mjs       # OpenAI's o200k_base and cl100k_base only: no key, no network
node tokens.mjs                 # also Claude, Gemini, GPT and DeepSeek through Metis
```

**The key.** The live run needs `METIS_API_KEY` in the repository's `.env`, which git ignores. The script loads it from there and never prints it or writes it to a file.

**Calls and cost.** A run makes 96 calls, one at a time. At Metis's live prices (`../evidence/metis-pricing-2026-09-29.json`) it costs under US$0.05, most of it GPT's answers, which may run to 1,024 tokens each (see below).

**How each count is taken:**

| Tokenizer | How |
|---|---|
| `o200k`, `cl100k` | Offline, with js-tiktoken 1.0.21 |
| `gemini` | Gemini's `countTokens` for `gemini-3.1-flash-lite` through Metis, which is free |
| `claude` | The `input_tokens` of a Messages call to `claude-haiku-4-5` with `max_tokens: 1`. Metis answers 404 for Anthropic's free counting endpoint, `/v1/messages/count_tokens` |
| `openai` | The `prompt_tokens` of a Chat Completions call to `gpt-5.6-luna`. It needs `max_completion_tokens` of 1,024: with 16, GPT answered HTTP 400 ("Could not finish the message because max_tokens or model output limit was reached") instead of stopping early |
| `deepseek` | The `prompt_tokens` of a Chat Completions call to `deepseek-v4-flash` with `max_tokens: 1` |

Each live count has the same call's count for a one-character message (`.`) subtracted and one added back, so the chat formatting around the text is not counted. The subtracted amounts on 2026-09-29 were 8 (Claude), 2 (Gemini), 7 (GPT) and 31 (DeepSeek) tokens. GPT's live counts equal the offline o200k counts for every text, so gpt-5.6-luna uses o200k.

**The texts** are all synthetic, with no real seller, phone number or place:
- `listing-206` and `listing-camry`: the first two listings of the CS-42 lab (`../../2026-09-29-metis-ai/lab/listing.mjs`), with English translations.
- `listing-dena`: a longer listing in the colloquial spelling sellers use («داره», «مونده», «می‌شه»).
- `query-206`: the plain-Farsi query from CS-62.
- `rules`: the CS-42 lab's system prompt, and a Farsi translation of it. Both write numbers in Latin digits, so only the language differs.
- `glossary`: `docs/product/glossary.md` as it stands, as a stand-in for a prompt that carries the glossary.

The run the note quotes is `../evidence/tokens-2026-09-29.json` (2026-09-29, 14:48 UTC).

The first live run, at 14:45 UTC, is kept too, as `../evidence/tokens-first-live-run-2026-09-29.json`. It used Anthropic's counting endpoint and a 16-token cap for GPT, and its `live` baselines record the two refusals that led to the settings above:
- Metis's 404;
- GPT's 400.

## promptstats.py

It counts words, o200k tokens, capitalised emphasis words, negative phrases, positive directives, examples and XML-like tags in prompt files. The same rules apply to every harness.

**Run it** on prompt files taken from each harness's repository at the commits in `../harnesses.md` §1. A prompt embedded in source code is copied verbatim into a `.txt` file first.

```bash
pip install tiktoken
python3 promptstats.py path/to/prompt.txt [...]
```

**Rerun on 2026-09-29.** Two prompts gave the table's numbers exactly:
- OpenCode's `packages/opencode/src/session/prompt/anthropic.txt`: 1,335 words, 1,629 tokens, 9 negative phrases;
- Codex's GPT-6 Astra instructions template: 3,314 words, 4,148 tokens, 43 negative phrases.

## rival-probes/

These probe three Torob-challenge entries' checks with hand-written Persian text. No model is called in any of them.

| Probe | What it checks | Needs |
|---|---|---|
| `probe_capot.py` | Capot's keyword scanner on negated phrases | A clone of https://github.com/mhnasajpour/Capot at b1eb287, in `CAPOT_DIR` |
| `probe_khodrobin_guard.py` | khodrobin's explanation guard | A clone of https://github.com/sobhanaz/khodrobin at 2e5e77d, in `KHODROBIN_DIR` |
| `probe_homerob.mjs` | Homerob's number check | Nothing: its two functions are copied verbatim, MIT-licensed, with the commit noted |

- Capot declares no licence, so its code is read at run time and never copied here.
- The output of the run on 2026-09-29 is `../evidence/rival-probes-2026-09-29.txt`.
