import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        presets: ['jotai/babel/preset']
      }
    })
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
