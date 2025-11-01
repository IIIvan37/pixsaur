import { Trans } from '@lingui/react/macro'
import { invoke } from '@tauri-apps/api/core'
import { useEffect } from 'react'
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

  // Add F12 shortcut to open debug window
  useEffect(() => {
    if (!tauri) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F12') {
        event.preventDefault()
        invoke('open_debug_window')
          .then(() => console.log('[APP] Debug window opened'))
          .catch((error) =>
            console.error('[APP] Failed to open debug window:', error)
          )
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [tauri])

  // Listen for messages from debug window
  useEffect(() => {
    if (!tauri) return

    const handleMessage = async (event: MessageEvent) => {
      if (event.data && event.data.type === 'DEBUG_REQUEST') {
        console.log('[APP] Received debug request:', event.data)

        if (event.data.action === 'TEST_UPDATER') {
          try {
            const result = await invoke('test_updater')
            console.log('[APP] Updater test result:', result)

            // Send response back to debug window
            const { WebviewWindow } = await import(
              '@tauri-apps/api/webviewWindow'
            )
            const debugWindow = await WebviewWindow.getByLabel('debug')

            if (debugWindow) {
              await debugWindow.emit('debug-response', {
                result: JSON.parse(result as string),
                requestId: event.data.requestId
              })
            }
          } catch (error) {
            console.error('[APP] Updater test failed:', error)

            // Send error response back to debug window
            try {
              const { WebviewWindow } = await import(
                '@tauri-apps/api/webviewWindow'
              )
              const debugWindow = await WebviewWindow.getByLabel('debug')

              if (debugWindow) {
                await debugWindow.emit('debug-response', {
                  error: error instanceof Error ? error.message : String(error),
                  requestId: event.data.requestId
                })
              }
            } catch (emitError) {
              console.error('[APP] Failed to send error response:', emitError)
            }
          }
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [tauri])

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
