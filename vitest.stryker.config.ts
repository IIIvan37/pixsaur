import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Dedicated Vitest config for Stryker mutation runs. Stryker's dry-run executes
// the WHOLE suite, which would pull in WASM/GPU specs (e.g. export-sna imports
// @/libs/rasm-wasm). We scope `include` to the pure specs that cover the mutated
// core (pixsaur-color + domain/cpc), keeping the run fast and free of native deps.
export default defineConfig({
  test: {
    globals: true,
    // happy-dom (not node): some pixsaur-color specs use browser globals like
    // ImageData. Matches the main vitest config's environment.
    environment: 'happy-dom',
    // Reuse the main setup: it polyfills ImageData (happy-dom lacks it) and
    // stubs Lingui so the run stays in parity with `pnpm test`.
    setupFiles: './vitest.setup.tsx',
    include: [
      'src/libs/pixsaur-color/**/*.spec.ts',
      'src/domain/cpc/**/*.spec.ts',
      'src/preview/application/**/*.spec.ts'
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
