import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useMemo } from 'react'
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

  // Determine the current pixel (prefer cursor, fallback to hovered)
  const currentPixel = cursor ?? hoveredPixel

  // Get the effective palette for the current line
  const currentLine = currentPixel?.y ?? 0
  const palette = useMemo(
    () => getLinePalette(currentLine),
    [getLinePalette, currentLine]
  )

  // Auto-adjust selected ink if it exceeds available palette colors (EGX)
  useEffect(() => {
    if (selectedInk >= palette.length && palette.length > 0) {
      setSelectedInk(palette.length - 1)
    }
  }, [palette.length, selectedInk, setSelectedInk])

  const handleSelectInk = (index: number) => {
    setSelectedInk(index)
  }

  // Ensure displayed selectedInk is within bounds
  const effectiveSelectedInk = Math.min(
    selectedInk,
    Math.max(0, palette.length - 1)
  )

  return (
    <LinePaletteView
      palette={palette}
      selectedInk={effectiveSelectedInk}
      currentLine={currentLine}
      onSelectInk={handleSelectInk}
    />
  )
}
