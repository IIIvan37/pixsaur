import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useRef, useState } from 'react'
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
  rasterChangesAtom,
  rasterConflictsAtom,
  rasterDitheringIntensityAtom,
  rasterEnabledAtom,
  removeRasterChangeAtom,
  updateRasterChangeAtom
} from '@/app/store/raster/raster'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import { cpcFullPalette } from '@/palettes/cpc-palette'
import { RasterPanelView } from './raster-panel-view'

/**
 * RasterPanel container component.
 *
 * Connects Jotai atoms to the presentational RasterPanelView.
 * Manages raster change state and provides handlers for UI interactions.
 */
export function RasterPanel() {
  const [enabled, setEnabled] = useAtom(rasterEnabledAtom)
  const ditheringIntensity = useAtomValue(rasterDitheringIntensityAtom)
  const changes = useAtomValue(rasterChangesAtom)
  const conflicts = useAtomValue(rasterConflictsAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const displayPalette = useAtomValue(displayPaletteAtom)
  const image = useAtomValue(imageAtom)

  const addChange = useSetAtom(addRasterChangeAtom)
  const updateChange = useSetAtom(updateRasterChangeAtom)
  const removeChange = useSetAtom(removeRasterChangeAtom)
  const clearAllChanges = useSetAtom(clearRasterChangesAtom)
  const autoOptimize = useSetAtom(autoOptimizeRasterAtom)

  const [isOptimizing, setIsOptimizing] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousIntensityRef = useRef(ditheringIntensity)

  // Max line is height - 1 (0-indexed)
  const maxLine = modeConfig.height - 1
  const isClassicMode = cpcHardware === 'classic'
  const hasImage = image !== null
  // CPC Plus Mode 1 allows 4 ink changes per line (Mode 1 = 4 colors)
  const isPlusMode1 = cpcHardware === 'plus' && modeConfig.nColors === 4

  // Debounced auto-optimize when dithering intensity changes
  // Uses resetChanges: true to clear existing raster lines and regenerate from scratch
  const runDebouncedOptimize = useCallback(async () => {
    if (!enabled || !isPlusMode1 || !hasImage) return
    setIsOptimizing(true)
    try {
      await autoOptimize({ resetChanges: true })
    } finally {
      setIsOptimizing(false)
    }
  }, [enabled, isPlusMode1, hasImage, autoOptimize])

  // Watch for dithering intensity changes and trigger debounced optimization
  useEffect(() => {
    // Skip if intensity hasn't actually changed or raster not enabled
    if (
      previousIntensityRef.current === ditheringIntensity ||
      !enabled ||
      !isPlusMode1
    ) {
      previousIntensityRef.current = ditheringIntensity
      return
    }

    previousIntensityRef.current = ditheringIntensity

    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Debounce the optimization (300ms)
    debounceRef.current = setTimeout(() => {
      runDebouncedOptimize()
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [ditheringIntensity, enabled, isPlusMode1, runDebouncedOptimize])

  // Extract colors from display palette slots
  const palette: Vector[] = displayPalette.map(
    (slot) => slot.color || ([0, 0, 0] as Vector)
  )

  const handleAddChange = () => {
    // Find the last change (by creation order) to determine where to add the new one
    const lastChange = changes[changes.length - 1]

    // For CPC Plus Mode 1 only, we can have up to 4 ink changes per line
    // Check if we can add another ink on the same line
    if (isPlusMode1 && lastChange) {
      const changesOnLastLine = changes.filter(
        (c) => c.line === lastChange.line
      )
      const usedInks = new Set(changesOnLastLine.map((c) => c.inkIndex))

      // If less than 4 inks used on this line, add another ink on same line
      if (changesOnLastLine.length < 4) {
        // Find next available ink (0-3 for Mode 1)
        const nextInk = [0, 1, 2, 3].find((ink) => !usedInks.has(ink)) ?? 0
        const defaultColor = palette[nextInk] || [0, 0, 0]

        addChange({
          line: lastChange.line,
          inkIndex: nextInk,
          color: defaultColor as Vector<'RGB'>
        })
        return
      }
    }

    // Default behavior: new line
    const defaultLine = lastChange ? Math.min(lastChange.line + 1, maxLine) : 0
    const defaultInkIndex = 0
    const defaultColor = palette[defaultInkIndex] || [0, 0, 0]

    addChange({
      line: defaultLine,
      inkIndex: defaultInkIndex,
      color: defaultColor as Vector<'RGB'>
    })
  }

  const handleUpdateChange = (
    id: string,
    field: keyof Omit<RasterChange, 'id'>,
    value: number | Vector<'RGB'>
  ) => {
    updateChange({ id, [field]: value })
  }

  const handleRemoveChange = (id: string) => {
    removeChange(id)
  }

  const handleAutoOptimize = async () => {
    setIsOptimizing(true)
    try {
      await autoOptimize()
    } finally {
      setIsOptimizing(false)
    }
  }

  return (
    <RasterPanelView
      disabled={!hasImage}
      enabled={enabled}
      onEnabledChange={setEnabled}
      changes={changes}
      conflicts={conflicts}
      maxLine={maxLine}
      palette={palette}
      nColors={modeConfig.nColors}
      cpcPalette={cpcFullPalette}
      isClassicMode={isClassicMode}
      isPlusMode1={isPlusMode1}
      isOptimizing={isOptimizing}
      onAddChange={handleAddChange}
      onUpdateChange={handleUpdateChange}
      onRemoveChange={handleRemoveChange}
      onClearAll={clearAllChanges}
      onAutoOptimize={handleAutoOptimize}
    />
  )
}

export default RasterPanel
