#!/usr/bin/env bash
# SessionStart hook: inject the current state of the board into the session context.
# Runs on startup, resume and after context compaction (see .claude/settings.json).
# Output on stdout is appended to Claude's context. Keep it short; it costs tokens every session.
set -u
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

if ! command -v backlog >/dev/null 2>&1; then
  echo "[carshenas] Backlog.md CLI is not installed. Install with: bun add -g backlog.md  (then re-run: backlog instructions overview)"
  exit 0
fi

echo "[carshenas] Board snapshot ($(date +%Y-%m-%d)). Full workflow: run \`backlog instructions overview\` before touching tasks."
echo
echo "In Progress:"
backlog task list --status "In Progress" --plain 2>/dev/null | sed '1d' | sed 's/^/  /' | head -15
echo "In Review (waiting for human verification, do not move to Done):"
backlog task list --status "In Review" --plain 2>/dev/null | sed '1d' | sed 's/^/  /' | head -15
echo "To Do (top of the queue):"
backlog task list --status "To Do" --plain 2>/dev/null | sed '1d' | sed 's/^/  /' | head -15
echo
echo "Current branch: $(git branch --show-current 2>/dev/null)"
exit 0
