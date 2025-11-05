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
        <div className={styles.content}>
          {/* Three columns side by side */}
          <div className={styles.flexRow}>
            <div className={styles.flexColumn}>
              <Adjustments />
            </div>

            {/* Left side: Source Image and Adjustments */}
            <div className={styles.flexColumnGrow}>
              <SourceSection />
            </div>

            {/* Right side: Preview and Palette */}
            <div className={styles.flexColumnGrow}>
              <PreviewPanel />
            </div>
          </div>

          {/* Export section - always below */}
          <ExportPanel />
        </div>
      </CollapsibleSection>
    </Panel>
  )
}
