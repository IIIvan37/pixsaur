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
      updaterLogger.info('Opening GitHub releases page for manual download')
      setDownloading(true)

      if (isTauri()) {
        // Open GitHub releases page in default browser using shell plugin's open API
        const { open } = await import('@tauri-apps/plugin-shell')
        await open('https://github.com/IIIvan37/pixsaur/releases/latest')

        setDownloading(false)
        setUpdateAvailable(false) // Hide notification after opening
        setPopoverOpen(false)
        updaterLogger.info('GitHub releases page opened successfully')
      } else {
        // In web mode, just log
        updaterLogger.info('Would open GitHub releases page in production')
        setDownloading(false)
        setUpdateAvailable(false)
        setPopoverOpen(false)
      }
    } catch (error) {
      updaterLogger.error('Failed to open GitHub releases page:', error)
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
              A new version of Pixsaur is available. Please download and install
              manually from GitHub releases.
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
                  <Trans>Opening...</Trans>
                </>
              ) : (
                <>
                  <Icon name='DownloadIcon' size={16} />
                  <Trans>View Release</Trans>
                </>
              )}
            </Button>
          </div>
        </div>
      </PixsaurPopover>
    </div>
  )
}
