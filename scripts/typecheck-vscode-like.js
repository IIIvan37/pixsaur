#!/usr/bin/env node

/**
 * Script pour simuler les vérifications TypeScript de VSCode
 * Utilise les mêmes paramètres que le language server de VSCode
 */

import { execSync } from 'node:child_process'

console.log('🔍 Running VSCode-like TypeScript diagnostics...')

try {
  // Options similaires à celles utilisées par VSCode TypeScript
  const tscOptions = [
    '--noEmit',
    '--pretty',
    '--skipLibCheck', // VSCode skip les lib par défaut
    '--allowSyntheticDefaultImports',
    '--esModuleInterop',
    '--forceConsistentCasingInFileNames',
    '--moduleResolution',
    'bundler',
    '--allowImportingTsExtensions',
    '--verbatimModuleSyntax'
  ].join(' ')

  console.log('📋 Checking main project...')
  execSync(`npx tsc ${tscOptions}`, {
    stdio: 'inherit',
    encoding: 'utf8'
  })

  console.log('📋 Checking with strict mode...')
  execSync(`npx tsc ${tscOptions} --strict`, {
    stdio: 'inherit',
    encoding: 'utf8'
  })

  console.log('✅ No TypeScript diagnostics found!')
} catch (_error) {
  console.error(
    '❌ TypeScript diagnostics found - similar to VSCode Problems tab'
  )
  process.exit(1)
}

console.log(
  '\n💡 Tip: These are the same checks VSCode runs in the Problems tab'
)
