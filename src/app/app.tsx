import { Trans } from '@lingui/react/macro'
import { GitHubLogoIcon } from '@radix-ui/react-icons'
import { LanguageSelector } from '@/components/language-selector'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { Updater } from '@/components/updater/updater'
import styles from '@/styles/app.module.css'
import ImageConverter from './components/image-converter/image-converter'
import { I18nProviderWrapper } from './i18n-provider'

/**
 * Check if running in Tauri environment
 */
function isTauri(): boolean {
  return (
    typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis
  )
}

export default function App() {
  return (
    <I18nProviderWrapper>
      <ThemeProvider>
        {isTauri() && <Updater />}
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
              <div className={styles.headerActions}>
                <a
                  href='https://github.com/IIIvan37/pixsaur'
                  target='_blank'
                  rel='noopener noreferrer'
                  className={styles.githubLink}
                  aria-label='View source code on GitHub'
                >
                  <GitHubLogoIcon width={20} height={20} />
                </a>
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
