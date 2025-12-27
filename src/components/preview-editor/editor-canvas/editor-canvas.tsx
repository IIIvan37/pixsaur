import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  canRedoAtom,
  canUndoAtom,
  editorCursorAtom,
  editorDimensionsAtom,
  editorGridVisibleAtom,
  editorHoveredPixelAtom,
  editorIndexBufferAtom,
  editorToolAtom,
  editorViewportAtom,
  editorZoomAtom,
  eyedropperAtom,
  getLinePaletteAtom,
  moveCursorAtom,
  paintAtCursorAtom,
  paintPixelAtom,
  redoEditAtom,
  toggleGridAtom,
  undoEditAtom,
  zoomInAtom,
  zoomOutAtom
} from '@/app/store/editor'
import { EditorCanvasView } from './editor-canvas-view'

/**
 * Smart component for the editor canvas.
 * Handles all interactions, keyboard shortcuts, and state management.
 */
export function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // State
  const indexBuffer = useAtomValue(editorIndexBufferAtom)
  const dimensions = useAtomValue(editorDimensionsAtom)
  const zoom = useAtomValue(editorZoomAtom)
  const viewport = useAtomValue(editorViewportAtom)
  const gridVisible = useAtomValue(editorGridVisibleAtom)
  const cursor = useAtomValue(editorCursorAtom)
  const hoveredPixel = useAtomValue(editorHoveredPixelAtom)
  const tool = useAtomValue(editorToolAtom)
  const getLinePalette = useAtomValue(getLinePaletteAtom)
  const canUndo = useAtomValue(canUndoAtom)
  const canRedo = useAtomValue(canRedoAtom)

  // Actions
  const setViewport = useSetAtom(editorViewportAtom)
  const setHoveredPixel = useSetAtom(editorHoveredPixelAtom)
  const paintPixel = useSetAtom(paintPixelAtom)
  const eyedropper = useSetAtom(eyedropperAtom)
  const moveCursor = useSetAtom(moveCursorAtom)
  const paintAtCursor = useSetAtom(paintAtCursorAtom)
  const undo = useSetAtom(undoEditAtom)
  const redo = useSetAtom(redoEditAtom)
  const zoomIn = useSetAtom(zoomInAtom)
  const zoomOut = useSetAtom(zoomOutAtom)
  const toggleGrid = useSetAtom(toggleGridAtom)

  // Convert screen coordinates to image coordinates
  const screenToImage = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } | null => {
      if (!dimensions) return null

      const x = Math.floor((screenX + viewport.x) / zoom)
      const y = Math.floor((screenY + viewport.y) / zoom)

      if (x < 0 || x >= dimensions.width || y < 0 || y >= dimensions.height) {
        return null
      }

      return { x, y }
    },
    [dimensions, viewport, zoom]
  )

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const imagePos = screenToImage(screenX, screenY)

      setHoveredPixel(imagePos)

      // Paint while dragging with pencil tool
      if (e.buttons === 1 && tool === 'pencil' && imagePos) {
        paintPixel(imagePos)
      }
    },
    [screenToImage, setHoveredPixel, tool, paintPixel]
  )

  // Handle mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const imagePos = screenToImage(screenX, screenY)

      if (!imagePos) return

      if (tool === 'pencil') {
        paintPixel(imagePos)
      } else if (tool === 'eyedropper') {
        eyedropper(imagePos)
      }
    },
    [screenToImage, tool, paintPixel, eyedropper]
  )

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setHoveredPixel(null)
  }, [setHoveredPixel])

  // Handle wheel for zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        if (e.deltaY < 0) {
          zoomIn()
        } else {
          zoomOut()
        }
      } else {
        // Pan
        setViewport((prev) => ({
          x: Math.max(0, prev.x + e.deltaX),
          y: Math.max(0, prev.y + e.deltaY)
        }))
      }
    },
    [zoomIn, zoomOut, setViewport]
  )

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey

      // Undo/Redo
      if (isCtrlOrCmd && e.key === 'z' && !e.shiftKey && canUndo) {
        e.preventDefault()
        undo()
        return
      }
      if (
        isCtrlOrCmd &&
        (e.key === 'y' || (e.key === 'z' && e.shiftKey)) &&
        canRedo
      ) {
        e.preventDefault()
        redo()
        return
      }

      // Zoom
      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        zoomIn()
        return
      }
      if (e.key === '-') {
        e.preventDefault()
        zoomOut()
        return
      }

      // Grid toggle
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault()
        toggleGrid()
        return
      }

      // Arrow keys for cursor navigation
      const largeStep = e.shiftKey
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          moveCursor('up', largeStep)
          break
        case 'ArrowDown':
          e.preventDefault()
          moveCursor('down', largeStep)
          break
        case 'ArrowLeft':
          e.preventDefault()
          moveCursor('left', largeStep)
          break
        case 'ArrowRight':
          e.preventDefault()
          moveCursor('right', largeStep)
          break
        case 'Enter':
        case ' ':
          if (cursor) {
            e.preventDefault()
            paintAtCursor()
          }
          break
      }
    }

    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [
    canUndo,
    canRedo,
    undo,
    redo,
    zoomIn,
    zoomOut,
    toggleGrid,
    moveCursor,
    paintAtCursor,
    cursor
  ])

  // Calculate canvas display size
  const canvasSize = useMemo(() => {
    if (!dimensions) return { width: 0, height: 0 }
    return {
      width: dimensions.width * zoom,
      height: dimensions.height * zoom
    }
  }, [dimensions, zoom])

  if (!indexBuffer || !dimensions) {
    return null
  }

  return (
    <EditorCanvasView
      ref={canvasRef}
      containerRef={containerRef}
      indexBuffer={indexBuffer}
      width={dimensions.width}
      height={dimensions.height}
      zoom={zoom}
      viewport={viewport}
      gridVisible={gridVisible}
      cursor={cursor}
      hoveredPixel={hoveredPixel}
      canvasWidth={canvasSize.width}
      canvasHeight={canvasSize.height}
      getLinePalette={getLinePalette}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
    />
  )
}
