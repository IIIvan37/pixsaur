import Adjustments from '@/app/components/adjustements/adjustements'
import PreviewPanel from '@/app/components/preview-panel'

import SourceSection from '@/app/components/source-section'
import CrtEffect from '@/components/crt-effect'
import ExportPanel from '@/components/export-panel/export-panel'
import { useImageAdjustement } from '@/hooks/use-image-adjustement'
import styles from './image-converter.module.css'

export default function ImageConverter() {
  useImageAdjustement()
  return (
    <div className={styles.wrapper}>
      {<CrtEffect />}

      <div className={styles.mainContent}>
        {/* Main content area */}
        <div className={styles.section}>
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
        </div>
      </div>
    </div>
  )
}
