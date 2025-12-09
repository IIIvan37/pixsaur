/**
 * Hardware tab - CPC hardware and dimensions configuration
 */

import { Trans } from '@lingui/react/macro'
import styles from './tab.module.css'

export function HardwareTab() {
  return (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Trans>CPC Hardware</Trans>
        </h3>
        <p className={styles.description}>
          <Trans>
            This tab will contain CPC hardware selection (Classic/Plus),
            dimension preset, and custom dimensions configuration
          </Trans>
        </p>
      </div>
    </div>
  )
}
