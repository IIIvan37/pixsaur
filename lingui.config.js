import { defineConfig } from '@lingui/cli'

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'fr', 'es', 'de'],
  compileNamespace: 'ts',
  catalogs: [
    {
      path: './src/locales/{locale}/messages',
      include: ['src']
    }
  ]
})
