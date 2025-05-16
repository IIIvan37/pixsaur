import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { lingui } from '@lingui/vite-plugin'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['@lingui/babel-plugin-lingui-macro']
      }
    }),
    lingui()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
