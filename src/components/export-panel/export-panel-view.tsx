import { Trans } from '@lingui/react/macro'
import clsx from 'clsx'
import Button from '@/components/ui/button'
import Icon from '@/components/ui/icon'
import animStyles from '@/styles/animations.module.css'
import styles from './export-panel.module.css'

export type ExportPanelViewProps = {
  readonly onExport: () => void
  readonly onOpenInPlayground: () => void
  readonly disabled?: boolean
  readonly playgroundLoading?: boolean
}

export default function ExportPanelView({
  onExport,
  onOpenInPlayground,
  disabled,
  playgroundLoading
}: ExportPanelViewProps) {
  return (
    <div className={styles.exportPanel}>
      <div className={styles.buttonGroup}>
        <Button
          onClick={onExport}
          disabled={disabled}
          className={clsx(animStyles.button, styles.exportButton)}
        >
          <Icon name='DownloadIcon' className={styles.buttonIcon} />
          <Trans>Exporter</Trans>
        </Button>

        <Button
          onClick={onOpenInPlayground}
          disabled={disabled || playgroundLoading}
          variant='secondary'
          className={clsx(animStyles.button, styles.playgroundButton)}
        >
          <Icon name='ExternalLinkIcon' className={styles.buttonIcon} />
          {playgroundLoading ? (
            <Trans>Opening...</Trans>
          ) : (
            <Trans>Open in CPC Playground</Trans>
          )}
        </Button>
      </div>
    </div>
  )
}
