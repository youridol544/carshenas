# ADR-0042: Write every string a person reads as a calm, direct expert friend: «شما» with plain standard verbs, one idea per sentence, nothing a buyer cannot check or act on

- Status: accepted by delegation (2026-10-04; the owner asked that lane decisions be taken without him)
- Date: 2026-10-04
- Deciders: Pedrum (delegated to the CS-104 lane)
- Related: CS-104, CS-105 to CS-110; [`docs/design/product-voice.md`](../design/product-voice.md); [`docs/research/2026-10-04-product-copy-voice.md`](../research/2026-10-04-product-copy-voice.md); `docs/product/glossary.md`; `docs/design/design-language.md`

## Context

The owner's feedback of 2026-10-04: much of the product's text is fluffy, repeats itself, carries technical detail a buyer does not need, and does not sound like native Farsi or a product voice. His examples: the home intro, the «بفهم» button, popovers full of thresholds, and a paste-a-link message that makes the feature feel broken by stating a limit. A measurement of the 1,871 strings confirms it: 152 use «؛» to join ideas, «هنوز» and «فعلاً» appear 68 times, «پایگاه داده» 17 times, one retry sentence is pasted into ten messages, and a panel mixes «ما» and «من». Nothing says who the product is, so every writer, human or agent, guesses. Doing nothing means five rewrite tasks (CS-106 to CS-110) with five voices.

## Decision

1. **The voice is a calm, direct expert friend.** Calm (no «!», no hype, no alarm), direct (the answer first), plain (the glossary's words), honest (says once what it does not know, never apologises).
2. **The address is «شما», usually unsaid, with verbs in plain standard Farsi** («می‌خواهید»، «ببینید»). Not the spoken «تو» forms («می‌خوای، می‌تونی، رو»), not the written-formal forms («نمایید، گردید، می‌باشد»). A buyer's own typed words stay as typed.
3. **«ما» for what the product did, never «من»**, and usually no subject at all. «کارشناس» is a name, not a subject.
4. **The shape:** one idea per sentence (about 15 words, never over 25), a verb for every action, each idea once per screen (title, lead, hint, button and notice are written as one set), one word per idea (the glossary's nouns and the guide's verbs).
5. **Nothing a buyer cannot check or act on:** no database, queue, crawler, threshold, method, version or window on a buyer's screen. A number is shown only when it compares, limits or supports a verdict the buyer can check on the page.
6. **The patterns:** a button is a verb, a label a noun, a title short; an error says what happened and what to do; a limit is a fact with a way forward; no «لطفاً»، «متأسفانه» or apology.
7. **The ezafe after a silent «ه» stays «ه‌ی»** (`design-language.md`), though the Academy writes «ۀ»: it types and searches the same everywhere.
8. **Enforcement:** the guide is normative; the `copy-fa` skill, the `.claude/rules/copy.md` rule and the read-only `copy-reviewer` agent apply it; the copy lint (CS-105) refuses what a script can see. The address and register change only by a superseding ADR; examples and words change by pull request.

## Alternatives considered

- **The spoken «تو» register** (Torob's store text, Tapsi, Jabama). Friendlier on paper, but a stranger addressed that way about hundreds of millions of tomans reads it as presumption; Tapsi and Jabama mix it with «شما» on one page, and a mixed register is what reads machine-written; its grammar is where a writer slips without a lint to catch it.
- **The formal written register** («نمایید، می‌باشد، در اختیار شما قرار می‌دهد»). What translation and templates produce; Microsoft's Persian guide replaces exactly these.
- **A tone per page** (playful on the home page, strict on the listing). Rejected: the voice is constant and the tone follows the moment (Mailchimp, Apple, Atlassian); a page-by-page voice is five voices.
- **Leave it to taste, with a review.** Rejected: a review without a guide is an opinion; the guide gives the reviewer evidence to quote.
- **«ما» and «من» both** (a person-like assistant). Rejected: «من» makes the product a chatbot that is wrong the first time a rating is wrong.

## Consequences

- Positive: one voice across about 2,000 strings and five parallel rewrite tasks; a reviewer can quote the rule a string breaks; short, native-sounding text; the buyer is not shown how the machine works.
- Negative / risks: plainer than Torob's store text and Jabama's «سفرت»; a rewrite touches most copy files once; several glossary rows need a decision (guide, appendix A); the lint and the reviewer will disagree with the owner's taste sometimes, and the owner decides.
- Divergence kept on purpose: «ه‌ی» against the Academy's «ۀ».
- Follow-ups: CS-105 (lint and inventory), CS-106 to CS-110 (the rewrites), a glossary pass for the rows in appendix A.
