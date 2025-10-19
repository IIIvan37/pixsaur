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

// Initialiser avec la langue par défaut au démarrage
const initI18n = async () => {
  const defaultLocale = 'en'
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
    // Ne pas recharger au premier mount (déjà fait dans initI18n)
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    async function load() {
      const messages = await loadMessages(locale)
      i18n.load(locale, messages)
      i18n.activate(locale)
      // Force un re-render sans démonter les composants
      forceUpdate()
    }
    load()
  }, [locale])

  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}
