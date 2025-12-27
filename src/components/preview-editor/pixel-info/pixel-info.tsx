import { useAtomValue } from 'jotai'
import { useMemo } from 'react'
import {
  editorCursorAtom,
  editorDimensionsAtom,
  editorHoveredPixelAtom,
  editorIndexBufferAtom,
  getLinePaletteAtom
} from '@/app/store/editor'
import { PixelInfoView } from './pixel-info-view'

/**
 * Smart component for pixel info display.
 * Shows coordinates and color of the current pixel (cursor or hovered).
 */
export function PixelInfo() {
  // State
  const cursor = useAtomValue(editorCursorAtom)
  const hoveredPixel = useAtomValue(editorHoveredPixelAtom)
  const indexBuffer = useAtomValue(editorIndexBufferAtom)
  const dimensions = useAtomValue(editorDimensionsAtom)
  const getLinePalette = useAtomValue(getLinePaletteAtom)

  // Get current pixel (prefer hovered, fallback to cursor)
  const currentPixel = hoveredPixel ?? cursor

  // Get pixel info
  const pixelInfo = useMemo(() => {
    if (!currentPixel || !indexBuffer || !dimensions) return null

    const { x, y } = currentPixel
    const { width } = dimensions
    const inkIndex = indexBuffer[y * width + x]
    const palette = getLinePalette(y)
    const color = palette[inkIndex] ?? [0, 0, 0]

    return {
      x,
      y,
      inkIndex,
      color
    }
  }, [currentPixel, indexBuffer, dimensions, getLinePalette])

  return <PixelInfoView pixelInfo={pixelInfo} />
}
