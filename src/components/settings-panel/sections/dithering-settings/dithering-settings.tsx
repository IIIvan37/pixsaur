/**
 * Dithering settings component (smart component with hooks)
 */

import { useAtom, useAtomValue } from 'jotai'
import { horizontalSmoothingAtom } from '@/app/store/config/config'
import { rasterEnabledAtom } from '@/app/store/raster/raster'
import { usePaletteStrategyDisabled } from '@/components/image-controls/palette-strategy-selector/palette-strategy-selector'
import { DitheringSettingsView } from './dithering-settings-view'

export function DitheringSettings() {
  const [horizontalSmoothing, setHorizontalSmoothing] = useAtom(
    horizontalSmoothingAtom
  )
  const rasterEnabled = useAtomValue(rasterEnabledAtom)
  const isPaletteStrategyDisabled = usePaletteStrategyDisabled()

  return (
    <DitheringSettingsView
      horizontalSmoothing={horizontalSmoothing}
      onHorizontalSmoothingChange={setHorizontalSmoothing}
      rasterEnabled={rasterEnabled}
      isPaletteStrategyDisabled={isPaletteStrategyDisabled}
    />
  )
}
