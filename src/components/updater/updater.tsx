import { Trans, useLingui } from '@lingui/react/macro'
import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'
import { useCallback, useEffect, useState } from 'react'
import Button from '../ui/button/button'
import Icon from '../ui/icon'
import PixsaurPopover from '../ui/popover/popover'
import styles from './updater.module.css'

/**
 * Check if running in Tauri environment
 */
function isTauri(): boolean {
  const isTauriEnv =
    typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis
  console.log('🔍 Tauri environment check:', isTauriEnv)
  console.log('🔍 globalThis:', typeof globalThis)
  console.log(
    '🔍 __TAURI_INTERNALS__ exists:',
    globalThis && '__TAURI_INTERNALS__' in globalThis
  )
  return isTauriEnv
}

/**
 * Auto-updater component for Tauri desktop app
 * Checks for updates on mount and allows user to install them
 */
export const Updater = () => {
  console.log('🔄 [UPDATER] Updater component rendered')
  // alert('Updater component rendered!')
  const { t } = useLingui()
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateVersion, setUpdateVersion] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)

  const checkForUpdates = useCallback(async () => {
    // alert('checkForUpdates called!')
    console.log('🔄 [UPDATER] checkForUpdates called!')
    try {
      console.log('🔍 [UPDATER] Starting update check...')
      console.log('🔍 [UPDATER] Current app version: 0.1.7')
      console.log('🔍 [UPDATER] Target version: 0.1.8')
      console.log(
        '🔍 [UPDATER] Endpoint: https://github.com/IIIvan37/pixsaur/releases/download/v0.1.8/latest.json'
      )

      if (isTauri()) {
        console.log('📱 [UPDATER] Running in Tauri environment')
        console.log('📡 [UPDATER] Calling check() function...')

        const update = await check()
        console.log(
          '📦 [UPDATER] Raw update result:',
          JSON.stringify(update, null, 2)
        )

        if (update) {
          console.log('✨ [UPDATER] Update available!')
          console.log('✨ [UPDATER] Update version:', update.version)
          console.log('✨ [UPDATER] Update date:', update.date)
          console.log('✨ [UPDATER] Update body:', update.body)
          console.log(
            '✨ [UPDATER] Update available properties:',
            Object.keys(update)
          )
          setUpdateAvailable(true)
          setUpdateVersion(update.version)
          setPopoverOpen(true)
        } else {
          console.log('✅ [UPDATER] No updates available')
        }
      } else {
        console.log('🌐 [UPDATER] Running in web environment (dev mode)')
        const isDevelopment = import.meta.env.DEV
        if (isDevelopment) {
          console.log('🧪 [UPDATER] Simulating update in dev mode')
          setUpdateAvailable(true)
          setUpdateVersion('1.2.3')
          setPopoverOpen(true)
        }
      }
    } catch (error) {
      console.error('❌ [UPDATER] Failed to check for updates:', error)
      console.error('❌ [UPDATER] Error type:', typeof error)
      const err = error as Error
      console.error('❌ [UPDATER] Error message:', err.message)
      if (err.stack) {
        console.error('❌ [UPDATER] Error stack:', err.stack)
      }
    }
  }, [])

  useEffect(() => {
    // Trigger update check immediately on mount
    console.log('🔄 [UPDATER] useEffect triggered, calling checkForUpdates')
    checkForUpdates()
  }, [checkForUpdates])

  const installUpdate = async () => {
    try {
      console.log('🚀 Starting update installation...')
      setDownloading(true)
      // Hide notification immediately after user clicks
      setUpdateAvailable(false)
      setPopoverOpen(false)

      if (isTauri()) {
        console.log(
          '📱 Tauri environment detected, checking for update again...'
        )
        const update = await check()
        console.log('📦 Update object:', update)

        if (update != null) {
          console.log('⬇️ [UPDATER] Starting download and install...')
          console.log(
            '⬇️ [UPDATER] Update object methods:',
            Object.getOwnPropertyNames(Object.getPrototypeOf(update))
          )
          console.log(
            '⬇️ [UPDATER] Update object properties:',
            Object.keys(update)
          )
          await update.downloadAndInstall()
          console.log(
            '✅ [UPDATER] Download and install completed, relaunching...'
          )
          // Relaunch the app to apply the update
          await relaunch()
        } else {
          console.log('⚠️ No update available during install attempt')
          setDownloading(false)
          setUpdateAvailable(true)
          setPopoverOpen(true)
        }
      } else {
        console.log('🌐 Web environment, simulating update...')
        // In web development, simulate successful update
        console.log('🎭 Simulating update installation in development mode')
        setTimeout(() => {
          setDownloading(false)
          // Could show a success message here
        }, 2000)
      }
    } catch (error) {
      console.error('❌ [UPDATER] Failed to install update:', error)
      const err = error as Error
      console.error('❌ [UPDATER] Error message:', err.message)
      if (err.stack) {
        console.error('❌ [UPDATER] Error stack:', err.stack)
      }
      setDownloading(false)
      // Show notification again if update failed
      setUpdateAvailable(true)
      setPopoverOpen(true)
    }
  }

  if (!updateAvailable) {
    return (
      <div className={styles.updaterContainer}>
        <button
          type='button'
          onClick={checkForUpdates}
          className={styles.updateTrigger}
          style={{ background: 'red', color: 'white', padding: '10px' }}
        >
          Test Update Check
        </button>
      </div>
    )
  }

  return (
    <div className={styles.updaterContainer}>
      <PixsaurPopover
        open={popoverOpen}
        onOpenChange={setPopoverOpen}
        trigger={
          <button
            type='button'
            className={styles.updateTrigger}
            aria-label={t`Update available: version ${updateVersion}`}
          >
            <Icon name='DownloadIcon' size={20} />
            <span className={styles.updateBadge}>1</span>
          </button>
        }
        side='bottom'
        align='end'
        sideOffset={12}
        variant='unstyled'
      >
        <div className={styles.updateContent}>
          <div className={styles.updateHeader}>
            <Icon
              name='InfoCircledIcon'
              size={20}
              className={styles.infoIcon}
            />
            <div>
              <h4 className={styles.updateTitle}>
                <Trans>Update Available</Trans>
              </h4>
              <p className={styles.updateVersion}>
                <Trans>Version {updateVersion}</Trans>
              </p>
            </div>
          </div>

          <p className={styles.updateDescription}>
            <Trans>
              A new version of Pixsaur is available. Update now to get the
              latest features and improvements.
            </Trans>
          </p>

          <div className={styles.updateActions}>
            <Button
              variant='secondary'
              onClick={() => setPopoverOpen(false)}
              className={styles.laterButton}
            >
              <Trans>Later</Trans>
            </Button>
            <Button
              variant='primary'
              onClick={installUpdate}
              disabled={downloading}
            >
              {downloading ? (
                <>
                  <Icon
                    name='ReloadIcon'
                    size={16}
                    className={styles.loadingIcon}
                  />
                  <Trans>Installing...</Trans>
                </>
              ) : (
                <>
                  <Icon name='DownloadIcon' size={16} />
                  <Trans>Update Now</Trans>
                </>
              )}
            </Button>
          </div>
        </div>
      </PixsaurPopover>
    </div>
  )
}
