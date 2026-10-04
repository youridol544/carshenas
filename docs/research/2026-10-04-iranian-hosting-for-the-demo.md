# Where should the Carshenas demo run, so that reviewers inside Iran open it without a VPN: one VPS, or one of two container platforms?

- Date: 2026-10-04
- Asked by / for: the coordinator, for CS-119 (the deployment kit) and ADR-0051, which the owner decides. "A draft ADR comparing three Iranian hosting options (one VPS and two PaaS) ... mark every claim with its source and date; no purchase".
- Outcome: ADR-0051 (proposed); `docs/runbooks/deploy.md`.

## Questions

1. Which Iranian providers can run Carshenas as it is built (a Next.js web app, a 24/7 worker that crawls Divar, PostgreSQL 18 with its own roles and settings, a TLS proxy), at what monthly price, paid how?
2. Can each take images that were built elsewhere, when Docker Hub and many registries refuse Iranian addresses?
3. How does a visitor in Iran, and the owner, verify that the site opens without a VPN?
4. What does HTTPS need from inside Iran, with a domain and with only an address?

## Method

One research pass by a subagent on 2026-10-04 (web search, then fetches of the providers' own pages), then a second reading of the load-bearing pages by the author on the same day: ParsPack's server price list, Hamravesh's unit prices, Liara's price list and Docker page, Let's Encrypt's announcement of IP certificates. Both passes agree on every number below. Every fetch of this session left from an Iranian address: `https://api.country.is/` answered `{"ip":"5.208.207.111","country":"IR"}` (read 2026-10-04). So a page that loaded was reachable from one Iranian fixed line on that day; that is one vantage, and it says nothing about a mobile network. Prices are tomans a month unless stated. Nothing was bought, no account was made.

Anything not read on its page is marked UNVERIFIED.

## Sources

- ParsPack, VPS plans: https://parspack.com/servers/iran, read 2026-10-04 (price list); https://parspack.com/vps/iran; terms: https://parspack.com/terms, https://parspack.com/cloud-server/terms-and-condition; mirrors: https://docs.parspack.com/reference/mirror/linux/ubuntu/; certificates on isolated servers: https://docs.parspack.com/ssl/free-ssl-issue-iran-access/; filtered addresses: https://parspack.com/blog/domain/fix-domain-filter.
- Hamravesh (Darkube): https://hamravesh.com/pricing (read 2026-10-04); documentation: https://docs.hamravesh.com/products/darkube/getting-started, https://docs.hamravesh.com/container-registry/introduction/, https://docs.hamravesh.com/products/network/exclusive-outbound-ip, https://docs.hamravesh.com/general/financial/intro; terms: https://hamravesh.com/tos.
- Liara: https://liara.ir/pricing/ (read 2026-10-04); https://docs.liara.ir/paas/docker/how-tos/deploy-app/ (read 2026-10-04); https://docs.liara.ir/dbaas/postgresql/choose-version/; terms: https://liara.ir/terms/ (updated 2025-12-02); https://liara.ir/products/cloud-server/.
- Let's Encrypt, six-day and IP address certificates, generally available 2026-01-15: https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability.html, https://www.helpnetsecurity.com/2026/01/20/lets-encrypt-6-day-tls-certificates/ (read 2026-10-04). Caddy: https://caddyserver.com/docs/caddyfile/directives/tls (the ACME issuer's `profile`, experimental), https://github.com/caddyserver/caddy/issues/7399 (IP certificates, closed 2026-04-25).
- Iran's connectivity in 2026: https://community.letsencrypt.org/t/irans-internet-outage-and-challenges-for-renewing-letsencrypt-certs/246416 (a 35-day international outage in early 2026), https://itiran.com/2026/06/06/ (data-centre international links cut again on 2026-06-06 while home lines worked).
- Checkers: https://check-host.net/nodes/hosts and https://check-host.net/about/api (eight Iranian nodes), https://viewdns.info/iranfirewall/, https://blog.iranserver.com/check-site-access-iran/.
- Mirrors: https://github.com/Linuxmaster14/iran-docker, https://hamravesh.com/blog/container-registry-mirroring-and-caching/, https://docs.liara.ir/mirrors/docker/, https://docs.runflare.com/mirror/mirror-docker/.

## Findings

### One VPS: ParsPack, "VPS Iran" (read 2026-10-04)

| Topic | Finding |
|---|---|
| Plans and prices | 2 vCPU, 4 GB, 60 GB SSD: 1,550,000. **4 vCPU, 8 GB, 100 GB SSD: 2,635,000** ("ماهیانه/۲,۶۳۵,۰۰۰تومان"). 8 vCPU, 16 GB, 150 GB: 4,830,000. Every plan has a dedicated IPv4 address |
| Billing, payment | Monthly. Prepaid balance through Pasargad, Mellat and Saman bank gateways, an invoice in the panel, no refunds, nothing foreign. Setup fee, VAT and minimum term are not stated (UNVERIFIED) |
| What it runs | Ubuntu, Debian, AlmaLinux (versions not stated). Root over ssh, so Docker and Compose are ours to install; no one-click Docker seen |
| Mirrors | Its own: a Docker registry `docker.abrha.net` and apt `repo.abrha.net/ubuntu` (noble, jammy, focal) |
| Where | The cloud-server page lists Tehran3, Tehran11 and Tehran16; the VPS page says "Iran". It says services in its Iran cluster kept running in the outage (undated). No statement about the national network (NIN) or IP reputation |
| Terms | No clause about crawling. It bans spam, DDoS, intrusion and "illegal data acquisition", and may suspend without notice. A cloud-server's address can be changed after four days' notice |
| Free trial | The separate "Cloud Server Iran" (hourly, from 31,496 a day) offers a free 24-hour trial of limited resources: a way to try the kit before paying a month |

### Platform 1: Hamravesh, "Darkube" (read 2026-10-04)

| Topic | Finding |
|---|---|
| Prices, Iran datacenter | A vCore 595,000 (826 an hour), a GB of RAM 290,000 (403), a GB of SSD 16,500 (23), domestic download 3,200 per GB, upload free. Computed: 2 vCPU, 4 GB, 80 GB = 3,670,000; 4 vCPU, 8 GB, 80 GB = 6,020,000 |
| Containers | A Dockerfile from git, or an image from a public or private registry; each organisation has a private registry. Disks persist and are backed up daily. A worker needs no HTTP port. TCP and UDP ports exist (via the pages' summaries; two pages loaded empty: UNVERIFIED) |
| Database | Managed PostgreSQL exists; no version list was readable (a summary showed 16: UNVERIFIED). Our own `postgres:18` as an app with a disk is the way |
| HTTPS, egress | A free subdomain and certificate. A custom domain is validated by a DNS record (CNAME), renewed by itself. The outbound address is shared unless an exclusive one is bought (limited to one an organisation, not cancellable for a year) |
| Where, payment | Iran and Germany datacenters are offered. Card gateway or bank transfer; official invoices on the 1st to 10th; credit is not refundable; negative credit gives three days before shutdown. VAT not stated. Torob is listed as a customer on its home page |
| Terms | Fair use, no harm to third parties, suspension at its judgment; no clause about crawling |

### Platform 2: Liara (read 2026-10-04)

| Topic | Finding |
|---|---|
| Prices, platform plans | Mars 1 vCPU, 1 GB, 10 GB: 1,300,000. Jupiter 1/2/20: 2,300,000. Saturn 2/4/40: 4,125,000. Uranus 4/8/80: 7,250,000. Download 2,500 per GB, upload free. A stack of web (Mars), worker (Mars) and database (Jupiter) is about 4,900,000 (computed). Its **Cloud Server** (a VPS): Saturn 2/4/40 2,650,000; Uranus 4/8/80 4,600,000; an address 200,000 more (UNVERIFIED: one summary) |
| Containers | A Dockerfile is built on Liara's servers, or an image is pulled from Docker Hub or a public registry (`liara.json`, `image`). **One HTTP port per Docker app**: "فقط پورت یک وب‌سرور با پروتکل HTTP". No upload of a locally built image is documented. Compose is not supported (separate apps on a private network). A worker without a port is undocumented, and its health check expects one |
| Database | Managed PostgreSQL 18.4 and 18.0 are offered. Whether we may create the five roles, set `shared_preload_libraries` and keep `db/postgresql.conf`'s settings is UNVERIFIED |
| HTTPS, egress | One-click certificate with renewal, or a DNS record. The outbound address changes periodically; a static one is shared |
| Terms, payment | VAT is added on the invoice (rate not stated). Minimum payment 10,000,000 rials. When credit runs out the panel is cut and apps stop; they are deleted after 24 hours on the basic tier (30 days on higher ones). No clause about crawling |

### HTTPS from inside Iran

- **Let's Encrypt issues certificates for IP addresses**, generally available since 2026-01-15: valid 160 hours, only through the `shortlived` profile (Help Net Security, 2026-01-20, read 2026-10-04). Validation is by http-01 or tls-alpn-01, not DNS (a search summary: UNVERIFIED). Caddy's docs define the ACME issuer's `profile` (experimental), and an address gets Caddy's own certificate unless the profile is set. The deployment kit has it as an untried mode, `acme-ip`.
- **Reaching the authority from an Iranian server is the risk.** ParsPack's own documentation says HTTP validation fails on isolated Iranian servers and advises a DNS challenge (read 2026-10-04). In early 2026 Iran's international links were cut for over 35 days, and again for data centres on 2026-06-06 while home lines worked. A certificate valid six days cannot ride that out; a 90-day one, made by a DNS challenge away from the server and copied to it, can.
- From the Iranian vantage of this session the Let's Encrypt and ZeroSSL ACME directories loaded and `https://api.metisai.ir/` answered; Google's ACME endpoint answered 403.
- **`sslip.io` and `nip.io` are filtered** from this vantage: both failed with `connect ECONNREFUSED 10.10.34.36:443`, and ParsPack says an answer in 10.10.34.x means the name is filtered. So a certificate for such a name cannot serve reviewers here.

### How to verify that the site opens without a VPN

1. **From Iranian servers**: check-host.net has eight Iranian nodes, `ir1` to `ir8.node.check-host.net` (Tehran, Isfahan, Shiraz, Qom). `https://check-host.net/check-http?host=https://DOMAIN&node=ir1.node.check-host.net&node=ir2.node.check-host.net` runs a page check from them (read 2026-10-04). They sit in hosting networks, so they do not show what a home or mobile network filters.
2. **From other checkers**: ViewDNS "Iran Firewall Test"; OONI Probe on a phone.
3. **From real devices**: a phone on mobile data with Wi-Fi and the VPN off, and a computer on a home line, each opening the page and, for the first time, accepting nothing it is asked to accept. `nslookup DOMAIN` must not answer an address in 10.10.34.x.
4. Repeat after a day, and after a week: the link is opened days after it is sent (ADR-0017).

### Mirrors that answered from the Iranian vantage (read 2026-10-04)

- Docker registries answering `/v2/` (401 means alive; blob pulls untested): `docker.arvancloud.ir`, `docker-mirror.liara.ir`, `hub.hamdocker.ir`, `docker.abrha.net`, `docker.iranserver.com`, `focker.ir`, `registry.docker.ir`.
- Ubuntu noble: `mirror.arvancloud.ir`, `repo.abrha.net`, `repo.hmirror.ir`, `mirror.mobinhost.com`, `mirror.iranserver.com`, `ir.archive.ubuntu.com`.
- npm: `repo.hmirror.ir/npm`, `package-mirror.liara.ir/repository/npm/`.

## Could not verify

- ArvanCloud's prices, Docker support and payment (its pages answered an interstitial and a redirect loop); Iran Server, Hostiran, Asiatech, Sotoon and Runflare (prices not readable). A third-party listing shows ArvanCloud's `eco-small2` at EUR 6 in Tehran, added 2025-11-09 (https://www.whtop.com/plans/arvancloud.ir/139636): not evidence of a toman price.
- VAT for all three; setup fees for ParsPack and Hamravesh.
- Whether any of the three, or its network, can reach `divar.ir` and `api.metisai.ir` and Let's Encrypt from a rented server; outbound port limits; any statement about the national network or IP reputation. Only a rented machine settles these.
- Hamravesh's managed PostgreSQL versions and registry hostname; Liara's roles, preload libraries and a worker without a port.
- Whether Docker Hub's blobs, not only its API, answer from the owner's own network.
- Divar's tolerance of a data centre's address.

## Recommendation

Rent **ParsPack's 4 vCPU, 8 GB, 100 GB plan (2,635,000 a month)**, and try the kit first on its free 24-hour cloud-server trial. It is the cheapest of the three for the whole stack, the closest to how the repository is built (a database with its own roles and settings next to the web app and the worker, images shipped by `docker save`), and its address is its own, which the crawler's politeness and `CRAWLER_USER_AGENT` rely on. The 2 vCPU, 4 GB plan (1,550,000) is the least that works, and PostgreSQL's settings adapt to it.

**Fallback**: the same kit on any other Linux server, first Liara's Cloud Server (Uranus, 4,600,000), because nothing in it is tied to one provider; and, if no VPS is reachable from Iranian networks, Hamravesh's Darkube in its Iran datacenter, the one platform that runs images, disks and port-less workers, at about 3,670,000 for 2 vCPU, 4 GB and 80 GB, which needs its own adaptation (no Compose).

Certificates: a domain with a DNS-challenge certificate made on the owner's computer and copied to the server (`CARSHENAS_TLS_MODE=manual`), renewed every 60 days; automatic issuance by the server (`auto`) when the first deploy shows it can reach the authority.
