#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')

const FORBIDDEN_MAP = [
  {
    pattern: /from ['"]@\/utils\/image-resize['"]/g,
    replacement: "from '@/source'"
  },
  {
    pattern: /from ['"]@\/utils\/get-visual-region['"]/g,
    replacement: "from '@/preview'"
  },
  {
    pattern: /from ['"]@\/utils\/image-processing\/horizontal-smoothing['"]/g,
    replacement: "from '@/preview'"
  },
  {
    pattern: /from ['"]@\/utils\/validate-custom-dimensions['"]/g,
    replacement: "from '@/source'"
  },
  // Replace any imports from `@/utils/exports/...` with `@/export` (root re-exports)
  {
    pattern: /from\s*['"]@\/utils\/exports\/[\w\-/]+['"]/g,
    replacement: "from '@/export'"
  },
  {
    pattern: /from ['"]@\/utils\/cpc-calculations['"]/g,
    replacement: "from '@/export'"
  },
  {
    pattern: /from ['"]@\/utils\/amsdos-filename['"]/g,
    replacement: "from '@/export'"
  }
]

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

const includeTests = process.argv.includes('--include-tests')

function shouldSkip(file) {
  const rel = path.relative(ROOT, file)
  if (rel.includes('src/utils')) return true
  if (rel.includes('src/export')) return true
  if (rel.includes('src/preview')) return true
  if (rel.includes('src/source')) return true
  if (
    !includeTests &&
    (rel.includes('.spec.') ||
      rel.includes('.test.') ||
      rel.includes('__tests__/'))
  )
    return true
  return !/\.(ts|tsx|js|jsx)$/.test(file)
}

function main() {
  const files = walk(SRC)
  let changed = 0
  for (const file of files) {
    if (shouldSkip(file)) continue
    const content = fs.readFileSync(file, 'utf8')
    let modified = content
    for (const { pattern, replacement } of FORBIDDEN_MAP) {
      modified = modified.replace(pattern, replacement)
    }
    if (modified !== content) {
      fs.writeFileSync(file, modified, 'utf8')
      console.log('Updated', path.relative(ROOT, file))
      changed++
    }
  }
  console.log(`Done. ${changed} files updated.`)
}

main()
