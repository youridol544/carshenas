#!/usr/bin/env bash
# Refresh the agent skills that ship inside playwright-core (version-matched to the workspace catalog)
# into the repo-level .claude/skills/. Run after every Playwright upgrade: pnpm skills:sync
# Generated files: do not hand-edit them; project specifics live in .claude/skills/verify-ui.
set -euo pipefail
cd "$(dirname "$0")/../.."
./node_modules/.bin/playwright init-skills --loop=claude
# Component testing needs a component-testing setup for the app, which does not exist yet; until then the skill is dead weight.
rm -rf .claude/skills/playwright-component-testing
echo "Synced: $(ls -d .claude/skills/playwright-* | tr '\n' ' ')"
