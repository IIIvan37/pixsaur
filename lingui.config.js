import { defineConfig } from '@lingui/cli'

export default defineConfig({
  sourceLocale: 'en',
  locales: ['fr', 'en'],
  compileNamespace: 'ts',
  catalogs: [
    {
      path: './src/locales/{locale}/messages',
      include: ['src']
    }
  ]
})
