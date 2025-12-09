/**
 * Dithering tab - Dithering algorithm and settings
 */

import { Trans } from '@lingui/react/macro'
import styles from './tab.module.css'

export function DitheringTab() {
  return (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Trans>Dithering</Trans>
        </h3>
        <p className={styles.description}>
          <Trans>
            This tab will contain dithering algorithm selection and dithering
            intensity configuration
          </Trans>
        </p>
      </div>
    </div>
  )
}
