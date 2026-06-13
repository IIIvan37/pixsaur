import { Trans } from '@lingui/react/macro'
import { useEffect } from 'react'
import { ErrorBoundary } from '@/components/error-boundary'
import { LanguageSelector } from '@/components/language-selector'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { Toaster } from '@/components/toaster/toaster'
import Icon from '@/components/ui/icon'
import { Updater } from '@/components/updater/updater'
import { VersionDisplay } from '@/components/version-display'
import { isDevelopment, logger } from '@/core'

import styles from '@/styles/app.module.css'
import { invoke, isTauri } from '@/tauri'
import ImageConverter from './components/image-converter/image-converter'
import { I18nProviderWrapper } from './i18n-provider'
import { useAutoRegenerateRasters } from './store/raster/use-auto-regenerate-rasters'
import { useSessionPersistence } from './store/session/use-session-persistence'
import { useUnsavedChangesWarning } from './use-unsaved-changes-warning'

/**
 * Check if running in Tauri environment
 */

// use shared util
export default function App() {
  const tauri = isTauri()
  const dev = isDevelopment()

  // Auto-regenerate rasters when selection/parameters change
  useAutoRegenerateRasters()

  // Auto-restore the previous session and auto-save changes
  useSessionPersistence()

  // Warn before leaving the page while unsaved manual edits exist
  useUnsavedChangesWarning()

  // Add F12 shortcut to open debug window
  useEffect(() => {
    if (!tauri) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F12') {
        event.preventDefault()
        invoke('open_debug_window')
          .then(() => logger.info('[APP] Debug window opened'))
          .catch((error) =>
            logger.error('[APP] Failed to open debug window:', error)
          )
      }
    }

    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [tauri])

  // Add keyboard shortcut for quitting the app (Cmd/Ctrl+Q).
  useEffect(() => {
    if (!tauri) return

    const handler = async (event: KeyboardEvent) => {
      try {
        const { isQuitShortcut } = await import('@/tauri')
        if (isQuitShortcut(event)) {
          event.preventDefault()
          const { invoke } = await import('@/tauri')
          await invoke('quit_app')
        }
      } catch (err) {
        logger.error('[APP] Failed to invoke quit_app:', err)
      }
    }

    globalThis.addEventListener('keydown', handler)
    return () => globalThis.removeEventListener('keydown', handler)
  }, [tauri])

  // No tray by default. JS/Native tray code was removed to simplify UX.

  // Listen for messages from debug window
  useEffect(() => {
    if (!tauri) return

    // Helper function to send response to debug window
    const sendDebugResponse = async (data: unknown) => {
      try {
        const { WebviewWindow } = await import('@/tauri')
        const debugWindow = await WebviewWindow.getByLabel('debug')

        if (debugWindow) {
          await debugWindow.emit('debug-response', data)
        }
      } catch (error) {
        logger.error('[APP] Failed to send debug response:', error)
      }
    }

    // Helper function to handle updater test
    const handleUpdaterTest = async (requestId: string) => {
      try {
        const result = await invoke('test_updater')
        logger.info('[APP] Updater test result:', result)
        await sendDebugResponse({
          result: JSON.parse(result as string),
          requestId
        })
      } catch (error) {
        logger.error('[APP] Updater test failed:', error)
        await sendDebugResponse({
          error: error instanceof Error ? error.message : String(error),
          requestId
        })
      }
    }

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type !== 'DEBUG_REQUEST') return

      logger.info('[APP] Received debug request:', event.data)

      if (event.data.action === 'TEST_UPDATER') {
        await handleUpdaterTest(event.data.requestId)
      }
    }

    globalThis.addEventListener('message', handleMessage)
    return () => globalThis.removeEventListener('message', handleMessage)
  }, [tauri])

  return (
    <I18nProviderWrapper>
      <ThemeProvider>
        {(dev || tauri) && <Updater />}
        <Toaster />
        <main className={styles.container}>
          <div className={styles.content}>
            <header className={styles.header}>
              <div className={styles.headerLeft}>
                <VersionDisplay />
              </div>

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
                  href='https://cpc-playground.iiivan.org'
                  target='_blank'
                  rel='noopener noreferrer'
                  className={styles.playgroundLink}
                  aria-label='CPC Playground - Emulateur en ligne'
                  title='CPC Playground'
                >
                  <img
                    src='pixsaur_logo_512.png'
                    width='20'
                    height='20'
                    alt='CPC Playground'
                  />
                </a>
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

            <ErrorBoundary>
              <ImageConverter />
            </ErrorBoundary>

            <footer className={styles.footer}></footer>
          </div>
        </main>
      </ThemeProvider>
    </I18nProviderWrapper>
  )
}
