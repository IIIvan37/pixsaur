import { Trans } from '@lingui/react/macro'
import Adjustments from '@/app/components/adjustements/adjustements'
import PreviewPanel from '@/app/components/preview-panel'
import SourceSection from '@/app/components/source-section'
import ExportPanel from '@/components/export-panel/export-panel'
import { CollapsibleSection } from '@/components/ui/collapsible-section/collapsible-section'
import { Panel } from '@/components/ui/layout/panel/panel'
import styles from './main-content.module.css'

export default function MainContent() {
  return (
    <Panel>
      <CollapsibleSection
        title={<Trans>Adjustments, Source & Preview</Trans>}
        defaultOpen={true}
      >
        {/* Source and Preview side by side */}
        <div className={styles.flexRow}>
          <div
            className={styles.spaceY3}
            style={{ display: 'flex', flexDirection: 'column', flex: 1 }}
          >
            <Adjustments />
          </div>

          {/* Left side: Source Image and Adjustments */}
          <div className={styles.flexColumn_2}>
            <SourceSection />
          </div>

          {/* Right side: Preview and Palette */}
          <div className={styles.flexColumn_2}>
            <PreviewPanel />
          </div>
        </div>

        {/* Export section */}
        <ExportPanel />
      </CollapsibleSection>
    </Panel>
  )
}
