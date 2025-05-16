'use client'
import { useLanguageStore } from '@/locales/i18n'
import styles from '../styles/language-switcher.module.css'

interface LanguageButtonProps {
  locale: string
  currentLocale: string
  setLocale: (locale: string) => void
  label: string
}

function LanguageButton({
  locale,
  currentLocale,
  setLocale,
  label
}: LanguageButtonProps) {
  const isActive = currentLocale === locale

  return (
    <button
      className={`${styles.button} ${isActive ? styles.active : ''}`}
      onClick={() => setLocale(locale)}
      aria-label={label}
      aria-pressed={isActive}
    >
      {locale.toUpperCase()}
    </button>
  )
}

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLanguageStore()

  return (
    <div className={styles.container}>
      <LanguageButton
        locale='fr'
        currentLocale={locale}
        setLocale={setLocale}
        label='Français'
      />
      <LanguageButton
        locale='en'
        currentLocale={locale}
        setLocale={setLocale}
        label='English'
      />
    </div>
  )
}
