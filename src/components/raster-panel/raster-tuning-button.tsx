/**
 * Floating button to open the raster tuning dialog
 */

import { useAtom } from 'jotai'
import { rasterTuningEnabledAtom } from '@/app/store/raster/raster-tuning'
import Icon from '@/components/ui/icon'
import styles from './raster-tuning-button.module.css'

export function RasterTuningButton() {
  const [_enabled, setEnabled] = useAtom(rasterTuningEnabledAtom)

  return (
    <button
      type='button'
      className={styles.button}
      onClick={() => setEnabled(true)}
      title='Open Raster Tuning'
      aria-label='Open raster tuning settings'
    >
      <Icon name='GearIcon' />
      <span className={styles.label}>Tune</span>
    </button>
  )
}
