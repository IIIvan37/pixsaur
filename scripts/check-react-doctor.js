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
 * Usage: node scripts/check-react-doctor.js [dir] (default: src)
 * Env:   REACT_DOCTOR_BASE  optional base git ref for the changed scope.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const BLOCKING_SEVERITY = 'error'
const dir = process.argv[2] || 'src'

const args = [
  dir,
  '--no-telemetry',
  '--json',
  '--json-compact',
  '--scope',
  'changed'
]
if (process.env.REACT_DOCTOR_BASE) {
  args.push('--base', process.env.REACT_DOCTOR_BASE)
}

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

const diagnostics = Array.isArray(report.diagnostics) ? report.diagnostics : []
const blocking = diagnostics.filter((d) => d.severity === BLOCKING_SEVERITY)

if (blocking.length === 0) {
  const warned = report.summary?.warningCount ?? 0
  console.log(
    `✅ react-doctor: no new ${BLOCKING_SEVERITY}-severity issues in changed scope` +
      (warned ? ` (${warned} advisory warning(s) not blocking)` : '')
  )
  process.exit(0)
}

console.error(
  `❌ react-doctor: ${blocking.length} new ${BLOCKING_SEVERITY}-severity issue(s) introduced:\n`
)
for (const d of blocking) {
  const loc = d.line ? `${d.filePath}:${d.line}` : d.filePath
  console.error(`  • [${d.rule}] ${loc}\n    ${d.message}`)
}
console.error(
  '\nFix these or, if truly a false positive, suppress with evidence.'
)
process.exit(1)
