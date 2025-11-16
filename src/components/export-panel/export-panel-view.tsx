import { Trans } from '@lingui/react/macro'
import clsx from 'clsx'
import Button from '@/components/ui/button'
import Icon from '@/components/ui/icon'
import animStyles from '@/styles/animations.module.css'
import styles from './export-panel.module.css'

export type ExportPanelViewProps = {
  readonly onExport: () => void
  readonly disabled?: boolean
}

export default function ExportPanelView({
  onExport,
  disabled
}: ExportPanelViewProps) {
  return (
    <div className={styles.exportPanel}>
      <Button
        onClick={onExport}
        disabled={disabled}
        className={clsx(animStyles.button, styles.exportButton)}
      >
        <Icon name='DownloadIcon' className={styles.buttonIcon} />
        <Trans>Exporter</Trans>
      </Button>
    </div>
  )
}
