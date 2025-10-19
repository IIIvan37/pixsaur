import { useAtom } from 'jotai'
import type { SupportedLocale } from '@/app/store/locale'
import { LOCALE_NAMES, localeAtom, SUPPORTED_LOCALES } from '@/app/store/locale'
import { Select, SelectItem } from '@/components/ui/select'
import styles from './language-selector.module.css'

export function LanguageSelector() {
  const [locale, setLocale] = useAtom(localeAtom)

  const handleLocaleChange = (newLocale: string) => {
    setLocale(newLocale as SupportedLocale)
    // Le changement de locale sera automatiquement géré par l'I18nProviderWrapper
  }

  return (
    <div className={styles.languageSelector}>
      <Select value={locale} onValueChange={handleLocaleChange}>
        {SUPPORTED_LOCALES.map((lang) => (
          <SelectItem key={lang} value={lang}>
            {LOCALE_NAMES[lang]}
          </SelectItem>
        ))}
      </Select>
    </div>
  )
}
