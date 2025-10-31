import { Trans } from '@lingui/react/macro'
import { LanguageSelector } from '@/components/language-selector'
import { ThemeProvider } from '@/components/theme/theme-provider'
import Icon from '@/components/ui/icon'
import { Updater } from '@/components/updater/updater'
import styles from '@/styles/app.module.css'
import { isDevelopment } from '@/utils/is-development'
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
  const tauri = isTauri()
  const dev = isDevelopment()
  console.log('[APP] isTauri:', tauri, 'isDevelopment:', dev)
  // alert(`isTauri: ${tauri}, isDevelopment: ${dev}`)
  return (
    <I18nProviderWrapper>
      <ThemeProvider>
        {(dev || tauri) && <Updater />}
        <main className={styles.container}>
          <div className={styles.content}>
            <header className={styles.header}>
              <img
                src='pixsaur_logo_512.png'
                width='32'
                height='32'
                alt="Logo Pixsaur - Convertisseur d'images Amstrad CPC"
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
                  <Icon name='GitHubLogoIcon' size={20} />
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
