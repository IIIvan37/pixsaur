/**
 * Export settings view (dumb component)
 */

import { Trans } from '@lingui/react/macro'
import DskWorkspacePanel from '@/components/dsk-workspace/dsk-workspace-panel'
import ExportPanel from '@/components/export-panel/export-panel'
import styles from '../../tabs/tab.module.css'

export function ExportSettingsView() {
  return (
    <>
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
    </>
  )
}
