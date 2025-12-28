import { useAtomValue, useStore } from 'jotai'
import { useCallback, useEffect, useState } from 'react'
import {
  editorDimensionsAtom,
  editorIndexBufferAtom,
  editorPixelAspectAtom,
  editorZoomAtom,
  getLinePaletteAtom
} from '@/app/store/editor'
import { EditorMinimapView } from './editor-minimap-view'

type ViewportRect = {
  x: number
  y: number
  width: number
  height: number
}

type EditorMinimapProps = Readonly<{
  containerRef: React.RefObject<HTMLDivElement | null>
}>

/**
 * Smart component for the editor minimap.
 * Shows a thumbnail of the full image with a rectangle indicating the visible area.
 */
export function EditorMinimap({ containerRef }: EditorMinimapProps) {
  const store = useStore()
  const indexBuffer = useAtomValue(editorIndexBufferAtom)
  const dimensions = useAtomValue(editorDimensionsAtom)
  const pixelAspect = useAtomValue(editorPixelAspectAtom)
  const getLinePalette = useAtomValue(getLinePaletteAtom)

  const [viewportRect, setViewportRect] = useState<ViewportRect>({
    x: 0,
    y: 0,
    width: 0,
    height: 0
  })

  // Update viewport rect when container scrolls or resizes
  useEffect(() => {
    const container = containerRef.current
    if (!container || !dimensions) return

    const updateViewport = () => {
      // Read current values from store to ensure we have latest
      const currentZoom = store.get(editorZoomAtom)
      const currentPixelAspect = store.get(editorPixelAspectAtom)
      const currentDimensions = store.get(editorDimensionsAtom)
      if (!currentDimensions) return

      // Calculate total canvas size based on zoom and pixel aspect ratio
      const pixelWidth = currentZoom * currentPixelAspect.widthMultiplier
      const pixelHeight = currentZoom * currentPixelAspect.heightMultiplier
      const totalWidth = currentDimensions.width * pixelWidth
      const totalHeight = currentDimensions.height * pixelHeight

      // Calculate viewport as normalized coordinates (0-1)
      // x,y = position of top-left corner of viewport
      // width,height = size of viewport relative to total image
      const x = totalWidth > 0 ? container.scrollLeft / totalWidth : 0
      const y = totalHeight > 0 ? container.scrollTop / totalHeight : 0
      const w =
        totalWidth > 0 ? Math.min(1, container.clientWidth / totalWidth) : 1
      const h =
        totalHeight > 0 ? Math.min(1, container.clientHeight / totalHeight) : 1

      setViewportRect({
        x: Math.max(0, Math.min(1 - w, x)),
        y: Math.max(0, Math.min(1 - h, y)),
        width: w,
        height: h
      })
    }

    // Initial update
    updateViewport()

    // Listen to scroll events
    container.addEventListener('scroll', updateViewport)

    // Listen to resize
    const resizeObserver = new ResizeObserver(updateViewport)
    resizeObserver.observe(container)

    return () => {
      container.removeEventListener('scroll', updateViewport)
      resizeObserver.disconnect()
    }
  }, [containerRef, dimensions, store])

  // Handle click on minimap to navigate
  const handleMinimapClick = useCallback(
    (normalizedX: number, normalizedY: number) => {
      const container = containerRef.current
      if (!container) return

      // Read current values from store to ensure we have latest
      const currentZoom = store.get(editorZoomAtom)
      const currentPixelAspect = store.get(editorPixelAspectAtom)
      const currentDimensions = store.get(editorDimensionsAtom)
      if (!currentDimensions) return

      // Calculate total canvas size based on zoom and pixel aspect ratio
      const pixelWidth = currentZoom * currentPixelAspect.widthMultiplier
      const pixelHeight = currentZoom * currentPixelAspect.heightMultiplier
      const totalWidth = currentDimensions.width * pixelWidth
      const totalHeight = currentDimensions.height * pixelHeight

      // The clicked position in pixels on the full canvas
      const clickedPixelX = normalizedX * totalWidth
      const clickedPixelY = normalizedY * totalHeight

      // We want this clicked position to be at the center of the viewport
      // So scroll position = clicked position - half viewport size
      const targetScrollX = clickedPixelX - container.clientWidth / 2
      const targetScrollY = clickedPixelY - container.clientHeight / 2

      // Clamp to valid scroll range
      const maxScrollX = Math.max(0, totalWidth - container.clientWidth)
      const maxScrollY = Math.max(0, totalHeight - container.clientHeight)

      container.scrollTo({
        left: Math.max(0, Math.min(maxScrollX, targetScrollX)),
        top: Math.max(0, Math.min(maxScrollY, targetScrollY)),
        behavior: 'instant'
      })
    },
    [containerRef, store]
  )

  if (!indexBuffer || !dimensions) {
    return null
  }

  return (
    <EditorMinimapView
      indexBuffer={indexBuffer}
      width={dimensions.width}
      height={dimensions.height}
      pixelAspect={pixelAspect}
      viewportRect={viewportRect}
      getLinePalette={getLinePalette}
      onMinimapClick={handleMinimapClick}
    />
  )
}
