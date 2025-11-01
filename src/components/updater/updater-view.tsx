import { Trans, useLingui } from '@lingui/react/macro'
import Button from '../ui/button/button'
import Icon from '../ui/icon'
import PixsaurPopover from '../ui/popover/popover'
import styles from './updater.module.css'

export interface UpdaterViewProps {
  updateVersion: string
  downloading: boolean
  downloadProgress: number
  popoverOpen: boolean
  error: string | null
  onPopoverOpenChange: (open: boolean) => void
  onInstallUpdate: () => void
}

/**
 * Updater View (Presentational Component)
 * Displays the update notification UI without business logic
 */
export const UpdaterView = ({
  updateVersion,
  downloading,
  downloadProgress,
  popoverOpen,
  error,
  onPopoverOpenChange,
  onInstallUpdate
}: UpdaterViewProps) => {
  const { t } = useLingui()

  return (
    <div className={styles.updaterContainer}>
      <PixsaurPopover
        open={popoverOpen}
        onOpenChange={onPopoverOpenChange}
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
                <Trans>Version</Trans> {updateVersion}
              </p>
            </div>
          </div>

          <p className={styles.updateDescription}>
            <Trans>
              A new version of Pixsaur is available. Click below to download and
              install it automatically.
            </Trans>
          </p>

          {error && (
            <div className={styles.errorMessage}>
              <Icon name='Cross2Icon' size={16} className={styles.errorIcon} />
              <span>{error}</span>
            </div>
          )}

          {downloading && downloadProgress > 0 && (
            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <span className={styles.progressText}>{downloadProgress}%</span>
            </div>
          )}

          <div className={styles.updateActions}>
            <Button
              variant='secondary'
              onClick={() => onPopoverOpenChange(false)}
              className={styles.laterButton}
              disabled={downloading}
            >
              <Trans>Later</Trans>
            </Button>
            <Button
              variant='primary'
              onClick={onInstallUpdate}
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
