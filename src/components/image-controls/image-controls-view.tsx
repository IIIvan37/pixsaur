import styles from './image-controls.module.css'
import { ProcessorSelector } from './processor-selector/processor-selector'

/**
 * Simplified ImageControlsView that only shows processor selection.
 * Palette strategy, dithering, hardware, dimensions, and other settings are now in the Settings panel.
 *
 * @returns The rendered image controls view component.
 */
export function ImageControlsView() {
  return (
    <div className={styles.controlsContainer}>
      {/* Options avancées */}
      <ProcessorSelector />
    </div>
  )
}
