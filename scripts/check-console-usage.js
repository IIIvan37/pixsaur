#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')

const IGNORE_PATTERNS = [
  /\.spec\./i,
  /\.test\./i,
  /__tests__\//,
  /\/tests\//,
  /src\/utils\/logger\.ts$/,
  /src\/utils\/validate-custom-dimensions\.ts$/,
  /\/coverage\//
]

const FILE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  let files = []
  for (const entry of entries) {
    const res = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files = files.concat(walk(res))
    } else {
      files.push(res)
    }
  }
  return files
}

function isIgnored(filePath) {
  for (const rx of IGNORE_PATTERNS) {
    if (rx.test(filePath)) return true
  }
  return false
}

function main() {
  const files = walk(SRC).filter((f) => FILE_EXTS.includes(path.extname(f)))
  const offenders = []

  const consoleRegex = /\bconsole\.(log|warn|error|debug|info)\s*\(/g

  for (const file of files) {
    const rel = path.relative(ROOT, file)
    if (isIgnored(rel)) continue

    let content = fs.readFileSync(file, 'utf-8')

    // Remove comments before searching for console.* to allow examples in doc blocks
    // Remove block comments
    content = content.replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove any leftover lines like '*   console.log(...)' which may remain after docblock pruning
    content = content.replace(/^\s*\*\s*console\.[^\n]*$/gm, '')
    // Remove single-line comments
    content = content.replace(/\/\/.*$/gm, '')

    if (consoleRegex.test(content)) {
      offenders.push(rel)
    }
  }

  if (offenders.length > 0) {
    console.error('\nFound console.* usages in non-test files:')
    for (const f of offenders) console.error('  -', f)
    console.error(
      '\nPlease replace these with the centralized logger (src/utils/logger.ts) or add an allow-list entry in scripts/check-console-usage.js'
    )
    process.exit(1)
  }

  console.log('No console.* usages found in src (excluding tests/logger).')
}

// No --fix mode by default; keep scanning-only behavior.

main()
