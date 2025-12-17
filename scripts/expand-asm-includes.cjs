#!/usr/bin/env node

/**
 * Expand INCLUDE directives in RASM assembly files
 * Outputs a single file with all includes resolved
 *
 * Usage: node expand-asm-includes.js <input.asm> [output.asm]
 */

const fs = require('fs')
const path = require('path')

function expandIncludes(filePath, basePath, depth = 0, visited = new Set()) {
  const absolutePath = path.resolve(basePath, filePath)

  if (visited.has(absolutePath)) {
    return `; [CIRCULAR INCLUDE SKIPPED: ${filePath}]\n`
  }
  visited.add(absolutePath)

  if (!fs.existsSync(absolutePath)) {
    console.error(`Warning: File not found: ${absolutePath}`)
    return `; [FILE NOT FOUND: ${filePath}]\n`
  }

  const content = fs.readFileSync(absolutePath, 'utf-8')
  const lines = content.split('\n')
  const currentDir = path.dirname(absolutePath)
  const indent = '  '.repeat(depth)

  let result = []

  if (depth > 0) {
    result.push(`; ${'='.repeat(70)}`)
    result.push(`; BEGIN INCLUDE: ${filePath}`)
    result.push(`; ${'='.repeat(70)}`)
  }

  for (const line of lines) {
    // Match include directives: include 'file' or include "file"
    const includeMatch = line.match(/^\s*include\s+['"]([^'"]+)['"]/i)

    if (includeMatch) {
      const includedFile = includeMatch[1]
      result.push(`; ${line.trim()} [EXPANDED]`)
      result.push(expandIncludes(includedFile, currentDir, depth + 1, visited))
    } else {
      result.push(line)
    }
  }

  if (depth > 0) {
    result.push(`; ${'='.repeat(70)}`)
    result.push(`; END INCLUDE: ${filePath}`)
    result.push(`; ${'='.repeat(70)}`)
  }

  return result.join('\n')
}

function main() {
  const args = process.argv.slice(2)

  if (args.length < 1) {
    console.log('Usage: node expand-asm-includes.js <input.asm> [output.asm]')
    console.log('')
    console.log('Expands all INCLUDE directives in a RASM assembly file.')
    console.log('If output is not specified, writes to stdout.')
    process.exit(1)
  }

  const inputFile = args[0]
  const outputFile = args[1]

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file not found: ${inputFile}`)
    process.exit(1)
  }

  const basePath = path.dirname(path.resolve(inputFile))
  const fileName = path.basename(inputFile)

  console.error(`Expanding includes from: ${inputFile}`)

  const expanded = expandIncludes(fileName, basePath)

  if (outputFile) {
    fs.writeFileSync(outputFile, expanded)
    console.error(`Output written to: ${outputFile}`)
  } else {
    console.log(expanded)
  }
}

main()
