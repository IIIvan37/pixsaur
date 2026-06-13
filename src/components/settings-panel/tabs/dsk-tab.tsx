/**
 * Disque (DSK) tab - manage the persistent DSK disk-image workspace.
 *
 * The one-shot export action lives in the top action bar (the ExportPanel
 * buttons); this tab is for building and managing a multi-file disk image.
 */

import { Trans } from '@lingui/react/macro'
import DskWorkspacePanel from '@/components/dsk-workspace/dsk-workspace-panel'
import styles from './tab.module.css'

export function DskTab() {
  return (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Trans>DSK Workspace</Trans>
        </h3>
        <p className={styles.description}>
          <Trans>
            Assemblez une image disque DSK multi-fichiers compatible avec les
            émulateurs et le matériel CPC réel.
          </Trans>
        </p>
        <DskWorkspacePanel />
      </div>
    </div>
  )
}
