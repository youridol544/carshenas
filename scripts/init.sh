#!/usr/bin/env bash
# Bring a fresh clone, worktree or agent session to a known-good state:
#   tools present -> dependencies installed -> browser installed -> .env and PostgreSQL (when Docker runs) ->
#   checks green -> the app actually boots.
# Usage: ./scripts/init.sh            verify and exit
#        ./scripts/init.sh --serve    verify, then keep the dev server running in the foreground on port 3000
set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '\n[init] %s\n' "$*"; }
fail() { printf '\n[init] FAILED: %s\n' "$*" >&2; exit 1; }
expect_rtl() { # $1 = URL; the document must be the Farsi, right-to-left app
  local html
  html=$(curl -fsS "$1") || fail "the app did not answer at $1."
  case "$html" in *'dir="rtl"'*) return 0 ;; esac
  fail "the app answered at $1 but the document is not right-to-left."
}

command -v node >/dev/null || fail "Node.js is not installed (need >= 22)."
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' || fail "Node $(node --version) is too old (need >= 22)."
command -v pnpm >/dev/null || fail "pnpm is not installed (corepack enable, or npm i -g pnpm@10)."
command -v backlog >/dev/null || echo "[init] note: the Backlog.md CLI is missing (bun add -g backlog.md); the board will not load."

say "Installing dependencies (frozen lockfile)"
pnpm install --frozen-lockfile

say "Installing the pinned Playwright browser (no-op when present)"
pnpm browsers

# Local settings (database passwords, connection strings) live in .env, which is gitignored; example.env is the
# template. An existing .env is never overwritten.
if [ ! -f .env ]; then
  say "Creating .env from example.env"
  cp example.env .env
fi

# The licensed typeface is never committed (ADR-0015). A new worktree hard-links the main checkout's copy (the
# same file on the same machine, not a copy); anywhere else, docs/runbooks/licensed-font.md says how to get it.
font=apps/web/src/components/layout/fonts/YekanBakh-VF.woff2
if [ ! -f "$font" ]; then
  main_checkout=$(git worktree list --porcelain | awk 'NR == 1 { print $2 }')
  if [ -n "$main_checkout" ] && [ "$main_checkout" != "$PWD" ] && [ -f "$main_checkout/$font" ]; then
    say "Linking the licensed typeface from the main checkout"
    mkdir -p "$(dirname "$font")"
    ln "$main_checkout/$font" "$font" 2>/dev/null || cp "$main_checkout/$font" "$font"
  else
    fail "the licensed typeface is missing ($font). It is never committed; docs/runbooks/licensed-font.md says how to provide it."
  fi
fi

if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
  say "Starting PostgreSQL and applying migrations (docs/runbooks/local-database.md)"
  pnpm db:up
  pnpm db:migrate
else
  echo "[init] note: Docker is not running, so PostgreSQL was not started; pages that read the database and pnpm db:* need it (docs/runbooks/local-database.md)."
fi

say "Lint, migration lint, typecheck, unit and schema tests, formatting"
pnpm check

# Next.js allows one dev server per app directory and records it in .next/dev/lock.
# A second `next dev` prints "Another next dev server is already running" and exits 1,
# so a live server is reused instead of started. A stale lock (dead pid) is cleaned up by Next itself.
lock=apps/web/.next/dev/lock
if [ -f "$lock" ]; then
  read -r running_pid running_port < <(node -e '
    const l = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    console.log(l.pid, l.port)' "$lock")
  if kill -0 "$running_pid" 2>/dev/null; then
    expect_rtl "http://127.0.0.1:$running_port/"
    say "OK: reusing the dev server already running on http://127.0.0.1:$running_port/ (pid $running_pid); it answers with a right-to-left document."
    exit 0
  fi
fi

if [ "${1:-}" = "--serve" ]; then
  # Where the docs point: port 3000, or the next free one when it is taken (Next.js prints the URL it chose).
  say "Serving the app in the foreground on port 3000, or the next free one; Next.js prints the URL (Ctrl+C stops it)"
  exec pnpm --filter @carshenas/web exec next dev
fi

say "Booting the app on a free port"
port=$(node -e 'const s=require("node:net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')
log=$(mktemp)
# Own process group, so cleanup takes the whole tree (pnpm -> node -> next-server), not just the wrapper.
setsid pnpm --filter @carshenas/web exec next dev --port "$port" >"$log" 2>&1 &
server=$!
trap 'kill -TERM -- "-$server" 2>/dev/null || true; rm -f "$log"' EXIT
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$port/" 2>/dev/null; then
    expect_rtl "http://127.0.0.1:$port/"
    say "OK: the app answers on http://127.0.0.1:$port/ with a right-to-left document."
    exit 0
  fi
  if ! kill -0 "$server" 2>/dev/null; then
    cat "$log" >&2
    fail "the dev server exited before answering (its output is above)."
  fi
  sleep 1
done
cat "$log" >&2
fail "the dev server did not answer within 60 s."
