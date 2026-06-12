import path from 'node:path'
import { lingui } from '@lingui/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  plugins: [
    // Only apply lingui plugin when not in test mode
    ...(mode === 'test' ? [] : [lingui()]),
    react({
      babel: {
        presets: ['jotai/babel/preset'],
        plugins: ['macros']
      }
    })
  ],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './vitest.setup.tsx',
    // Default 5s is too aggressive under WSL parallel load: render-heavy RTL
    // specs (raster-settings) and the one-time WASM/transform cold-start
    // (export-cpc-playground) are correct but can briefly exceed 5s when the
    // CPU is saturated by the full suite. 15s gives headroom without weakening
    // any assertion — a timeout only fires on a genuine hang.
    testTimeout: 15000,
    hookTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules/',
        'src-tauri/',
        'dist/',
        '**/*.config.*',
        '**/*.setup.*',
        '**/wdyr.js',
        '**/*.d.ts',
        '**/*.css',
        '**/*.glsl',
        '**/index.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
}))
