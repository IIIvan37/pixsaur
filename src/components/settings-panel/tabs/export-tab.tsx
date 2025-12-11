/**
 * Export tab - Export options and DSK workspace management
 */

import { ExportSettings } from '@/components/settings-panel/sections/export-settings'
import styles from './tab.module.css'

export function ExportTab() {
  return (
    <div className={styles.tabContent}>
      <ExportSettings />
    </div>
  )
}
