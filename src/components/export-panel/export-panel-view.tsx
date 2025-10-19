import { Trans } from '@lingui/react/macro'
import Button from '@/components/ui/button'
import Icon from '@/components/ui/icon'
import animStyles from '@/styles/animations.module.css'
import styles from './export-panel.module.css'

export type ExportPanelViewProps = {
  readonly onExport: () => void
}

export default function ExportPanelView({ onExport }: ExportPanelViewProps) {
  return (
    <div className={styles.exportPanel}>
      <Button
        onClick={onExport}
        className={[animStyles.button, styles.exportButton].join(' ')}
      >
        <Icon name='DownloadIcon' className={styles.buttonIcon} />
        <Trans>Exporter</Trans>
      </Button>
    </div>
  )
}
