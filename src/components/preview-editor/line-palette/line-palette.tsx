import { useAtomValue, useSetAtom } from 'jotai'
import { useMemo } from 'react'
import {
  editorCursorAtom,
  editorHoveredPixelAtom,
  editorSelectedInkAtom,
  getLinePaletteAtom
} from '@/app/store/editor'
import { LinePaletteView } from './line-palette-view'

/**
 * Smart component for the line palette.
 * Shows the effective palette for the current line (cursor or hovered).
 */
export function LinePalette() {
  // State
  const cursor = useAtomValue(editorCursorAtom)
  const hoveredPixel = useAtomValue(editorHoveredPixelAtom)
  const selectedInk = useAtomValue(editorSelectedInkAtom)
  const getLinePalette = useAtomValue(getLinePaletteAtom)

  // Actions
  const setSelectedInk = useSetAtom(editorSelectedInkAtom)

  // Determine the current line (prefer cursor, fallback to hovered, then 0)
  const currentLine = cursor?.y ?? hoveredPixel?.y ?? 0

  // Get the effective palette for the current line
  const palette = useMemo(
    () => getLinePalette(currentLine),
    [getLinePalette, currentLine]
  )

  const handleSelectInk = (index: number) => {
    setSelectedInk(index)
  }

  return (
    <LinePaletteView
      palette={palette}
      selectedInk={selectedInk}
      currentLine={currentLine}
      onSelectInk={handleSelectInk}
    />
  )
}
