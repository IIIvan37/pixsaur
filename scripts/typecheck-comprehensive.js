#!/usr/bin/env node

/**
 * Script de vérification TypeScript avancée
 * Utilise l'API TypeScript pour détecter toutes les erreurs,
 * y compris celles que VSCode remonte dans l'onglet Problèmes
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

console.log('🔍 Running comprehensive TypeScript check...')

// tsconfig.json est un fichier « solution » (files: [] + references) : le
// passer à `tsc --project` ne vérifie rien et rapporte un faux vert.
const configs = ['tsconfig.app.json', 'tsconfig.node.json']

let hasErrors = false

for (const config of configs) {
  if (!existsSync(config)) {
    console.log(`⏭️  Skipping ${config} (not found)`)
    continue
  }

  console.log(`\n📋 Checking ${config}...`)

  try {
    // Utiliser tsc avec des options strictes
    const result = execSync(
      `npx tsc --project ${config} --noEmit --pretty --strict --noImplicitAny --noImplicitReturns --noFallthroughCasesInSwitch`,
      {
        encoding: 'utf8',
        stdio: 'pipe'
      }
    )

    if (result.trim()) {
      console.log(result)
      hasErrors = true
    } else {
      console.log(`✅ ${config} - No TypeScript errors`)
    }
  } catch (error) {
    console.error(`❌ ${config} - TypeScript errors found:`)
    console.error(error.stdout)
    hasErrors = true
  }
}

// Vérification supplémentaire avec diagnostics
console.log('\n🔬 Running diagnostic checks...')

try {
  // Vérifier les imports non utilisés et autres problèmes
  execSync(
    'npx tsc --project tsconfig.app.json --noEmit --noUnusedLocals --noUnusedParameters',
    {
      stdio: 'pipe',
      encoding: 'utf8'
    }
  )
  console.log('✅ No unused imports or parameters')
} catch (error) {
  console.warn('⚠️  Found unused imports/parameters:')
  console.warn(error.stdout)
  // Ne pas considérer cela comme une erreur bloquante
}

if (hasErrors) {
  console.error(
    '\n❌ TypeScript errors found! Please fix them before committing.'
  )
  process.exit(1)
} else {
  console.log('\n✅ All TypeScript checks passed!')
  process.exit(0)
}
