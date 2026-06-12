import MainContent from '@/app/components/main-content/main-content'
import CrtEffect from '@/components/crt-effect'
import styles from './image-converter.module.css'
import { useImageAdjustement } from './use-image-adjustement'
import { useRasterAutoClear } from './use-raster-auto-clear'

export default function ImageConverter() {
  useImageAdjustement()
  useRasterAutoClear()

  return (
    <div className={styles.wrapper}>
      {<CrtEffect />}

      <div className={styles.mainContent}>
        <MainContent />
      </div>
    </div>
  )
}
