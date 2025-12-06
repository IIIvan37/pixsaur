import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  cpcHardwareAtom,
  effectiveModeConfigAtom
} from '@/app/store/config/config'
import { imageAtom } from '@/app/store/image/image'
import { displayPaletteAtom } from '@/app/store/preview/preview'
import {
  addRasterChangeAtom,
  rasterChangesAtom,
  rasterConflictsAtom,
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
  const changes = useAtomValue(rasterChangesAtom)
  const conflicts = useAtomValue(rasterConflictsAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const displayPalette = useAtomValue(displayPaletteAtom)
  const image = useAtomValue(imageAtom)

  const addChange = useSetAtom(addRasterChangeAtom)
  const updateChange = useSetAtom(updateRasterChangeAtom)
  const removeChange = useSetAtom(removeRasterChangeAtom)

  // Max line is height - 1 (0-indexed)
  const maxLine = modeConfig.height - 1
  const isClassicMode = cpcHardware === 'classic'
  const hasImage = image !== null

  // Extract colors from display palette slots
  const palette: Vector[] = displayPalette.map(
    (slot) => slot.color || ([0, 0, 0] as Vector)
  )

  const handleAddChange = () => {
    // Find the last change (by line) to determine where to add the new one
    const sortedChanges = [...changes].sort((a, b) => b.line - a.line)
    const lastChange = sortedChanges[0]

    // Default line is after the last change (+1), or 0 if no changes
    const defaultLine = lastChange ? Math.min(lastChange.line + 1, maxLine) : 0

    // Default ink is 0
    const defaultInkIndex = 0

    // Use the palette color for this ink
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
      onAddChange={handleAddChange}
      onUpdateChange={handleUpdateChange}
      onRemoveChange={handleRemoveChange}
    />
  )
}

export default RasterPanel
