import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  cpcHardwareAtom,
  effectiveModeConfigAtom
} from '@/app/store/config/config'
import { displayPaletteAtom } from '@/app/store/preview/preview'
import {
  addRasterRangeAtom,
  rasterConflictsAtom,
  rasterEnabledAtom,
  rasterRangesAtom,
  removeRasterRangeAtom,
  updateRasterRangeAtom
} from '@/app/store/raster/raster'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { RasterRange } from '@/libs/pixsaur-raster/types'
import { cpcFullPalette } from '@/palettes/cpc-palette'
import { RasterPanelView } from './raster-panel-view'

/**
 * RasterPanel container component.
 *
 * Connects Jotai atoms to the presentational RasterPanelView.
 * Manages raster range state and provides handlers for UI interactions.
 */
export function RasterPanel() {
  const [enabled, setEnabled] = useAtom(rasterEnabledAtom)
  const ranges = useAtomValue(rasterRangesAtom)
  const conflicts = useAtomValue(rasterConflictsAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const displayPalette = useAtomValue(displayPaletteAtom)

  const addRange = useSetAtom(addRasterRangeAtom)
  const updateRange = useSetAtom(updateRasterRangeAtom)
  const removeRange = useSetAtom(removeRasterRangeAtom)

  // Max line is height - 1 (0-indexed)
  const maxLine = modeConfig.height - 1
  const isClassicMode = cpcHardware === 'classic'

  // Extract colors from display palette slots
  const palette: Vector[] = displayPalette.map(
    (slot) => slot.color || ([0, 0, 0] as Vector)
  )

  const handleAddRange = () => {
    // Find the last range (by endLine) to determine where to start the new range
    const sortedRanges = [...ranges].sort((a, b) => b.endLine - a.endLine)
    const lastRange = sortedRanges[0]

    // Default start is after the last range, or 0 if no ranges
    const defaultStartLine = lastRange ? lastRange.endLine + 1 : 0
    const defaultEndLine = Math.min(defaultStartLine + 50, maxLine)

    // Default ink is 0, but if adjacent to previous range with same ink, inherit its color
    const defaultInkIndex = 0

    // Check if we're adjacent to the last range and using the same ink
    // If so, inherit the color from that range
    let defaultColor: Vector
    if (
      lastRange &&
      defaultStartLine === lastRange.endLine + 1 &&
      lastRange.inkIndex === defaultInkIndex
    ) {
      // Inherit color from adjacent range on same ink
      defaultColor = lastRange.color
    } else {
      // Use the palette color for this ink
      defaultColor = palette[defaultInkIndex] || [0, 0, 0]
    }

    addRange({
      startLine: defaultStartLine,
      endLine: defaultEndLine,
      inkIndex: defaultInkIndex,
      color: defaultColor as Vector<'RGB'>
    })
  }

  const handleUpdateRange = (
    id: string,
    field: keyof Omit<RasterRange, 'id'>,
    value: number | Vector<'RGB'>
  ) => {
    updateRange({ id, [field]: value })
  }

  const handleRemoveRange = (id: string) => {
    removeRange(id)
  }

  return (
    <RasterPanelView
      enabled={enabled}
      onEnabledChange={setEnabled}
      ranges={ranges}
      conflicts={conflicts}
      maxLine={maxLine}
      palette={palette}
      nColors={modeConfig.nColors}
      cpcPalette={cpcFullPalette}
      isClassicMode={isClassicMode}
      onAddRange={handleAddRange}
      onUpdateRange={handleUpdateRange}
      onRemoveRange={handleRemoveRange}
    />
  )
}

export default RasterPanel
