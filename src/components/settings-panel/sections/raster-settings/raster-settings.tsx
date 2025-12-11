/**
 * Raster settings (smart component)
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useState } from 'react'
import {
  cpcHardwareAtom,
  effectiveModeConfigAtom
} from '@/app/store/config/config'
import { imageAtom } from '@/app/store/image/image'
import { displayPaletteAtom } from '@/app/store/preview/preview'
import {
  addRasterChangeAtom,
  autoOptimizeRasterAtom,
  clearRasterChangesAtom,
  hasGeneratedRastersAtom,
  rasterChangesAtom,
  rasterConflictsAtom,
  rasterEnabledAtom,
  removeRasterChangeAtom,
  updateRasterChangeAtom
} from '@/app/store/raster/raster'
import {
  rasterDitheringIntensityAtom,
  rasterMaxChangesPerLineAtom
} from '@/app/store/raster/raster-config'
import {
  horizontalErrorCoefficientAtom,
  paletteContinuityBonusAtom,
  paletteContinuityDistanceAtom,
  paletteFrequencyExponentAtom,
  verticalErrorCoefficientAtom
} from '@/app/store/raster/raster-tuning'
import { useRasterTuningRegeneration } from '@/app/store/raster/use-raster-tuning-regeneration'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import { cpcFullPalette } from '@/palettes/cpc-palette'
import { RasterSettingsView } from './raster-settings-view'

export function RasterSettings() {
  // Raster mode
  const [rasterEnabled, setRasterEnabled] = useAtom(rasterEnabledAtom)

  // Raster parameters
  const [maxChangesPerLine, setMaxChangesPerLine] = useAtom(
    rasterMaxChangesPerLineAtom
  )
  const modeConfig = useAtomValue(effectiveModeConfigAtom)
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const hardwareLimit = cpcHardware === 'classic' ? 2 : 4
  const [rasterDitheringIntensity, setRasterDitheringIntensity] = useAtom(
    rasterDitheringIntensityAtom
  )

  // Auto optimize
  const image = useAtomValue(imageAtom)
  const hasImage = Boolean(image)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const hasGeneratedRasters = useAtomValue(hasGeneratedRastersAtom)
  const triggerAutoOptimize = useSetAtom(autoOptimizeRasterAtom)

  // Error propagation
  const [verticalErrorCoef, setVerticalErrorCoef] = useAtom(
    verticalErrorCoefficientAtom
  )
  const [horizontalErrorCoef, setHorizontalErrorCoef] = useAtom(
    horizontalErrorCoefficientAtom
  )

  // Palette selection
  const [paletteContinuityDistance, setPaletteContinuityDistance] = useAtom(
    paletteContinuityDistanceAtom
  )
  const [paletteContinuityBonus, setPaletteContinuityBonus] = useAtom(
    paletteContinuityBonusAtom
  )
  const [paletteFrequencyExponent, setPaletteFrequencyExponent] = useAtom(
    paletteFrequencyExponentAtom
  )

  // Raster panel
  const changes = useAtomValue(rasterChangesAtom)
  const conflicts = useAtomValue(rasterConflictsAtom)
  const maxLine = modeConfig.height - 1
  const displayPalette = useAtomValue(displayPaletteAtom)
  const palette: Vector[] = displayPalette.map(
    (slot) => slot.color || ([0, 0, 0] as Vector)
  )
  const nColors = modeConfig.nColors
  const cpcPalette = cpcFullPalette
  const isClassicMode = cpcHardware === 'classic'
  const isPlusMode = cpcHardware === 'plus'

  const addChange = useSetAtom(addRasterChangeAtom)
  const updateChange = useSetAtom(updateRasterChangeAtom)
  const removeChange = useSetAtom(removeRasterChangeAtom)
  const clearAll = useSetAtom(clearRasterChangesAtom)

  // Auto-regeneration on tuning changes
  useRasterTuningRegeneration()

  const handleAutoOptimize = useCallback(async () => {
    setIsOptimizing(true)
    try {
      await triggerAutoOptimize({ resetChanges: true })
    } finally {
      setIsOptimizing(false)
    }
  }, [triggerAutoOptimize])

  const handleAddChange = useCallback(() => {
    const defaultLine =
      changes.length > 0
        ? Math.min(changes[changes.length - 1].line + 1, maxLine)
        : 0
    const defaultInkIndex = 0
    const defaultColor =
      palette[defaultInkIndex] || ([0, 0, 0] as Vector<'RGB'>)

    addChange({
      line: defaultLine,
      inkIndex: defaultInkIndex,
      color: defaultColor
    })
  }, [addChange, changes, maxLine, palette])

  const handleUpdateChange = useCallback(
    (
      id: string,
      field: keyof Omit<RasterChange, 'id'>,
      value: number | Vector<'RGB'>
    ) => {
      updateChange({ id, [field]: value })
    },
    [updateChange]
  )

  const handleRemoveChange = useCallback(
    (id: string) => {
      removeChange(id)
    },
    [removeChange]
  )

  const handleClearAll = useCallback(() => {
    clearAll()
  }, [clearAll])

  return (
    <RasterSettingsView
      rasterEnabled={rasterEnabled}
      onRasterEnabledChange={setRasterEnabled}
      maxChangesPerLine={maxChangesPerLine}
      onMaxChangesPerLineChange={setMaxChangesPerLine}
      hardwareLimit={hardwareLimit}
      rasterDitheringIntensity={rasterDitheringIntensity}
      onRasterDitheringIntensityChange={setRasterDitheringIntensity}
      hasImage={hasImage}
      isOptimizing={isOptimizing}
      hasGeneratedRasters={hasGeneratedRasters}
      onAutoOptimize={handleAutoOptimize}
      verticalErrorCoef={verticalErrorCoef}
      onVerticalErrorCoefChange={setVerticalErrorCoef}
      horizontalErrorCoef={horizontalErrorCoef}
      onHorizontalErrorCoefChange={setHorizontalErrorCoef}
      paletteContinuityDistance={paletteContinuityDistance}
      onPaletteContinuityDistanceChange={setPaletteContinuityDistance}
      paletteContinuityBonus={paletteContinuityBonus}
      onPaletteContinuityBonusChange={setPaletteContinuityBonus}
      paletteFrequencyExponent={paletteFrequencyExponent}
      onPaletteFrequencyExponentChange={setPaletteFrequencyExponent}
      changes={changes}
      conflicts={conflicts}
      maxLine={maxLine}
      palette={palette}
      nColors={nColors}
      cpcPalette={cpcPalette}
      isClassicMode={isClassicMode}
      isPlusMode={isPlusMode}
      onAddChange={handleAddChange}
      onUpdateChange={handleUpdateChange}
      onRemoveChange={handleRemoveChange}
      onClearAll={handleClearAll}
    />
  )
}
