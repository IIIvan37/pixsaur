#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

// Forbid direct imports from Tauri plugin packages or legacy utils Tauri helpers.
const FORBIDDEN_IMPORT_PATTERN =
  /from ['"]@tauri-apps\/|from ['"]@\/utils\/is-tauri['"]|from ['"]@\/utils\/exports\/export-tauri['"]/g
const ALLOWED_DIR = 'src/tauri'

function isInAllowedDir(filePath) {
  return filePath.includes(ALLOWED_DIR)
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
    // Allow tests to mock platform plugins directly (they need to control
    // behavior). Skip files that are tests to avoid false positives.
    if (filePath.match(/(\.spec\.|\.test\.|__tests__)/)) return false

    const matches = content.match(FORBIDDEN_IMPORT_PATTERN)
    if (matches && !isInAllowedDir(filePath)) {
      console.error(`❌ Forbidden Tauri import found in: ${filePath}`)
      for (const match of matches) {
        console.error(`   ${match.trim()}`)
      }
      console.error('')
      return true
    }
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message)
  }
  return false
}

function main() {
  console.log(
    '🔍 Checking for forbidden Tauri imports (imports of @tauri-apps/* or @/utils/is-tauri)'
  )
  const files = findFiles('src')
  let hasErrors = false
  for (const file of files) {
    if (checkFile(file)) hasErrors = true
  }
  if (hasErrors) {
    console.error(
      '❌ Found forbidden Tauri imports. Import them from `@/tauri` only.'
    )
    process.exit(1)
  }
  console.log('✅ No forbidden Tauri imports found!')
}

main()
