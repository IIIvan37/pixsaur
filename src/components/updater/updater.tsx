import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'
import { useCallback, useEffect, useState } from 'react'
import Button from '../ui/button/button'
import Icon from '../ui/icon'
import PixsaurPopover from '../ui/popover/popover'
import styles from './updater.module.css'

/**
 * Auto-updater component for Tauri desktop app
 * Checks for updates on mount and allows user to install them
 */
export const Updater = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateVersion, setUpdateVersion] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)

  const checkForUpdates = useCallback(async () => {
    try {
      const update = await check()

      if (update != null) {
        setUpdateAvailable(true)
        setUpdateVersion(update.version)
        setPopoverOpen(true) // Open popover when update is found
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

      const update = await check()

      if (update != null) {
        await update.downloadAndInstall()

        // Relaunch the app to apply the update
        await relaunch()
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
            aria-label={`Update available: version ${updateVersion}`}
          >
            <Icon name='DownloadIcon' size={20} />
            <span className={styles.updateBadge}>1</span>
          </button>
        }
        side='bottom'
        align='end'
        sideOffset={12}
      >
        <div className={styles.updateContent}>
          <div className={styles.updateHeader}>
            <Icon
              name='InfoCircledIcon'
              size={20}
              className={styles.infoIcon}
            />
            <div>
              <h4 className={styles.updateTitle}>Update Available</h4>
              <p className={styles.updateVersion}>Version {updateVersion}</p>
            </div>
          </div>

          <p className={styles.updateDescription}>
            A new version of Pixsaur is available. Update now to get the latest
            features and improvements.
          </p>

          <div className={styles.updateActions}>
            <Button
              variant='secondary'
              onClick={() => setPopoverOpen(false)}
              className={styles.laterButton}
            >
              Later
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
                  Installing...
                </>
              ) : (
                <>
                  <Icon name='DownloadIcon' size={16} />
                  Update Now
                </>
              )}
            </Button>
          </div>
        </div>
      </PixsaurPopover>
    </div>
  )
}
