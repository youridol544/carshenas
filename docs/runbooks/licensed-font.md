# Provide the licensed typeface

The app's one typeface is **Yekan Bakh 4** (Reza Bakhtiarifard and Mahan Jafarzadeh), bought by the owner from Fontiran on 2026-09-27 (package «فونت یکان‌بخ (حرفه‌ای)», ADR-0015). The app loads one file of it, the variable web font, through `next/font/local` in `apps/web/src/components/layout/app-font.ts`. That file is **never committed**: `.gitignore` ignores every `*.ttf`, `*.otf`, `*.woff` and `*.woff2` in the repository. Without it, `next dev` and `next build` stop with a "can't resolve" error that names it; lint, typecheck and unit tests do not need it.

## What the licence allows (Fontiran's terms, read 2026-09-27)

Sources: «قوانین استفاده از فونت» and «شرایط استفاده و مسئولیت کاربر», both in the package, and <https://fontiran.com/about-licenses>.

- **No sharing.** The terms grant no right to copy, distribute or modify the files, and allow copies only as backups. The package is prepared for its buyer and identifies them, so a shared copy is traced to the owner and their account is blocked. That rules out any git remote (public or private), chat, issue attachments and any CI artifact that other people can download.
- **No modification.** The file is served exactly as delivered: no subsetting, no format conversion, no patched vertical metrics. CSS descriptors (`size-adjust` on a fallback face, line heights) change nothing in the file and are fine.
- **Web use needs a registered licence per site.** Development on the owner's own computer needs none. Before the site is reachable by anyone else, the owner registers a licence for it in their Fontiran account, under the font's row, with the site's name and address: «وبسایت یا نرم‌افزار شخصی» (400,000 tomans on 2026-09-27) for this personal demo, or «وبسایت یا نرم‌افزار شرکتی» once a company runs it. Fontiran's FAQ also says a non-commercial project can register a free licence after purchase; check the account panel.
- **The notice.** Fontiran asks for a licence comment in the CSS before the `@font-face` rule "where technically possible". `next/font` generates that rule, so the comment is left out, as the terms allow.

## Give a machine its copy

1. Sign in at fontiran.com with the owner's account and download the Yekan Bakh package again.
2. Copy only `Variable/webfonts/YekanBakh-VF.woff2` (69,304 bytes; weights 100 to 950 on one `wght` axis) to `apps/web/src/components/layout/fonts/YekanBakh-VF.woff2`.
3. Keep the downloaded package outside the repository, or delete it. Its PDFs name the buyer, and only font files are ignored by git.
4. Check: `pnpm dev`, then the page's `document.fonts` lists the family as loaded.

A new git worktree of this repository does not have the file; `./scripts/init.sh` hard-links it from the main checkout, which is the same file on the same machine, not a copy.

## Measure it

`docs/research/2026-09-26-ui-craft-details/lab/` reaches the file through the ignored `yekan-bakh` symlink: `LAB_FONTS=yekanBakh node lab-clip.js` and the other scripts in its README. The results are in `docs/design/design-language.md`.

## Continuous integration and deployment (CS-119)

- **The deployed web image holds the typeface.** `deploy/docker/web.Dockerfile` builds from the build context, where the file must be (the build stops with this runbook's name when it is missing), and Next.js serves it from `.next/static/media`: that is web use, which needs the licence registered for the domain (above). So the image is built on your computer and shipped with `docker save | ssh docker load` to your own server, never pushed to a registry that others can read (`docs/runbooks/deploy.md`). `.dockerignore` does not list the file on purpose.
- **CI**: `ci.yml` (`pnpm check`) needs no typeface. The browser workflows get it from the repository's secrets, base64 in parts of at most 48 KB (`YEKAN_BAKH_B64_1`, `_2`, `_3`), with its checksum in the variable `YEKAN_BAKH_SHA256`; `.github/actions/prepare-e2e` writes it to the ignored path, and the commands that set the secrets are in `docs/runbooks/deploy.md`, "Continuous integration". Secrets are not given to a fork's pull request.
- **Artifacts.** Playwright traces record network responses, the typeface included, and `.github/workflows/e2e.yml` uploads traces as artifacts. Anyone who can read the repository can download an artifact: keep the repository private, or do not upload traces.
