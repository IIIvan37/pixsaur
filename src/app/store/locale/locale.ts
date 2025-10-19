import { atomWithStorage } from 'jotai/utils'

export type SupportedLocale = 'en' | 'fr' | 'es' | 'de'

export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'fr', 'es', 'de']

export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  de: 'Deutsch'
}

/**
 * Détecte la langue préférée du navigateur parmi les langues supportées
 * Retourne 'en' par défaut si aucune langue supportée n'est trouvée
 */
function detectBrowserLocale(): SupportedLocale {
  const browserLang = navigator.language.split('-')[0].toLowerCase()
  
  if (SUPPORTED_LOCALES.includes(browserLang as SupportedLocale)) {
    return browserLang as SupportedLocale
  }
  
  return 'en'
}

/**
 * Atom qui stocke la locale sélectionnée dans le localStorage
 * Initialise avec la langue du navigateur si disponible, sinon 'en'
 */
export const localeAtom = atomWithStorage<SupportedLocale>(
  'pixsaur-locale',
  detectBrowserLocale()
)
