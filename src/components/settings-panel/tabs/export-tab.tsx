/**
 * Export tab - Export options and DSK workspace management
 */

import { Trans } from '@lingui/react/macro'
import DskWorkspacePanel from '@/components/dsk-workspace/dsk-workspace-panel'
import ExportPanel from '@/components/export-panel/export-panel'
import styles from './tab.module.css'

export function ExportTab() {
  return (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Trans>Export Options</Trans>
        </h3>
        <p className={styles.description}>
          <Trans>
            Export your converted images to various formats compatible with CPC
            emulators and real hardware.
          </Trans>
        </p>

        <ExportPanel />
      </div>

      <div className={styles.separator} />

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Trans>DSK Workspace</Trans>
        </h3>
        <DskWorkspacePanel />
      </div>
    </div>
  )
}
