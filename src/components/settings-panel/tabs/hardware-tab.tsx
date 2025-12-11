/**
 * Hardware tab - CPC hardware and dimensions configuration
 */

import { HardwareSettings } from '@/components/settings-panel/sections/hardware-settings'
import styles from './tab.module.css'

export function HardwareTab() {
  return (
    <div className={styles.tabContent}>
      <HardwareSettings />
    </div>
  )
}
