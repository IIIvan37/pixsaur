/**
 * Dithering settings component (smart component with hooks)
 */

import { useAtom, useAtomValue } from 'jotai'
import {
  autoDistinctMappingAtom,
  cpcHardwareAtom,
  effectiveModeConfigAtom,
  horizontalSmoothingAtom
} from '@/app/store/config/config'
import { rasterEnabledAtom } from '@/app/store/raster/raster'
import { DitheringSettingsView } from './dithering-settings-view'
import { usePaletteStrategyDisabled } from './palette-strategy-selector/palette-strategy-selector'

export function DitheringSettings() {
  const [horizontalSmoothing, setHorizontalSmoothing] = useAtom(
    horizontalSmoothingAtom
  )
  const [autoDistinctMapping, setAutoDistinctMapping] = useAtom(
    autoDistinctMappingAtom
  )
  const rasterEnabled = useAtomValue(rasterEnabledAtom)
  const isPaletteStrategyDisabled = usePaletteStrategyDisabled()
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)

  // Distinct mapping n'est disponible que pour CPC Classic en mode 0 (16 couleurs)
  const showDistinctMapping =
    cpcHardware === 'classic' && modeConfig.nColors === 16

  // Distinct mapping est actif quand le toggle est ON ET les conditions sont remplies
  const isDistinctMappingActive = autoDistinctMapping && showDistinctMapping

  return (
    <DitheringSettingsView
      horizontalSmoothing={horizontalSmoothing}
      onHorizontalSmoothingChange={setHorizontalSmoothing}
      autoDistinctMapping={autoDistinctMapping}
      onAutoDistinctMappingChange={setAutoDistinctMapping}
      showDistinctMapping={showDistinctMapping}
      isDistinctMappingActive={isDistinctMappingActive}
      rasterEnabled={rasterEnabled}
      isPaletteStrategyDisabled={isPaletteStrategyDisabled}
    />
  )
}
