#!/usr/bin/env bash
# Quality gate, one compact verdict.
#
# Runs the blocking checks and the two ratcheted detectors, and prints ONE line
# per check instead of their full output — the raw logs go to files under
# .gate/ for whoever needs to read them. `--filter <pattern>` narrows the
# ratcheted findings to the paths the change touched, which is the only part
# that matters: knip and jscpd carry a large pre-existing baseline.
#
# Usage: scripts/gate.sh [--filter <path-pattern>] [--skip-tests]
set -uo pipefail

cd "$(dirname "$0")/.."
LOGS=.gate
mkdir -p "$LOGS"

FILTER=""
SKIP_TESTS=0
while [ $# -gt 0 ]; do
  case "$1" in
    --filter) FILTER="$2"; shift 2 ;;
    --skip-tests) SKIP_TESTS=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

FAILED=0

# Runs a command quietly and prints one line: name, verdict, log path.
run() {
  local name="$1" log="$LOGS/$2"; shift 2
  if "$@" > "$log" 2>&1; then
    printf '%-14s OK\n' "$name"
  else
    printf '%-14s FAIL  (%s)\n' "$name" "$log"
    FAILED=1
  fi
}

run typecheck typecheck.log node scripts/typecheck-comprehensive.js
run guards guards.log pnpm check

if [ "$SKIP_TESTS" -eq 0 ]; then
  run tests tests.log pnpm test -- --run
  # The counts are the only part of a 229-file run worth reading. Vitest
  # colours its output, so the escape codes come off before matching.
  sed -e 's/\x1b\[[0-9;]*m//g' "$LOGS/tests.log" \
    | grep -E '^ *(Test Files|Tests) ' | sed 's/^ */  /' || true
fi

# Ratcheted: a non-zero exit is the baseline, not a failure. What counts is
# whether the change added a finding.
pnpm check:dead > "$LOGS/knip.log" 2>&1
pnpm check:dup > "$LOGS/jscpd.log" 2>&1
printf '%-14s %s\n' knip "$(grep -cE '^[A-Za-z].*src/' "$LOGS/knip.log") findings (baseline, see $LOGS/knip.log)"
printf '%-14s %s\n' jscpd "$(grep -oE 'Found [0-9]+ clones' "$LOGS/jscpd.log" | tail -1) (baseline, see $LOGS/jscpd.log)"

if [ -n "$FILTER" ]; then
  echo
  echo "New findings matching '$FILTER':"
  grep -i -- "$FILTER" "$LOGS/knip.log" | sed 's/^/  knip  /' || true
  grep -i -- "$FILTER" "$LOGS/jscpd.log" | sed 's/^/  jscpd /' || true
  echo "  (nothing listed above = nothing added by this change)"
fi

echo
[ "$FAILED" -eq 0 ] && echo "Blocking checks: GREEN" || echo "Blocking checks: RED"
echo "Stryker is NOT run here — run 'pnpm test:mutation' only when the change"
echo "touched src/domain/cpc/** or src/libs/pixsaur-color/src/{histogram,space,utils,metric}/**."
exit "$FAILED"
