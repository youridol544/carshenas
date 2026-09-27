# The challenge Carshenas answers

> Recorded 2026-09-26 from Torob's careers site. Owner: Pedrum. The challenge page is gated behind a puzzle on jobs.torob.com; how to solve it is deliberately not recorded here.

## What Torob asks

Torob's **AI Product Engineer** role (remote, full-time, at least two years of relevant experience) is applied for by building, not by sending a CV. The challenge page (`https://jobs.torob.com/ai-product-engineer`) says:

> «ترب … رو بساز: بلیت هواپیما، بیمه، خودرو، خانه، یا هر بازاری که فکر می‌کنی جست‌وجوش می‌تونه خیلی بهتر بشه.»
> Build Torob for X: airline tickets, insurance, cars, homes, or any market whose search you think could be much better.

Its terminal sketch is the whole brief:

```
$ build torob --for "airplane tickets"
> crawl offers
> normalize messy data
> rank by user intent
> explain the best choice
> ship demo.mp4 --max-duration 5m
```

The application path has four steps:

1. **Choose X**: a market where you can build an experience like Torob's, "but with your own view".
2. **Build with AI**: use AI tools for research, coding, design, data, testing and fast iteration.
3. **Short demo**: a video of at most five minutes showing the problem, the product and your important decisions.
4. **Submit**: the demo video (upload up to 200 MB, MP4, WebM or MOV, or a viewable link), the GitHub or project link, and contact details.

A second path exists for people without good access to AI tools: send a PDF CV and, if approved, receive a US $20 AI credit. The two submissions are reviewed separately.

## What they say they value

- "AI Product Engineer = engineer + builder + product taste": someone who does not wait for ready tasks, understands the problem, thinks with users and data, prototypes quickly with AI and pushes the experience until it is usable.
- A good output combines full-stack engineering, product judgement, UX taste and practical use of AI.
- "We are looking for someone who is not afraid of ambiguity and can take it from zero to a demo alone."

Signals from Torob itself (details and sources in `docs/research/2026-09-26-torob-product-and-playbook.md`):

- Its engineering blog reports LLM features the way a reviewer will want ours reported: constrained decisions and a measured accuracy on a hand-labelled set (their support-ticket automation handles 68 % of steps, 92 % of them correctly).
- The role's job record in the public careers API lists Python and Django, React, FastAPI, PostgreSQL, Elasticsearch, Redis, Docker, Kubernetes and OpenAI, Claude, Gemini and Llama models, and describes "context engineering" and "agentic software development". PostgreSQL and Elasticsearch are why ADR-0007 proposed them; after measuring PostgreSQL's own search, ADR-0011 (2026-09-27) keeps everything in PostgreSQL and adds a search engine only if a measured trigger fires.
- Torob already ships an AI shopping assistant (TorobChat), so a chat window alone is not a differentiator; the pipeline, the ranking and the evidence are.

## Our answer

**Carshenas: Torob for used cars**, modeled on CarGurus and Autolist. Product brief: [`vision.md`](vision.md). Why this market and not flights, insurance or homes: ADR-0006 and `docs/research/2026-09-26-iran-vertical-market-landscape.md`.

## Deliverables and where they are tracked

| Deliverable | Task |
|---|---|
| Working prototype with real, lawfully crawled data | milestones m-2 to m-5 |
| Public or shareable project link | CS-21 (repository), CS-23 (deployment reachable from Iran) |
| Five-minute demo video and submission | CS-24 |
