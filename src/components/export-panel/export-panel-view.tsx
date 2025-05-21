import Button from '../ui/button'
import styles from './export-panel.module.css'
import animStyles from '@/styles/animations.module.css'
import Icon from '@/components/ui/icon'
export type ExportPanelViewProps = {
  onExport: () => void
}

export default function ExportPanelView({ onExport }: ExportPanelViewProps) {
  return (
    <div className={styles.exportPanel}>
      <Button
        onClick={onExport}
        className={[animStyles.button, styles.exportButton].join(' ')}
      >
        <Icon name='DownloadIcon' className={styles.buttonIcon} />
        Exporter
      </Button>
    </div>
  )
}
