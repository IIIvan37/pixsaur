import path from 'node:path'
import react from '@vitejs/plugin-react'
import { lingui } from '@lingui/vite-plugin'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    lingui(),
    react({
      babel: {
        presets: ['jotai/babel/preset'],
        plugins: ['macros']
      }
    })
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
