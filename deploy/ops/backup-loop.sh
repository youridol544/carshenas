#!/usr/bin/env bash
# The nightly backup (CS-119): sleeps until BACKUP_AT, Tehran time, then runs the very script a person runs by hand,
# `release.sh cut`, keeping the newest BACKUP_KEEP nightlies. A night that fails is logged and the next one tries again:
# this loop never exits on its own. Also catches up: a server whose newest nightly is older than 26 hours (first start,
# or a long stop) cuts one now, so a new deployment proves its backup works on day one.
set -u

BACKUP_AT=${BACKUP_AT:-01:30}
BACKUP_KEEP=${BACKUP_KEEP:-14}
RELEASES_DIR=${RELEASES_DIR:-/releases}
ALIVE=/tmp/backup-loop.alive

log() { printf '{"time":"%s","level":"%s","msg":"%s","service":"carshenas-backup"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2"; }

[[ $BACKUP_AT =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]] || { log fatal "BACKUP_AT must be HH:MM, Tehran time"; exit 1; }
[[ $BACKUP_KEEP =~ ^[1-9][0-9]*$ ]] || { log fatal "BACKUP_KEEP must be a whole number above zero"; exit 1; }

nightly() {
  touch "$ALIVE"
  if bash /ops/release.sh cut --kind nightly --name nightly --keep "$BACKUP_KEEP"; then
    log info "nightly backup done"
  else
    log error "nightly backup failed: see the lines above, then carshenas release cut"
  fi
  touch "$ALIVE"
}

# Seconds since the newest nightly was cut, from its name (UTC); a large number when there is none.
newest_nightly_age() {
  local newest stamp
  newest=$(find "$RELEASES_DIR" -maxdepth 1 -type d -name '[0-9]*Z-nightly' 2>/dev/null | sort | tail -n 1)
  [ -n "$newest" ] || { echo 999999999; return; }
  stamp=$(basename "$newest" | cut -c1-16)
  # 20261004T143000Z -> 2026-10-04 14:30:00 UTC
  date -u -d "${stamp:0:4}-${stamp:4:2}-${stamp:6:2} ${stamp:9:2}:${stamp:11:2}:${stamp:13:2}" +%s 2>/dev/null | { read -r then_s; echo $(($(date +%s) - then_s)); }
}

touch "$ALIVE"
if [ "$(newest_nightly_age)" -gt $((26 * 3600)) ]; then
  log info "no nightly backup in the last 26 hours: cutting one now"
  nightly
fi

while true; do
  now=$(date +%s)
  target=$(date -d "today $BACKUP_AT" +%s)
  [ "$target" -gt "$now" ] || target=$(date -d "tomorrow $BACKUP_AT" +%s)
  log info "next nightly backup at $(date -d "@$target" '+%Y-%m-%d %H:%M %Z')"
  while [ "$(date +%s)" -lt "$target" ]; do
    touch "$ALIVE"
    remaining=$((target - $(date +%s)))
    sleep $((remaining < 300 ? remaining : 300))
  done
  nightly
done
