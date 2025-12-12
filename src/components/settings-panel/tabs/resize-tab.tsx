/**
 * Resize tab - Resize mode configuration
 */

import { ResizeSettings } from '@/components/settings-panel/sections/resize-settings'
import styles from './tab.module.css'

export function ResizeTab() {
  return (
    <div className={styles.tabContent}>
      <ResizeSettings />
    </div>
  )
}
