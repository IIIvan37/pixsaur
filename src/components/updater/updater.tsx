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
      if (isTauri()) {
        const update = await check()

        if (update) {
          setUpdateAvailable(true)
          setUpdateVersion(update.version)
          setPopoverOpen(true) // Open popover when update is found
        }
      } else {
        // In web development, simulate an update for testing
        const isDevelopment = import.meta.env.DEV
        if (isDevelopment) {
          setUpdateAvailable(true)
          setUpdateVersion('1.2.3')
          setPopoverOpen(true)
        }
      }
    } catch (error) {
      console.error('Failed to check for updates:', error)
    }
  }, [])

  useEffect(() => {
    checkForUpdates()
  }, [checkForUpdates])

  const installUpdate = async () => {
    try {
      setDownloading(true)
      // Hide notification immediately after user clicks
      setUpdateAvailable(false)
      setPopoverOpen(false)

      if (isTauri()) {
        const update = await check()

        if (update != null) {
          await update.downloadAndInstall()

          // Relaunch the app to apply the update
          await relaunch()
        }
      } else {
        // In web development, simulate successful update
        console.log('Simulating update installation in development mode')
        setTimeout(() => {
          setDownloading(false)
          // Could show a success message here
        }, 2000)
      }
    } catch (error) {
      console.error('Failed to install update:', error)
      setDownloading(false)
      // Show notification again if update failed
      setUpdateAvailable(true)
      setPopoverOpen(true)
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
