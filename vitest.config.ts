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
        '**/*.css'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
}))
