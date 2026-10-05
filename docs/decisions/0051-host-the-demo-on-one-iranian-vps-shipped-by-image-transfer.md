# ADR-0051: Host the demo on one Iranian VPS, with images shipped from the owner's computer

- Status: proposed (2026-10-04). A draft for the owner, who chooses the host: nothing was rented or bought, and the recommendation below binds nobody until it is accepted or changed here.
- Date: 2026-10-04
- Deciders: Pedrum (the owner)
- Related: tasks CS-37 (the deploy, done by the owner on a server of their choice), CS-119 (the deployment kit), CS-38, CS-49; ADR-0003 (services must work from inside Iran), ADR-0011, ADR-0015, ADR-0017 (point 10: the deployment is unlisted), ADR-0018; research: `docs/research/2026-10-04-iranian-hosting-for-the-demo.md` (every claim below has its source and date there); runbook: `docs/runbooks/deploy.md`

## Context

Torob's reviewers are in Iran and open the demo link days or weeks after it is sent, so it must open without a VPN and keep a worker crawling from an Iranian network meanwhile (ADR-0017). Docker Hub and many registries refuse Iranian addresses and npm can be slow there, so the server must never pull an image or install a package: the kit builds on the owner's computer and ships with `docker save | ssh docker load`. The stack is a Next.js web app, a worker, PostgreSQL 18 (with its own roles and settings, `db/bootstrap`) and a TLS proxy. The owner pays in tomans through Iranian bank cards. Nothing can be bought or verified from the repository's side; this ADR gives the owner three real options, priced on 2026-10-04.

## Decision (proposed)

Rent **one VPS at ParsPack, plan "VPS Iran" 4 vCPU, 8 GB, 100 GB SSD, 2,635,000 tomans a month**, run the kit on it (`scripts/deploy.sh user@host`), and put the domain's A record straight on its address. Try the kit first on ParsPack's free 24-hour cloud-server trial. The 2 vCPU, 4 GB plan (1,550,000) is the least that works. **Fallback**: the same kit on another Linux server (first Liara's Cloud Server, Uranus 4/8/80 at 4,600,000), and, if no VPS opens from Iranian networks, Hamravesh's Darkube in its Iran datacenter, which needs its own adaptation of the kit.

| | ParsPack VPS (IaaS) | Hamravesh Darkube (PaaS) | Liara platform (PaaS) |
|---|---|---|---|
| Price a month, whole stack | 2,635,000 (4 vCPU, 8 GB, 100 GB); 1,550,000 for 2 vCPU, 4 GB | about 3,670,000 for 2 vCPU, 4 GB, 80 GB (595,000 a vCore, 290,000 a GB of RAM, 16,500 a GB of SSD); download 3,200 a GB | about 4,900,000 (web and worker 1,300,000 each, database 2,300,000); download 2,500 a GB; VAT added |
| Runs our images, the compose file, a port-less worker, PostgreSQL 18 with our roles | Yes, it is a server we control; Docker is ours to install from an Iranian apt mirror | Images from a git Dockerfile or a registry, disks, port-less workers; no compose; managed PostgreSQL versions unknown (our own container with a disk) | One HTTP port per app, no compose, no documented upload of a built image, a port-less worker undocumented; managed PostgreSQL 18 exists, roles and settings unknown |
| Certificates | Ours: Caddy; a DNS-challenge certificate copied to the server is the safe way (ParsPack says http validation fails on isolated servers) | Free, by a DNS record, renewed by the platform | Free one-click, renewed by the platform |
| Payment | Bank gateways, prepaid, invoice, no refund | Card gateway or transfer, invoices monthly | Credit top-up; the panel is cut when credit ends, apps deleted after 24 hours |
| Egress address for the crawler | Its own, fixed | Shared, an exclusive one costs extra | Shared, changes |

Verify that it opens from Iran without a VPN, and record the result on CS-37: check-host.net's Iranian nodes `ir1` to `ir8` (`https://check-host.net/check-http?host=https://DOMAIN&node=ir1.node.check-host.net`), a phone on mobile data with Wi-Fi and the VPN off, a home line, `nslookup DOMAIN` not answering 10.10.34.x, and again after a day and a week.

## Alternatives considered

- **Hamravesh Darkube**: the better platform of the two, and the structural fallback, but more than twice the price for the same capacity (3,670,000 against 1,550,000 for 2 vCPU and 4 GB; 6,020,000 against 2,635,000 for 4 vCPU and 8 GB), it shares an outbound address, and the compose-based kit would need a rewrite as separate apps and a disk for the database.
- **Liara's platform**: one HTTP port per app, no compose and no way documented to load a locally built image conflict with how the kit works; the whole stack costs two to three times the VPS (4,900,000 for 4 GB in all, against 1,550,000 or 2,635,000), and an empty credit deletes the apps in a day. Its Cloud Server is a VPS and is the first fallback.
- **ArvanCloud and the other Iranian VPS providers**: their pages gave no readable price or Docker terms (research note, "Could not verify"). Any of them runs the kit if the owner prefers it.
- **A foreign host**: ADR-0003; a link that needs a VPN fails the reviewers.
- **An address with no domain**: a certificate for it is either Caddy's own (a browser warning) or a six-day Let's Encrypt one (`acme-ip`, untried), which a broken link to the authority lets expire; `sslip.io` and `nip.io` are filtered from Iran.

## Consequences

- **Positive**: the cheapest option; the server pulls nothing, so a blocked registry cannot stop a deploy; the kit is not tied to the provider, so the fallback is a new `scripts/deploy.sh user@host` and a restored release.
- **Negative and risks**: none of the three could be tested from a rented machine (reaching `divar.ir`, `api.metisai.ir` and the certificate authority from it, outbound ports, and any IP-reputation or national-network effect), so the first deploy is also the test; the ParsPack terms ban "illegal data acquisition" and allow suspension without notice, which the crawl's pace and its pause switch (ADR-0008, ADR-0018) answer but cannot rule out; certificates by a DNS challenge need a renewal every 60 days; a VAT of 10 % or more may sit on top of every price.
- **Follow-ups**: the owner's choice recorded here (status accepted, with the host and the verification); CS-37 criteria 1, 3 and the checks above after the first deploy; a task to adapt the kit to Hamravesh only if it is chosen; the web licence of the typeface registered for the domain before anyone else opens it (ADR-0015).
