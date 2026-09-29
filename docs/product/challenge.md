# The challenge Carshenas answers

> Recorded 2026-09-26 from Torob's careers site, and re-read on 2026-09-28: the challenge page, the role's record in the public careers API (`/api/public/v1/careers/jobs`, published 2026-09-05) and the careers home page. Owner: Pedrum. The challenge page is gated behind a puzzle on jobs.torob.com; how to solve it is deliberately not recorded here.

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

A diagram beside it gives the order of thought: **product sense → user problem → data, ranking and UX → shipped demo → learn and iterate**, under the line "AI Product Engineer = engineer + builder + product taste".

The application path has four steps:

1. **Choose X**: a market where you can build an experience like Torob's, "but with your own view".
2. **Build with AI**: use AI tools for research, coding, design, data, testing and fast iteration.
3. **Short demo**: a video of at most five minutes showing the problem, the product and your important decisions.
4. **Submit** the following:
   - the demo video (an upload of up to 200 MB in MP4, WebM or MOV, or a link reviewers can view);
   - the GitHub or project link;
   - contact details;
   - an optional notes field («توضیحات تکمیلی»).

A second path exists for people without good access to AI tools. They send a PDF CV and, if approved, receive a US $20 AI credit. The two submissions are reviewed separately.

Below the form is a builders' hall of fame («تالار افتخار سازنده‌ها»). It is "the place for products worth seeing: tasteful, bold and usable builds" («ساخته‌های باسلیقه، جسورانه و قابل استفاده»). On 2026-09-28 it was still empty: "no product has been featured yet".

## What they say they value

- **Who they want.** "AI Product Engineer = engineer + builder + product taste": someone who does not wait for ready tasks, understands the problem, thinks with users and data, prototypes quickly with AI and pushes the experience until it is usable.
- **What a good output is.** It combines full-stack engineering, product judgement, UX taste and practical use of AI.
- **Ambiguity.** "We are looking for someone who is not afraid of ambiguity and can take it from zero to a demo alone."
- **The job record**, in the careers API, not on the challenge page.
  - What Torob believes: business logic moves from code into language models through context engineering, and agentic software development makes building much faster.
  - Who it wants: people who love learning; who use AI smartly, knowing "when to get help from AI and when it is better to go another way"; and who put product success and user satisfaction first.
  - Responsibilities:
    - bringing AI into Torob's processes;
    - **building and improving ways to evaluate the accuracy and performance of AI models**;
    - finding and fixing performance bottlenecks in large systems;
    - raising the standards of agent-driven development;
    - technical ownership of key services;
    - prototyping new tools.
  - Requirements:
    - strong experience with Python and Django;
    - Git and code review;
    - hands-on AI product development;
    - Python performance work;
    - clear communication with colleagues and with AI;
    - a product-minded drive to finish.
  - Stack: Python, JavaScript, Django, React, FastAPI, PostgreSQL, Elasticsearch, Redis, Docker, Kubernetes, and OpenAI, Claude, Gemini and Llama models.
- **The careers home page** says every Torob search is about "relevance, data quality and **price freshness**" («تازگی قیمت»). It then lists ten problems behind every search, each mapped to Carshenas below.
- **The interview path for engineering roles**, after a submission is chosen, takes two to five weeks:
  1. a phone call;
  2. a first interview;
  3. a technical interview with live coding, or a task reviewed in a short session;
  4. a final interview with one or two senior managers about "your likely effect on the team's direction";
  5. reference checks;
  6. an offer.

Signals from Torob itself (details and sources in `docs/research/2026-09-26-torob-product-and-playbook.md`):

- **How it reports AI features.** Its engineering blog reports LLM features the way a reviewer will want ours reported: constrained decisions and a measured accuracy on a hand-labelled set. Its support-ticket automation handles 68 % of steps, and gets 92 % of them right.
- **Why ADR-0007 and ADR-0011 differ.** PostgreSQL and Elasticsearch in the job record are why ADR-0007 proposed them. After PostgreSQL's own search was measured, ADR-0011 (2026-09-27) kept everything in PostgreSQL and adds a search engine only if a measured trigger fires.
- **How Torob syncs shops.** Its shop protocol, Torob-Sync, pages products newest first, leaves deleted ones out and lets a shop ask for a single product to be re-read. ADR-0017 keeps Carshenas's index fresh the same way.
- **What a chat window is worth.** Torob already ships an AI shopping assistant (TorobChat), so a chat window alone is not a differentiator. The pipeline, the ranking and the evidence are.

## What reviewers will judge (our reading, 2026-09-28)

Nothing publishes a rubric. The page, the job record and the practice of companies that hire through work samples (`docs/research/2026-09-28-torob-challenge-expectations-and-field.md`) point to seven questions:

1. **Can I use it myself, now, on real and current listings?** "Usable" is one of the hall of fame's three words, and the reviewer opens the link days after it was sent (ADR-0017).
2. **Are the four steps of the brief visibly done?** Crawl, normalise, rank by intent, explain.
3. **Is every AI step measured?** Evaluating models is a listed responsibility, so each AI step needs an accuracy on a labelled set, its cost, and a reason why AI was used there and not code.
4. **Does it have taste?** A Farsi, right-to-left, phone-first interface that feels native, with no rough edges on the demo path.
5. **Were the hard decisions made and explained?** The data decision is one of them: what is crawled, how often, against which rules, and how it would work with partners.
6. **Does the repository show engineering standards?** Typed code, tests, PostgreSQL used well, and agent-driven development done well, which the job record lists as a responsibility.
7. **Did it ship?** A working, deployed product beats a perfect plan, and the hall of fame is still empty.

## How Carshenas answers Torob's ten search problems

| Torob's problem (careers home page) | Carshenas | Tasks | Measured by |
|---|---|---|---|
| Query understanding («فهم عبارت جست‌وجو»): Persian, Finglish and typos | Plain-Farsi search into filters, shown as chips; Persian normaliser, aliases, trigram typos | CS-59, CS-62 | Accuracy on a labelled set of queries |
| Attribute extraction («استخراج ویژگی‌های کالا») | Structured fields parsed by code; condition, price type and options read from free text by an LLM with the glossary | CS-34, CS-48, CS-52 | Per-field precision and recall on a hand-labelled set, with the cost |
| The same product under different names («تشخیص کالای مشابه») | One catalogue of makes, models and trims, with aliases | CS-50 | Matching accuracy |
| Shop matching («تطبیق فروشگاه‌ها»): sellers' identity and data | The same car on Divar and Bama grouped, cheapest first; dealers recognised | CS-55 | Pair precision and recall |
| Price validity («اعتبار قیمت»): fresh, valid and reliable | A live index with a request budget; negotiable, installment-bait and placeholder prices kept out of market values; "last checked" on every listing | CS-35, CS-51, CS-66 | Freshness metrics; price types on the labelled set |
| Finding contradictory data («کشف تناقض داده») | A text that contradicts the structured fields is flagged; so are risky prices. Divar's own statistics: 24 % of car listings contradict their own text | CS-52, CS-64 | Flag precision on the labelled set |
| Multi-stage ranking («رتبه‌بندی چندمرحله‌ای») | Filters, then the deal score, then freshness and duplicate groups | CS-59, CS-61 | Latency at the 95th percentile; ratings against what the market did next |
| Personal recommendation («پیشنهاد اختصاصی») | Intent words such as ride-hailing or family use become filters and ranking adjustments; a buyer's search files keep a search working for them | CS-62, CS-70 | Labelled queries |
| User-behaviour signals («سیگنال رفتار کاربران») | Demand from searches, pasted links and search files, shown to the superadmin; marked listings and an inbox; bot alerts after the demo | CS-53, CS-59, CS-65, CS-68 to CS-72, CS-76 | Demand counts per model |
| Low-latency answers («پاسخ کم‌تأخیر») | Market values and ratings computed before the search; PostgreSQL search | CS-51, CS-59 | Search API under 300 ms at the 95th percentile |

## Our answer

**Carshenas: Torob for used cars**, modeled on CarGurus and Autolist. The product brief is [`vision.md`](vision.md). Why this market and not flights, insurance or homes: ADR-0006 and `docs/research/2026-09-26-iran-vertical-market-landscape.md`.

- **Data** (ADR-0017): a live, bounded index of real Tehran listings, kept fresh within a request budget, with frozen releases for evaluation. Not a crawled sample, and not searches forwarded to the sources.
- **Stack:** TypeScript throughout. The Next.js app with an owner-only admin section, and a worker on pg-boss, all on PostgreSQL (ADR-0003, ADR-0011, ADR-0012).
- **Who else entered:** `docs/research/2026-09-28-torob-challenge-expectations-and-field.md`. On 2026-09-28 there were 30 public repositories, 8 of them for cars.
  - Only three crawl real data on a schedule.
  - No car entry with real data retires sold listings.
  - None measures how accurately its AI reads real listings.
  - The strongest car entry (khodrobin) rates specs rather than listings, and its site was down that day.

## Deliverables and where they are tracked

| Deliverable | Task |
|---|---|
| Working prototype on a live index of real listings, crawled under ADR-0008 | milestones m-2 to m-5 |
| Public or shareable project link | CS-36 (repository), CS-37 (an unlisted deployment reachable from Iran) |
| Five-minute demo video and submission | CS-75 |
