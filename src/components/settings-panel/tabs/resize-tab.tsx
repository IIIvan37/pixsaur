/**
 * Resize tab - Resize mode configuration
 */

import { Trans } from '@lingui/react/macro'
import styles from './tab.module.css'

export function ResizeTab() {
  return (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Trans>Resize Mode</Trans>
        </h3>
        <p className={styles.description}>
          <Trans>
            This tab will contain resize mode selection (pixel mode, horizontal
            smoothing, etc.)
          </Trans>
        </p>
      </div>
    </div>
  )
}
