import MainContent from '@/app/components/main-content/main-content'
import CrtEffect from '@/components/crt-effect'
import DskWorkspacePanel from '@/components/dsk-workspace/dsk-workspace-panel'
import RasterPanel from '@/components/raster-panel/raster-panel'
import { useImageAdjustement } from '@/hooks/use-image-adjustement'
import styles from './image-converter.module.css'

export default function ImageConverter() {
  useImageAdjustement()

  return (
    <div className={styles.wrapper}>
      {<CrtEffect />}

      <div className={styles.mainContent}>
        <MainContent />

        {/* Raster Panel - above DSK workspace */}
        <RasterPanel />

        {/* DSK Workspace - outside main content */}
        <DskWorkspacePanel />
      </div>
    </div>
  )
}
