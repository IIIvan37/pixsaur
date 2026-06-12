#!/usr/bin/env node

/**
 * Layer-import guard (see docs/refactor/ADR-001-file-layout.md).
 *
 * Enforces the layering:
 *   app/, components/  →  <feature>/application  →  domain/  →  libs/
 *   all layers → core/ ; tauri/ is the only @tauri-apps/* import site
 *   (raw Tauri imports are covered by check-tauri-imports.js)
 *
 * Known limitation (shared with the other guards): dynamic import() and
 * exotic relative escapes may not be caught; relative paths are resolved
 * best-effort against the repo root.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'

const FEATURE_DIRS = [
  'src/export',
  'src/preview',
  'src/palette',
  'src/raster',
  'src/editor'
]

// dir prefix -> forbidden import targets.
// A target starting with '@/' also matches the equivalent resolved relative
// path (e.g. '../../app/...'). Other targets are npm package names.
const RULES = [
  {
    dir: 'src/core/',
    forbidden: ['@/app', '@/components', '@/domain', '@/libs', '@/tauri']
      .concat(FEATURE_DIRS.map((d) => d.replace('src/', '@/')))
      .concat(['jotai', 'react', 'react-dom']),
    hint: 'src/core est transverse: aucune dépendance vers les autres couches'
  },
  {
    dir: 'src/libs/',
    forbidden: ['@/app', '@/components', '@/domain', '@/tauri']
      .concat(FEATURE_DIRS.map((d) => d.replace('src/', '@/')))
      .concat(['jotai', 'react', 'react-dom']),
    hint: 'src/libs est pur: pas de Jotai/React ni de couches supérieures (@/core autorisé)'
  },
  {
    dir: 'src/domain/',
    forbidden: ['@/app', '@/components', '@/tauri']
      .concat(FEATURE_DIRS.map((d) => d.replace('src/', '@/')))
      .concat(['jotai', 'react', 'react-dom']),
    hint: 'src/domain est pur: @/libs et @/core uniquement'
  },
  ...FEATURE_DIRS.map((dir) => ({
    dir: `${dir}/`,
    forbidden: ['@/app', '@/components', 'jotai', 'react', 'react-dom'],
    hint: `${dir} ne dépend pas du store ni des composants (les adapters Jotai vivent dans src/app/store)`
  }))
]

// Exceptions assumées, documentées dans l'ADR. Cette liste ne peut que
// rétrécir (ratchet) — ne rien y ajouter sans décision d'architecture.
const ALLOWED_EXCEPTIONS = [
  // Barrels thématiques: ré-exportent les composants UI du domaine
  { file: 'src/export/index.ts', target: '@/components' },
  { file: 'src/preview/index.ts', target: '@/components' }
]

const IMPORT_RE = /(?:from|import)\s+['"]([^'"]+)['"]/g

function findFiles(dir, files = []) {
  for (const item of readdirSync(dir)) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)
    if (
      stat.isDirectory() &&
      !item.startsWith('.') &&
      item !== 'node_modules' &&
      item !== 'dist'
    ) {
      findFiles(fullPath, files)
    } else if (
      stat.isFile() &&
      ['.ts', '.tsx', '.js', '.jsx'].includes(extname(item))
    ) {
      files.push(fullPath)
    }
  }
  return files
}

function matchesTarget(specifier, target, filePath) {
  if (target.startsWith('@/')) {
    if (specifier === target || specifier.startsWith(`${target}/`)) return true
    // Resolve relative escapes ('../../app/...') to a src-rooted path
    if (specifier.startsWith('.')) {
      const resolved = relative(
        process.cwd(),
        resolve(dirname(filePath), specifier)
      ).replace(/\\/g, '/')
      const srcTarget = target.replace('@/', 'src/')
      return resolved === srcTarget || resolved.startsWith(`${srcTarget}/`)
    }
    return false
  }
  return specifier === target || specifier.startsWith(`${target}/`)
}

function isException(filePath, target) {
  return ALLOWED_EXCEPTIONS.some(
    (e) => filePath.endsWith(e.file) && target === e.target
  )
}

function checkFile(filePath) {
  // Specs/tests peuvent importer librement (mocks, fakes)
  if (filePath.match(/(\.spec\.|\.test\.|__tests__)/)) return []
  const rule = RULES.find((r) => filePath.includes(r.dir))
  if (!rule) return []

  const content = readFileSync(filePath, 'utf8')
  const violations = []
  for (const match of content.matchAll(IMPORT_RE)) {
    const specifier = match[1]
    for (const target of rule.forbidden) {
      if (
        matchesTarget(specifier, target, filePath) &&
        !isException(filePath, target)
      ) {
        const line = content.slice(0, match.index).split('\n').length
        violations.push({ filePath, line, specifier, hint: rule.hint })
      }
    }
  }
  return violations
}

function main() {
  console.log('🔍 Checking layer imports (clean-archi layering rules)')
  const violations = findFiles('src').flatMap(checkFile)
  // @/test-utils est réservé aux specs (règle globale)
  for (const filePath of findFiles('src')) {
    if (filePath.match(/(\.spec\.|\.test\.|__tests__)/)) continue
    const content = readFileSync(filePath, 'utf8')
    for (const match of content.matchAll(IMPORT_RE)) {
      if (matchesTarget(match[1], '@/test-utils', filePath)) {
        const line = content.slice(0, match.index).split('\n').length
        violations.push({
          filePath,
          line,
          specifier: match[1],
          hint: '@/test-utils est réservé aux fichiers de test'
        })
      }
    }
  }

  if (violations.length > 0) {
    for (const v of violations) {
      console.error(`❌ ${v.filePath}:${v.line} importe '${v.specifier}'`)
      console.error(`   ${v.hint}`)
    }
    console.error(
      '\n❌ Violations de layering. Voir docs/refactor/ADR-001-file-layout.md'
    )
    process.exit(1)
  }
  console.log('✅ No layer-import violations found!')
}

main()
