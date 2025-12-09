import { Trans } from '@lingui/react/macro'
import PreviewPanel from '@/app/components/preview-panel'
import SourceSection from '@/app/components/source-section'
import { CollapsibleSection } from '@/components/ui/collapsible-section/collapsible-section'
import styles from './main-content.module.css'

export default function MainContent() {
  return (
    <CollapsibleSection
      title={<Trans>Source & Preview</Trans>}
      defaultOpen={true}
    >
      <div className={styles.content}>
        {/* Two columns side by side */}
        <div className={styles.flexRow}>
          {/* Left side: Source Image */}
          <div className={styles.flexColumnGrow}>
            <SourceSection />
          </div>

          {/* Right side: Preview and Palette */}
          <div className={styles.flexColumnGrow}>
            <PreviewPanel />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  )
}
