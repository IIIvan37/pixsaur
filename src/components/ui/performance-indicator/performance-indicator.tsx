import { useAtomValue } from 'jotai'
import { webglAvailableAtom } from '@/app/store/webgl/webgl'
import styles from './performance-indicator.module.css'

export const PerformanceIndicator = () => {
  const webglAvailable = useAtomValue(webglAvailableAtom)

  return (
    <div className={styles.indicator} title={webglAvailable ? 'Accélération GPU WebGL active' : 'Mode CPU (WebGL indisponible)'}>
      <div className={styles.dot} data-webgl={webglAvailable} />
      <span className={styles.text}>
        {webglAvailable ? 'WebGL' : '⚙️ CPU'}
      </span>
    </div>
  )
}