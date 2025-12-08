import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'
import {
  cpcHardwareAtom,
  effectiveModeConfigAtom
} from '@/app/store/config/config'
import { displayPaletteAtom } from '@/app/store/preview/preview'
import {
  addRasterChangeAtom,
  clearRasterChangesAtom,
  rasterChangesAtom,
  rasterConflictsAtom,
  rasterEnabledAtom,
  rasterMaxChangesPerLineAtom,
  removeRasterChangeAtom,
  updateRasterChangeAtom
} from '@/app/store/raster/raster'
import { useAutoRegenerateRasters } from '@/app/store/raster/use-auto-regenerate-rasters'
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
  const enabled = useAtomValue(rasterEnabledAtom)
  const maxChangesPerLineRaw = useAtomValue(rasterMaxChangesPerLineAtom)
  const changes = useAtomValue(rasterChangesAtom)
  const conflicts = useAtomValue(rasterConflictsAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const displayPalette = useAtomValue(displayPaletteAtom)

  // Limit maxChangesPerLine according to hardware capabilities
  // Classic: max 2 inks per line, Plus: max 4 inks per line
  const hardwareLimit = cpcHardware === 'classic' ? 2 : 4
  const maxChangesPerLine = Math.min(maxChangesPerLineRaw, hardwareLimit)

  const addChange = useSetAtom(addRasterChangeAtom)
  const updateChange = useSetAtom(updateRasterChangeAtom)
  const removeChange = useSetAtom(removeRasterChangeAtom)
  const clearAllChanges = useSetAtom(clearRasterChangesAtom)

  // Auto-regenerate rasters when parameters change (if already generated)
  useAutoRegenerateRasters()

  const previousHardwareRef = useRef(cpcHardware)
  const previousModeRef = useRef(modeConfig.nColors)

  // Max line is height - 1 (0-indexed)
  const maxLine = modeConfig.height - 1
  const isClassicMode = cpcHardware === 'classic'
  // CPC Plus allows smooth color transitions, Classic uses 27-color palette
  const isPlusMode = cpcHardware === 'plus'

  // Watch for hardware (classic/plus) or mode (0/1/2) changes and clear rasters
  // User will need to regenerate manually after changing hardware/mode
  useEffect(() => {
    const hardwareChanged = previousHardwareRef.current !== cpcHardware
    const modeChanged = previousModeRef.current !== modeConfig.nColors

    // Update refs
    previousHardwareRef.current = cpcHardware
    previousModeRef.current = modeConfig.nColors

    // Skip if nothing changed or raster not enabled
    if ((!hardwareChanged && !modeChanged) || !enabled) {
      return
    }

    // Clear all raster changes and index buffer when hardware or mode changes
    clearAllChanges()
  }, [cpcHardware, modeConfig.nColors, enabled, clearAllChanges])

  // Extract colors from display palette slots
  const palette: Vector[] = displayPalette.map(
    (slot) => slot.color || ([0, 0, 0] as Vector)
  )

  const handleAddChange = () => {
    // Find the last change (by creation order) to determine where to add the new one
    const lastChange = changes[changes.length - 1]

    // Allow multiple ink changes per line up to maxChangesPerLine
    // Check if we can add another ink on the same line
    if (lastChange) {
      const changesOnLastLine = changes.filter(
        (c) => c.line === lastChange.line
      )
      const usedInks = new Set(changesOnLastLine.map((c) => c.inkIndex))

      // If less than maxChangesPerLine inks used on this line, add another ink on same line
      if (changesOnLastLine.length < maxChangesPerLine) {
        // Find next available ink
        const availableInks = Array.from(
          { length: modeConfig.nColors },
          (_, i) => i
        )
        const nextInk = availableInks.find((ink) => !usedInks.has(ink)) ?? 0
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
    // If changing inkIndex, validate we don't exceed maxChangesPerLine
    if (field === 'inkIndex') {
      const change = changes.find((c) => c.id === id)
      if (!change) return

      const newInkIndex = value as number

      // If not actually changing the ink, allow it
      if (newInkIndex === change.inkIndex) {
        updateChange({ id, inkIndex: value as number })
        return
      }

      // Get all inks used on this line (excluding current change)
      const otherChangesOnLine = changes.filter(
        (c) => c.line === change.line && c.id !== id
      )
      const usedInks = new Set(otherChangesOnLine.map((c) => c.inkIndex))

      // If the new ink is already used by another change, allow it (replacing same ink)
      if (usedInks.has(newInkIndex)) {
        updateChange({ id, inkIndex: value as number })
        return
      }

      // Check if adding this new ink would exceed the limit
      // We need to count: other inks + this new ink
      if (usedInks.size + 1 > maxChangesPerLine) {
        // Would exceed limit - don't allow the change
        return
      }
    }

    updateChange({ id, [field]: value })
  }

  const handleRemoveChange = (id: string) => {
    removeChange(id)
  }

  return (
    <RasterPanelView
      changes={changes}
      conflicts={conflicts}
      maxLine={maxLine}
      palette={palette}
      nColors={modeConfig.nColors}
      maxChangesPerLine={maxChangesPerLine}
      cpcPalette={cpcFullPalette}
      isClassicMode={isClassicMode}
      isPlusMode={isPlusMode}
      onAddChange={handleAddChange}
      onUpdateChange={handleUpdateChange}
      onRemoveChange={handleRemoveChange}
      onClearAll={clearAllChanges}
    />
  )
}

export default RasterPanel
