# Recording day: the checklist and the recovery plan

Everything to check before the owner presses record, and what to do when something fails. The recording and the submission are CS-75; this is its preparation (CS-120). CS-121 walks the same path once on real data before the day.

Commands run from the main checkout. `pnpm db:psql` is a read-only session; the two scripts below only read.

## The order of the day

| When | What |
|---|---|
| A week before | the deployment is up (`TODO-01`), the licence for the typeface is registered for it (`docs/runbooks/licensed-font.md`), the test accounts are gone, the crawl has run for a day or more |
| The day before | the rehearsal (`pnpm e2e:demo`), the numbers re-run (`numbers.md`), the examples picked (`shot-list.md`) |
| Two hours before | the checklist below, top to bottom |
| Recording | one take per scene, in order, the data decision never skipped |
| After | watch it once, check the size, upload, open the uploaded link from a clean browser, submit, record the date on CS-75 |

## Before you record

### The data

- [ ] `pnpm worker:health` prints `"status":"ok"` and the Divar lane is `running`.
- [ ] `pnpm db:psql < docs/submission/clean-check.sql`:
  - block 0: the source is `enabled`, no cool-down, no stop reason, today's budget spent well under 12,000, the last request a few minutes ago;
  - block 1: `processes_alive` is 1 and `starts_in_the_last_10_minutes` is 0 or 1 (on 2026-10-04 at 13:33 it was 85: a process started every seven seconds beside the one that stayed alive; find out why before recording);
  - block 2: no failed jobs.
- [ ] `/status` says «آگهی‌ها پیوسته از منبع تازه می‌شوند», the source badge reads «به‌روز», the last read is under 15 minutes old, and the hourly chart has no hole in the last 48 hours.
- [ ] The crawl has run for at least 24 hours without a stop, so that «رفته از بازار», price drops and price history have something to show: block 4 of `pick-examples.sql` returns rows.
- [ ] Today's valuation run is done: `pick-examples.sql` block 0 shows today's Tehran date as `valuation_day`. If the 04:00 job was missed: `pnpm valuation:run` (about a minute, sends no request), then wait a minute for the search table to refresh.
- [ ] The search table is full: `pnpm db:psql -c "select count(*) from search_document"` is over 3,000, and `pnpm db:psql -c "select count(*), min(marked_at) from search_document_stale"` is near zero.
- [ ] A frozen release exists, as the fallback (`TODO-12`).

### The database is clean

- [ ] `clean-check.sql` block 3 lists only the owner's own accounts. On 2026-10-04 main held 228 test accounts beside the owner's own: 170 `e2e_…` buyers, 13 `e2e_superadmin_…` superadmins, 16 `files_…`, 8 `alerts_…`, 11 `mmmm…_…` and 10 named `ali_`, `kian_`, `sara_` or `neda_`, left by the browser tests that run against the dev server.
- [ ] Block 4 is zero, or a number you can explain. Notifications, marks and search files of the test accounts go with them (their rows are `ON DELETE CASCADE`).

The deletions are the owner's to run, by hand (the database guard hook refuses commands that destroy data, and rightly). Candidates, to read before running, in a transaction, with `rollback` if a count surprises you:

```sql
begin;
-- buyers made by tests and lanes; their sessions, marks, notifications and search files go with them
delete from account
 where role = 'buyer'
   and username ~ '^(e2e|files|alerts|ali|kian|sara|neda)_[0-9a-z]+$|^m{5,}_[0-9a-z]+$';
-- links pasted in rehearsals that the crawler has not read
delete from wanted_link;
select role, count(*) from account group by 1;   -- buyers: only the ones you meant to keep
commit;
```

The 13 test superadmins cannot be deleted while a change log (`tracked_model_change`, `model_spec_change`, `job_state_change` and the others) names them: those keys are `ON DELETE RESTRICT` and the logs are append-only. Leave them in the database you record on, and **never restore accounts into a deployed copy**: cut the data release without the `account` table and the tables that hang from it (`open-items.md`, F4).

### Accounts

- [ ] Only if a scene needs one: a buyer account made for the recording, through `/sign-up`. The password lives in a password manager, never in the repository, and the account is deleted after.
- [ ] A superadmin is needed only for the optional «20 spare seconds» (`demo-script.md`). `pnpm account:superadmin <name>` shows its password once. Do not show the section's account list or any name in it on screen.

### The site and the page

- [ ] The recording runs against a production build or the deployment, not `pnpm dev`: the dev server compiles a page on its first visit (3 seconds on 2026-10-04) and draws a Next.js badge in the corner. `pnpm build && pnpm start` on a quiet machine, or the deployed site.
- [ ] The deployment is unlisted: `curl -sI https://<site>/` answers with `X-Robots-Tag: noindex` (or the page has `<meta name="robots" content="noindex">`), `curl -s https://<site>/robots.txt` says `Disallow: /`, the admin section is not linked from a public page, and the certificate is valid.
- [ ] The site opens from an Iranian network without a VPN (a phone on mobile data is enough).
- [ ] The typeface loads: in the console, `[...document.fonts].map((f) => f.family + ' ' + f.status)` lists a family as `loaded` (`docs/runbooks/licensed-font.md`), and the text is plainly not the system fallback.

### The browser and the screen

- [ ] A fresh Chrome profile: no extensions, no bookmarks bar, no autofill, notifications off, no other tabs. Site data for the site cleared, so the first visit looks like a reviewer's.
- [ ] A 16:9 window, at least 1280 × 720 of page (the rehearsal uses 1440 × 810), 100 % zoom. Export ten seconds and read them at half size: if the text is hard to read, raise the zoom.
- [ ] Language and clock: the system language does not matter to the page (it is Farsi), the system clock is on Tehran time.
- [ ] No other program is making noise: `uptime` shows a load under 2, no builds, no browser suites, no lane's dev server. The machine was overloaded on 2026-10-04.
- [ ] If the stack runs locally: the VPN client is off. It claims the Docker subnet and resets the connection to the database (`docker compose down`, never `-v`, then `pnpm db:up` picks a free subnet).
- [ ] The terminal for scene 6: font 18 pt or larger, a clean prompt, `clear`, no secret in the scrollback.
- [ ] Sound: the microphone tested, no keyboard noise, a quiet room. Do a ten-second take and listen to it.
- [ ] Notifications of the operating system off (do not disturb).

### The rehearsal and the numbers

- [ ] `pnpm e2e:demo` (the walk of `e2e/tests/demo/demo-walk.spec.ts`, against `DEMO_BASE_URL`, `http://127.0.0.1:3000` by default) ends with every scene `ok`. Open `e2e/demo-shots/<time>/walk-report.md` and the screenshots; a failed scene names the listing to replace. Real photos from Divar load only with `DEMO_REAL_PHOTOS=1`: set it for the final rehearsal on your own machine, never for a test run on a machine that must not reach Divar.
- [ ] `numbers.md` rows N01 to N11 and N14 re-run, and the `[[…]]` figures of the script written down. `TODO-04` and `TODO-11` done or knowingly left.
- [ ] The README's links work (`TODO-01`, `TODO-02`), and the repository checks of `open-items.md` («Before the repository is public») are done.

## Recording

- One take per scene, in the script's order. A false start costs one scene.
- Record the screen and the voice together, in segments. If the voice-over is added later, keep the screen take at the script's timing.
- At the start of each take, the page is loaded and still; start talking after a breath.
- Slow pointer, no frantic scrolling, one thing at a time on screen.
- After scene 5, look at the clock: if the video is already past 3:05, use the cut list of `demo-script.md`.
- Never skip the data decision, the missed freshness target, or the sentence that says what is not yet measured.

## After recording

- [ ] Watch the whole video once at normal speed: no personal data (a name, a phone number, an address), no dev badge, no unrelated tab, no secret, the audio clear, the length **at most 5:00**.
- [ ] Export H.264 MP4, 1080p, 30 fps, about 3.5 Mbps video and 128 kbps audio: five minutes is about 135 MB, under the form's **200 MB** limit. Check: `ls -lh video.mp4` and `ffprobe -v error -show_entries format=duration -of csv=p=0 video.mp4`.
- [ ] Upload to the form, or to Aparat and put the link in the notes (`TODO-03`). **Never YouTube**: it is filtered in Iran. Keep a copy on two disks.
- [ ] Open the uploaded link in a browser that is not signed in, and play it to the end.
- [ ] Submit the form with the video, the repository link, the contact details and the notes (`notes.md`). Record the submission date on CS-75.

## Recovery plan

| What goes wrong | How you notice | What to do |
|---|---|---|
| Divar blocks the crawler (a 403, a challenge, or a second 429 in a day) | `/status` shows «فعلاً خوانده نمی‌شود»; `clean-check.sql` block 0 shows `stopped_on_block` | **Do not resume to record**: ADR-0008 says stop on any block, and resuming is a human decision after reading the evidence (`docs/runbooks/worker.md`, «Act on a source or a job»). The pages keep each listing's last data with its date (ADR-0017 point 9), so scenes 1 to 4 work for as long as search holds listings, which is 48 hours after the last good read until `TODO-06` (CS-116) moves the window. Then: (a) record within 40 hours of the last good read; (b) restore the frozen release into a scratch database and run the app on it; (c) record scenes 2 to 4 and 6 to 8, and make scene 5 the degraded state on purpose: the page says the source is not being updated and gives the date of its latest data, which is the honest answer to «what if it blocks» |
| The worker is down | `pnpm worker:health` exits 1; block 1 shows no process alive | `pnpm worker`. The demo path needs the worker only for re-checks and for reading a new pasted ad; search, listing and status pages are the web app and the database, so scenes 1 to 3 and 5 still work, with ageing figures |
| The worker restarts every few seconds | block 1: many `starts_in_the_last_10_minutes` | Another worker process holds the health port (3101) or the key is missing: find the process by port, `ss -ltnpH 'sport = :3101'`, never `pkill -f`; stop the extra supervisor loop. Do not record until one process stays alive |
| The database is down | the site shows its error pages with a reference code | `pnpm db:up`. If its volume is gone, restore the frozen release (`TODO-10`) |
| Search is empty or thin | `select count(*) from search_document` is far under 3,000 | `pnpm search:rebuild`. If it stays small, the 48-hour window has passed over a paused crawl: see the first row |
| Today's valuation is missing | `pick-examples.sql` block 0: `valuation_day` is yesterday | `pnpm valuation:run`, then wait a minute |
| A listing chosen for a scene is gone or changed | the rehearsal reports the scene `failed` and names it; or a card looks different live | the alternates in `shot-list.md`; run `pick-examples.sql` again |
| A rating looks wrong on camera | you are about to explain it away | do not: pick another listing, and put the case in CS-121's findings |
| The Metis balance is empty or the key is missing | the worker will not start without a key; a paid step answers with code only | Nothing on the demo path calls a model: sentences are read by code (`SEARCH_UNDERSTANDING_AI` is off), explanations are templates, extraction is unscheduled. Start the worker with any non-empty `METIS_API_KEY`. If you switched a model on for the recording, its daily cap is US$1 (`docs/runbooks/ai-layer.md`) |
| The deployed site is down | the form's reviewers could not open it | record against the local stack and say nothing about the address; keep the deployment fixed before submitting (`TODO-01`), because a reviewer opens it days later |
| The video runs over five minutes | the clock after scene 5 | the cut list of `demo-script.md`, in order |
| A take is spoiled | you know | record that scene again; the scenes are independent |
| The file is over 200 MB | `ls -lh` | export again at 2.5 Mbps, or upload to Aparat and put the link in the notes |
| The upload fails | the form's error, or a stuck bar | try the other route (form against Aparat), from the other network; keep both copies |
| The machine freezes | everything lags | close every program and every lane, check `uptime`, record at a quieter hour |
