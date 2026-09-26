# ADR-0007: PostgreSQL as the record, Elasticsearch as the index, a separate worker for ingestion, and LLM steps with evaluations

- Status: proposed
- Date: 2026-09-26
- Deciders: Pedrum
- Related: ADR-0003, ADR-0004, ADR-0006, ADR-0008, CS-4, CS-8, CS-9, CS-14, `docs/research/2026-09-26-torob-product-and-playbook.md`

## Context

Unlike a fixture-backed UI, Carshenas cannot exist without persistent data: raw snapshots of listings, normalised listings, price history, duplicate groups, a catalogue of makes, models and trims, daily market values, and labelled evaluation sets. Buyers search that data in Persian with facets, and ranking depends on a computed deal score. Most of the work outlives a request: crawling, LLM extraction, duplicate detection, revaluation and indexing. The owner said on 2026-09-26: "I'm leaning towards nextjs, react. however no problem with postgres, elastic and llm context engineering". Torob itself runs PostgreSQL and Elasticsearch.

## Decision (proposed)

1. **PostgreSQL is the system of record**: sources, snapshots (content hash, fetch time, raw payload), listings, vehicles and duplicate groups, the canonical make/model/trim catalogue, valuations per segment and day, evaluation sets and runs. **pgvector** holds text and image embeddings for duplicate detection. Migrations live in the repository; the tool is chosen in CS-4.
2. **Elasticsearch is a derived index**, rebuildable from PostgreSQL at any time: Persian normalisation (Arabic ي/ك to Persian ی/ک, zero-width non-joiners, Persian and Arabic digits), facets, and `function_score` ranking by deal score and freshness.
3. **Background work runs in a worker process outside Next.js** (for example `apps/worker`), fed by a job queue: crawl, extract, match, deduplicate, revalue, index. The queue (pg-boss on PostgreSQL or BullMQ on Redis) is chosen in CS-4 by measurement, preferring fewer moving parts. Code shared by the web app and the worker moves to `packages/*` only when both actually import it (ADR-0003's trigger).
4. **LLM steps follow context engineering**: versioned prompts that carry the domain glossary, strict JSON-schema outputs validated in code, a confidence per field with a review queue below a threshold, results cached by input hash, and **numbers shown to users always come from the database**, never from model text. **No AI step ships without a labelled evaluation set and a reported accuracy** (CS-9). The provider must be reachable from where the worker runs; the choice and the cost per thousand listings are recorded in CS-8.
5. **Local development** runs PostgreSQL and Elasticsearch in Docker Compose. The web app reads only through server-only query functions (ADR-0004), so pages do not change when the data layer does. The web app stays Next.js 16 and React 19 (ADR-0003).

## Alternatives considered

- **PostgreSQL full-text search only**: one service fewer, but weaker Persian analysis, facets and relevance tuning. It stays the fallback if Elasticsearch is too heavy for the host.
- **OpenSearch** instead of Elasticsearch: nearly the same API with a different licence; choose it if hosting or licensing requires.
- **Meilisearch or Typesense**: simple and fast, but less control over Persian analysis and further from Torob's stack.
- **A Python/FastAPI worker**: Torob's own backend language and the stronger ML ecosystem; the owner prefers TypeScript end to end. Revisit if the valuation model needs Python libraries.
- **A dedicated vector database** (Qdrant, as Torob uses for image search): unnecessary at prototype scale; pgvector keeps one database.

## Consequences

- Positive: mirrors Torob's own stack; everything derived can be rebuilt from snapshots; evaluation is part of the architecture, not an afterthought.
- Negative / risks: more services to run and to host inside Iran; Elasticsearch needs at least about 2 GB of memory; LLM availability and cost are exposed to sanctions and exchange rates.
- Follow-ups: CS-4 accepts or amends this ADR, adds Docker Compose, migrations and the queue; CS-8 records the LLM provider; CS-9 builds the evaluation harness; CS-14 builds the index.
