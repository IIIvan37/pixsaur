/**
 * Raster tab - Raster mode management
 */

import { RasterSettings } from '@/components/settings-panel/sections/raster-settings'
import styles from './tab.module.css'

export function RasterTab() {
  return (
    <div className={styles.tabContent}>
      <RasterSettings />
    </div>
  )
}
