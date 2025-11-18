#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

// Forbid direct imports from certain utils that now have thematic re-exports.
const FORBIDDEN_IMPORT_PATTERN =
  /from ['"]@\/utils\/(image-resize|get-visual-region|image-processing\/horizontal-smoothing|validate-custom-dimensions|exports\/|cpc-calculations|amsdos-filename)['"]/g
const ALLOWED_DIRS = ['src/utils', 'src/export', 'src/preview', 'src/source'] // files under these folders are allowed

function isInAllowedDir(filePath) {
  return ALLOWED_DIRS.some((d) => filePath.includes(d))
}

function findFiles(dir, files = []) {
  const items = readdirSync(dir)
  for (const item of items) {
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
      (extname(item) === '.ts' ||
        extname(item) === '.tsx' ||
        extname(item) === '.js' ||
        extname(item) === '.jsx')
    ) {
      files.push(fullPath)
    }
  }
  return files
}

function checkFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8')
    // Allow tests to import utils directly (they can mock). Skip test files.
    if (filePath.match(/(\.spec\.|\.test\.|__tests__)/)) return false

    if (isInAllowedDir(filePath)) return false

    const matches = content.match(FORBIDDEN_IMPORT_PATTERN)
    if (matches) {
      console.error(`❌ Forbidden utils import found in: ${filePath}`)
      for (const match of matches) {
        console.error(`   ${match.trim()}`)
      }
      console.error('\n')
      return true
    }
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message)
  }
  return false
}

function main() {
  console.log(
    '🔍 Checking for forbidden utils imports (non-domain utils recommended to use thematic re-exports)'
  )
  const files = findFiles('src')
  let hasErrors = false
  for (const file of files) {
    if (checkFile(file)) hasErrors = true
  }
  if (hasErrors) {
    console.error(
      '❌ Found forbidden utils imports. Use thematic entrypoints (`@/source`, `@/preview`, `@/export`) where available.'
    )
    process.exit(1)
  }
  console.log('✅ No forbidden utils imports found!')
}

main()
