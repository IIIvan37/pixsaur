import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { useAtomValue } from 'jotai'
import { type ReactNode, useEffect, useReducer, useRef } from 'react'
import { localeAtom } from '@/app/store/locale'

// Import dynamique des messages
async function loadMessages(locale: string) {
  const { messages } = await import(`../locales/${locale}/messages.ts`)
  return messages
}

// Initialiser avec la langue détectée du navigateur
const initI18n = async () => {
  // Détecter la langue du navigateur ou utiliser l'anglais par défaut
  const browserLang = navigator.language.split('-')[0]
  const supportedLocales = ['en', 'fr', 'es', 'de']
  const defaultLocale = supportedLocales.includes(browserLang) ? browserLang : 'en'
  
  const messages = await loadMessages(defaultLocale)
  i18n.load(defaultLocale, messages)
  i18n.activate(defaultLocale)
}

// Appeler l'initialisation une seule fois
initI18n()

export function I18nProviderWrapper({ children }: { readonly children: ReactNode }) {
  const locale = useAtomValue(localeAtom)
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0)
  const isInitialMount = useRef(true)

  useEffect(() => {
    async function load() {
      const messages = await loadMessages(locale)
      i18n.load(locale, messages)
      i18n.activate(locale)
      forceUpdate()
    }

    // Au premier mount, vérifier si la locale correspond à celle initialisée
    if (isInitialMount.current) {
      isInitialMount.current = false
      
      // Si la locale détectée diffère de celle chargée initialement, charger la bonne
      if (i18n.locale !== locale) {
        load()
      }
      return
    }

    // Pour les changements ultérieurs de locale
    load()
  }, [locale])

  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}
