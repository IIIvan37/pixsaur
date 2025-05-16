import { i18n } from '@lingui/core'
import { en, fr } from 'make-plural/plurals'

// Définir les messages directement dans le code

// Définir les pluriels pour chaque langue
i18n.loadLocaleData({
  en: { plurals: en },
  fr: { plurals: fr }
})

export { i18n }
