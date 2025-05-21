import styles from '@/styles/image-converter.module.css'
import CrtEffect from '../../components/crt-effect'

import SourceSection from '@/app/components/source-section'
import PreviewPanel from '@/app/components/preview-panel'

import Adjustments from '@/app/components/adjustements/adjustements'
import { useImageAdjustement } from '@/hooks/use-image-adjustement'
import { useAtom } from 'jotai'
import { srcAtom } from '../store/image/image'
import ExportPanel from '@/components/export-panel/export-panel'

export default function ImageConverter() {
  const [src] = useAtom(srcAtom)
  useImageAdjustement()
  return (
    <div className={styles.wrapper}>
      {<CrtEffect />}

      <div className={styles.mainContent}>
        {/* Main content area */}
        <div className={styles.section}>
          {/* Source and Preview side by side */}
          <div className={styles.flexRow}>
            <div className={styles.spaceY3} style={{ flex: 1 }}>
              <Adjustments />
            </div>

            {/* Left side: Source Image and Adjustments */}
            <div className={styles.flexColumn_2}>
              <SourceSection
                canvasWidth={400}
                canvasHeight={Math.floor(
                  (400 * (src?.height || 0)) / (src?.width || 0)
                )}
              />
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
