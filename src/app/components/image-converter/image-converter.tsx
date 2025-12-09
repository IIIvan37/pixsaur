import MainContent from '@/app/components/main-content/main-content'
import CrtEffect from '@/components/crt-effect'
import { useImageAdjustement } from '@/hooks/use-image-adjustement'
import { useRasterAutoClear } from '@/hooks/use-raster-auto-clear'
import styles from './image-converter.module.css'

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
