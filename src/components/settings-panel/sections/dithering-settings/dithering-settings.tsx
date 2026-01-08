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
import { sourceUniqueColorsCountAtom } from '@/app/store/preview/preview'
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
  const sourceUniqueColors = useAtomValue(sourceUniqueColorsCountAtom)

  // Distinct mapping n'est disponible que pour CPC Classic en mode 0 (16 couleurs)
  const showDistinctMapping =
    cpcHardware === 'classic' && modeConfig.nColors === 16

  // Le toggle est désactivé si l'image a plus de 16 couleurs uniques
  const isDistinctMappingDisabled =
    sourceUniqueColors === null || sourceUniqueColors > 16

  // Distinct mapping est actif quand le toggle est ON ET les conditions sont remplies
  const isDistinctMappingActive =
    autoDistinctMapping && showDistinctMapping && !isDistinctMappingDisabled

  return (
    <DitheringSettingsView
      horizontalSmoothing={horizontalSmoothing}
      onHorizontalSmoothingChange={setHorizontalSmoothing}
      autoDistinctMapping={autoDistinctMapping}
      onAutoDistinctMappingChange={setAutoDistinctMapping}
      showDistinctMapping={showDistinctMapping}
      isDistinctMappingActive={isDistinctMappingActive}
      isDistinctMappingDisabled={isDistinctMappingDisabled}
      sourceUniqueColors={sourceUniqueColors}
      rasterEnabled={rasterEnabled}
      isPaletteStrategyDisabled={isPaletteStrategyDisabled}
    />
  )
}
