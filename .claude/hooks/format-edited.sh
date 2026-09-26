#!/usr/bin/env bash
# PostToolUse hook (Edit|Write|MultiEdit): format the file Claude just changed with the workspace Prettier.
# It never blocks: formatting is not a judgement call, so the agent should not spend a turn on it.
set -u
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

file=$(node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input?.file_path??"")}catch{}})')
[ -n "$file" ] && [ -f "$file" ] || exit 0
case "$file" in "$PWD"/*) ;; *) exit 0 ;; esac
case "$file" in *.ts | *.tsx | *.js | *.mjs | *.cjs | *.json | *.css | *.yml | *.yaml) ;; *) exit 0 ;; esac
[ -x node_modules/.bin/prettier ] || exit 0

# .prettierignore keeps generated, vendored and CLI-managed files out.
node_modules/.bin/prettier --write --log-level=error --ignore-unknown "$file" >/dev/null 2>&1 || true
exit 0
