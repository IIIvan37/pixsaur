import { Trans, useLingui } from '@lingui/react/macro'
import { check } from '@tauri-apps/plugin-updater'
import { useCallback, useEffect, useState } from 'react'
import { updaterLogger } from '@/utils/logger'
import Button from '../ui/button/button'
import Icon from '../ui/icon'
import PixsaurPopover from '../ui/popover/popover'
import styles from './updater.module.css'

/**
 * Check if running in Tauri environment
 */
function isTauri(): boolean {
  return (
    typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis
  )
}

/**
 * Auto-updater component for Tauri desktop app
 * Checks for updates on mount and allows user to install them
 */
export const Updater = () => {
  const { t } = useLingui()
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateVersion, setUpdateVersion] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)

  const checkForUpdates = useCallback(async () => {
    try {
      updaterLogger.info('Checking for updates...')

      if (isTauri()) {
        updaterLogger.info('Running in Tauri environment, calling updater API')
        const update = await check()

        if (update) {
          updaterLogger.info(`Update available: ${update.version}`)
          setUpdateAvailable(true)
          setUpdateVersion(update.version)
          setPopoverOpen(true)
        } else {
          updaterLogger.info('No updates available')
        }
      } else {
        updaterLogger.info('Running in web environment (development mode)')
        // Updates not available in web mode
      }
    } catch (_error) {
      updaterLogger.error('Failed to check for updates')
    }
  }, [])

  useEffect(() => {
    checkForUpdates()
  }, [checkForUpdates])

  const installUpdate = async () => {
    try {
      updaterLogger.info('Starting update download and installation...')
      setDownloading(true)

      if (isTauri()) {
        const update = await check()

        if (!update) {
          updaterLogger.warn('No update found during installation attempt')
          setDownloading(false)
          return
        }

        updaterLogger.info(`Downloading update ${update.version}...`)

        // Download and install with progress tracking
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              updaterLogger.info(
                `Started downloading ${event.data.contentLength} bytes`
              )
              break
            case 'Progress': {
              // Log progress every 10% to avoid spam
              const downloaded = event.data.chunkLength
              if (downloaded % 1000000 < 100000) {
                // Log roughly every MB
                updaterLogger.info(`Download progress: ${downloaded} bytes`)
              }
              break
            }
            case 'Finished':
              updaterLogger.info('Download finished, installing...')
              break
          }
        })

        updaterLogger.info('Update installed successfully')

        // Relaunch the app to apply the update
        const { relaunch } = await import('@tauri-apps/plugin-process')
        updaterLogger.info('Relaunching application...')
        await relaunch()
      } else {
        // In web mode, just log
        updaterLogger.info('Would download and install update in production')
        setDownloading(false)
        setUpdateAvailable(false)
        setPopoverOpen(false)
      }
    } catch (error) {
      updaterLogger.error('Failed to download and install update:', error)
      setDownloading(false)
      // Keep notification visible so user can try again
    }
  }

  if (!updateAvailable) {
    return null
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
              A new version of Pixsaur is available. Click below to download and
              install it automatically.
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
                  <Trans>Downloading...</Trans>
                </>
              ) : (
                <>
                  <Icon name='DownloadIcon' size={16} />
                  <Trans>Install Update</Trans>
                </>
              )}
            </Button>
          </div>
        </div>
      </PixsaurPopover>
    </div>
  )
}
