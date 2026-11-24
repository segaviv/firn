#!/usr/bin/env bash
# Run on your own machine (bergfex blocks GitHub's IPs): collect fresh lift &
# resort reports and push data/conditions.json, which redeploys GitHub Pages.
# Only commits when the resort reports changed. SLF snow measurements alone don't
# trigger a commit, because GitHub refreshes those itself every 2 hours.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$PATH:/usr/local/bin:/usr/bin"

log() { echo "[push-conditions $(date '+%F %T')] $*"; }

git pull --rebase --autostash --quiet
node collector/collect.mjs

changed=$(node -e '
  const fs = require("fs"), { execSync } = require("child_process");
  const norm = (j) => JSON.stringify(Object.fromEntries(Object.entries(j.resorts || {}).map(([k, v]) => { const { slf, ...rest } = v; return [k, rest]; })));
  let old = "{}"; try { old = execSync("git show HEAD:data/conditions.json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch {}
  console.log(norm(JSON.parse(old)) === norm(JSON.parse(fs.readFileSync("data/conditions.json", "utf8"))) ? "no" : "yes");
')

if [ "$changed" = "no" ]; then
  log "resort reports unchanged, nothing to push"
  git checkout -- data/conditions.json
  exit 0
fi

git commit --quiet -m "Update snow & lift reports" -- data/conditions.json
git push --quiet
log "pushed fresh resort reports"
