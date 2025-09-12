import { useImageProcessors } from '@/hooks/use-image-processors'
import styles from './adapter-status.module.css'

export function AdapterStatusIndicator() {
  const { isInitialized, isHardwareAccelerated } = useImageProcessors()
  
  if (!isInitialized) {
    return (
      <div className={styles.container}>
        <div className={styles.indicator}>
          <div className={`${styles.dot} ${styles.loading}`} />
          <span className={styles.text}>Initialisation...</span>
        </div>
      </div>
    )
  }
  
  return (
    <div className={styles.container}>
      <div className={styles.indicator}>
        <div className={`${styles.dot} ${isHardwareAccelerated ? styles.webgl : styles.cpu}`} />
        <span className={styles.text}>
          {isHardwareAccelerated ? (
            <>🚀 GPU WebGL</>
          ) : (
            <>🐌 CPU Software</>
          )}
        </span>
        <span className={styles.subtext}>
          {isHardwareAccelerated ? 'Rendu accéléré' : 'Rendu logiciel'}
        </span>
      </div>
    </div>
  )
}