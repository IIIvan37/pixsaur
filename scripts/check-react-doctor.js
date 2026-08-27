#!/usr/bin/env node
/**
 * react-doctor gate (ratchet).
 *
 * react-doctor's own exit code is not reliable for CI when the hosted score API
 * is disabled (`--no-telemetry`): it stays 0 even with error-severity findings.
 * This wrapper parses its `--json` output and fails only on NEW error-severity
 * diagnostics (`--scope changed`, i.e. issues introduced vs the base ref).
 * Pre-existing errors on untouched code never block a PR; the pool only
 * ratchets down. Warnings stay advisory here — tighten later by lowering
 * BLOCKING_SEVERITY or adding a warning budget.
 *
 * Usage: node scripts/check-react-doctor.js [dir] [--staged] (dir default: src)
 *        `--staged` scans the staged files (pre-commit); without it, the scope is
 *        everything the branch changed vs its base (CI).
 * Env:   REACT_DOCTOR_BASE  base git ref for the changed scope. Defaults to the
 *        merge-base with origin/main (then main); the run is refused outright if
 *        none resolves — see resolveBase().
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const BLOCKING_SEVERITY = 'error'
const DEFAULT_BASE_BRANCH = 'main'

const argv = process.argv.slice(2)
/**
 * Pre-commit mode: scan the staged files instead of the whole branch.
 *
 * The branch scope answers "what did this branch introduce", which is the CI
 * question. A hook needs "what am I about to commit" — otherwise every commit
 * re-litigates work from twenty commits ago, and pays five seconds for it
 * instead of a tenth of one.
 */
const staged = argv.includes('--staged')
const dir = argv.find((a) => !a.startsWith('--')) || 'src'

/**
 * The git ref `--scope changed` diffs against.
 *
 * Never leave this to auto-detection. It resolved to the branch's own upstream
 * locally — an empty diff, so the gate passed without looking at anything — and
 * to nothing at all on CI's detached PR merge ref, where it silently degraded to
 * full scope and reported every pre-existing issue as newly introduced. Both
 * failures are invisible: the command exits 0, or it blames the wrong commit.
 */
function resolveBase() {
  const candidates = [
    process.env.REACT_DOCTOR_BASE,
    `origin/${DEFAULT_BASE_BRANCH}`,
    DEFAULT_BASE_BRANCH
  ].filter(Boolean)

  for (const ref of candidates) {
    const mergeBase = spawnSync('git', ['merge-base', 'HEAD', ref], {
      encoding: 'utf8'
    })
    if (mergeBase.status === 0) return mergeBase.stdout.trim()
  }

  console.error(
    `❌ react-doctor: no base ref to diff against (tried ${candidates.join(', ')}).\n` +
      '   Refusing to run: "changed" scope without a base checks nothing.'
  )
  process.exit(1)
}

const base = staged ? null : resolveBase()
const scopeLabel = staged ? 'staged files' : `changes vs ${base.slice(0, 12)}`

// `--staged` is honoured ONLY when no directory positional is given: pass one
// and react-doctor silently falls back to `mode: "full"` and reports nothing.
// Verified by staging a deliberate violation — `react-doctor src --staged`
// found 0, `react-doctor --staged` found it.
const args = staged
  ? ['--staged', '--no-telemetry', '--json', '--json-compact']
  : [
      dir,
      '--no-telemetry',
      '--json',
      '--json-compact',
      '--scope',
      'changed',
      '--base',
      base
    ]

function resolveBin() {
  // When invoked via `pnpm check:react`, node_modules/.bin is on PATH.
  // Fall back to the local bin path for direct `node scripts/...` runs.
  const local = join('node_modules', '.bin', 'react-doctor')
  return existsSync(local) ? local : 'react-doctor'
}

const result = spawnSync(resolveBin(), args, {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024
})

if (result.error) {
  console.error('❌ react-doctor could not be launched:', result.error.message)
  process.exit(1)
}

let report
try {
  report = JSON.parse(result.stdout)
} catch {
  console.error('❌ react-doctor did not emit valid JSON. Raw output:')
  console.error((result.stdout || result.stderr || '').slice(0, 2000))
  process.exit(1)
}

/**
 * Refuse a result whose scope is not the scope asked for.
 *
 * This exists because `--staged` is silently ignored when a directory
 * positional is passed: react-doctor answers with `mode: "full"` and no
 * findings, and the hook waves the commit through. So the staged run must say
 * "staged", exactly.
 *
 * The base run is only checked for NOT being a full scan. react-doctor labels a
 * scoped run "baseline" or "diff" depending on the shape of the comparison, and
 * pinning either one would reject legitimate runs — the whole point is that the
 * scan was scoped, not which word it used.
 */
const modeOk = staged ? report.mode === 'staged' : report.mode !== 'full'
if (report.mode && !modeOk) {
  console.error(
    `❌ react-doctor ran in "${report.mode}" mode` +
      (staged ? ', not "staged"' : ' — a full scan, not the requested scope') +
      '.\n   Refusing the result: the scope asked for is not the scope scanned.'
  )
  process.exit(1)
}

const diagnostics = Array.isArray(report.diagnostics) ? report.diagnostics : []
const blocking = diagnostics.filter((d) => d.severity === BLOCKING_SEVERITY)

if (blocking.length === 0) {
  const warned = report.summary?.warningCount ?? 0
  console.log(
    `✅ react-doctor: no ${BLOCKING_SEVERITY}-severity issues in ${scopeLabel}` +
      (warned ? ` (${warned} advisory warning(s) not blocking)` : '')
  )
  process.exit(0)
}

console.error(
  `❌ react-doctor: ${blocking.length} ${BLOCKING_SEVERITY}-severity issue(s) ` +
    `in ${scopeLabel}:\n`
)
for (const d of blocking) {
  const loc = d.line ? `${d.filePath}:${d.line}` : d.filePath
  console.error(`  • [${d.rule}] ${loc}\n    ${d.message}`)
}
console.error(
  '\nFix these or, if truly a false positive, suppress with evidence.'
)
process.exit(1)
