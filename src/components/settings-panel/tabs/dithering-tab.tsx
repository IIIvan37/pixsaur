/**
 * Dithering tab - Dithering algorithm and settings
 */

import { DitheringSettings } from '@/components/settings-panel/sections/dithering-settings'
import styles from './tab.module.css'

export function DitheringTab() {
  return (
    <div className={styles.tabContent}>
      <DitheringSettings />
    </div>
  )
}
