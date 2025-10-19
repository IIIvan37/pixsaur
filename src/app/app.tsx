import { Trans } from '@lingui/react/macro'
import { LanguageSelector } from '@/components/language-selector'
import { ThemeProvider } from '@/components/theme/theme-provider'
import styles from '@/styles/app.module.css'
import ImageConverter from './components/image-converter/image-converter'
import { I18nProviderWrapper } from './i18n-provider'

export default function App() {
  return (
    <I18nProviderWrapper>
      <ThemeProvider>
        <main className={styles.container}>
          <div className={styles.content}>
            <header className={styles.header}>
              <img
                src='pixsaur_logo_512.png'
                width='32'
                height='32'
                alt='Logo Pixsaur - Convertisseur d&apos;images Amstrad CPC'
              />

              <h1 className={styles.title}>PIXSAUR</h1>
              <p className={styles.subtitle}>
                <Trans>Convertisseur d'images Amstrad CPC</Trans>
              </p>
              <div className={styles.langSwitcher}>
                <LanguageSelector />
              </div>
            </header>

            <ImageConverter />

            <footer className={styles.footer}></footer>
          </div>
        </main>
      </ThemeProvider>
    </I18nProviderWrapper>
  )
}
