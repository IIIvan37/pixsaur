import { DitheringSelector } from './dithering-selector/dithering-selector'
import styles from './image-controls.module.css'
import { PaletteStrategySelector } from './palette-strategy-selector/palette-strategy-selector'
import { ProcessorSelector } from './processor-selector/processor-selector'

export type ImageControlsViewProps = {
  rasterEnabled: boolean
  onRasterEnabledChange: (enabled: boolean) => void
}

/**
 * Simplified ImageControlsView that only shows palette selection,
 * dithering/raster configuration, and processor selection.
 * Hardware, dimensions, and other settings are now in the Settings panel.
 *
 * @param props - The props for the ImageControlsView component.
 * @param props.rasterEnabled - Whether raster mode is enabled.
 * @param props.onRasterEnabledChange - Callback invoked when raster mode is toggled.
 *
 * @returns The rendered image controls view component.
 */
export function ImageControlsView({
  rasterEnabled,
  onRasterEnabledChange
}: Readonly<ImageControlsViewProps>) {
  return (
    <div className={styles.controlsContainer}>
      {/* Sélection de palette */}
      <PaletteStrategySelector />

      {/* Traitement d'image */}
      <div className={styles.section}>
        <DitheringSelector
          rasterEnabled={rasterEnabled}
          onRasterEnabledChange={onRasterEnabledChange}
        />
      </div>

      {/* Options avancées */}
      <ProcessorSelector />
    </div>
  )
}
