# ADR-0030: Write the listing page's explanation by code from stored facts, with no language model

- Status: accepted by delegation (the owner's standing instruction of 2026-09-30, decided by the coordinator and the CS-64 lane on 2026-10-02)
- Date: 2026-10-02
- Deciders: Pedrum (delegated)
- Related: CS-64, S01 (`docs/specs/S01-deal-ratings.md`), ADR-0017 point 10, ADR-0021 (the AI layer), `docs/evidence/listing-page/2026-10-02-explanation-faithfulness.md`

## Context

The listing page must say why a listing has its rating: the market value and its date, the price gap, the comparables used, what moved the value, how accurate the value is, or why there is no rating. The task planned a model to word it. Every number must come from the database (AGENTS.md), the field survey asked for a measured faithfulness rate, the Metis credit is for tasks only (no live path may spend it), and every fact the sentences need is already stored: the run, the segment, the fitted coefficients, the comparables.

## Decision

The explanation is built at read time by a pure function (`apps/web/src/features/listing/listing-explanation.ts`) from the stored rows through Farsi templates. Each number it writes is recorded as a *figure* with its source (a column, or the formula on columns, such as an adjustment's size `exp(coefficient × the car's value) - 1`). Tests prove that every digit in the text is a recorded figure and that every figure equals a recomputation in SQL from the stored rows (`listing-page-data.db.test.ts`, and a 30-listing sample reporting the rate: 100 % on 2026-10-02). Nothing is stored (`deal_explanation` is not built) and no model is called.

## Alternatives considered

- **A model words the sentences from the facts.** Fluent, but a number can be misquoted, it needs an evaluation set and a switch that spends credit on every page view or a cache of stored text that goes stale, and the faithfulness would be a measured rate below 100 %, not a property of the code.
- **Templates now, a model later.** Left open: if buyers need more varied prose, a model may rephrase the template's own output, with the figures list as the check, behind its own switch (ADR-0021).

## Consequences

- Positive: faithful by construction, free, instant, testable, and identical for the page, a pasted link (CS-65) and the model page (CS-67).
- Negative: the prose is formulaic; every new kind of fact needs a template and its figure.
- Follow-ups: none.
