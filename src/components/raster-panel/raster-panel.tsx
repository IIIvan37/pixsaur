import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { effectiveModeConfigAtom } from '@/app/store/config/config'
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

  const addRange = useSetAtom(addRasterRangeAtom)
  const updateRange = useSetAtom(updateRasterRangeAtom)
  const removeRange = useSetAtom(removeRasterRangeAtom)

  // Max line is height - 1 (0-indexed)
  const maxLine = modeConfig.height - 1

  const handleAddRange = () => {
    // Add a new range with default values
    const defaultStartLine = 0
    const defaultEndLine = Math.min(50, maxLine)

    addRange({
      startLine: defaultStartLine,
      endLine: defaultEndLine,
      inkIndex: 0,
      color: [255, 0, 0] as Vector<'RGB'> // Default to red
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
      onAddRange={handleAddRange}
      onUpdateRange={handleUpdateRange}
      onRemoveRange={handleRemoveRange}
    />
  )
}

export default RasterPanel
