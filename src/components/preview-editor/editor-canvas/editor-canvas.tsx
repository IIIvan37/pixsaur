import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import {
  canRedoAtom,
  canUndoAtom,
  editorCursorAtom,
  editorDimensionsAtom,
  editorGridVisibleAtom,
  editorHoveredPixelAtom,
  editorIndexBufferAtom,
  editorPixelAspectAtom,
  editorZoomAtom,
  getLineCpcPixelWidthAtom,
  getLinePaletteAtom,
  moveCursorAtom,
  nextInkAtom,
  paintAtCursorAtom,
  paintPixelAtom,
  prevInkAtom,
  redoEditAtom,
  toggleGridAtom,
  undoEditAtom,
  zoomInAtom,
  zoomOutAtom
} from '@/app/store/editor'
import { EditorCanvasView } from './editor-canvas-view'

type EditorCanvasProps = Readonly<{
  containerRef: React.RefObject<HTMLDivElement | null>
  onEscape?: () => void
  onSave?: () => void
}>

/**
 * Smart component for the editor canvas.
 * Handles all interactions, keyboard shortcuts, and state management.
 */
export function EditorCanvas({
  containerRef,
  onEscape,
  onSave
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // State
  const indexBuffer = useAtomValue(editorIndexBufferAtom)
  const dimensions = useAtomValue(editorDimensionsAtom)
  const zoom = useAtomValue(editorZoomAtom)
  const pixelAspect = useAtomValue(editorPixelAspectAtom)
  const gridVisible = useAtomValue(editorGridVisibleAtom)
  const cursor = useAtomValue(editorCursorAtom)
  const hoveredPixel = useAtomValue(editorHoveredPixelAtom)
  const getLinePalette = useAtomValue(getLinePaletteAtom)
  const getLineCpcPixelWidth = useAtomValue(getLineCpcPixelWidthAtom)
  const canUndo = useAtomValue(canUndoAtom)
  const canRedo = useAtomValue(canRedoAtom)

  // Actions
  const setHoveredPixel = useSetAtom(editorHoveredPixelAtom)
  const setCursor = useSetAtom(editorCursorAtom)
  const paintPixel = useSetAtom(paintPixelAtom)
  const moveCursor = useSetAtom(moveCursorAtom)
  const paintAtCursor = useSetAtom(paintAtCursorAtom)
  const undo = useSetAtom(undoEditAtom)
  const redo = useSetAtom(redoEditAtom)
  const zoomIn = useSetAtom(zoomInAtom)
  const zoomOut = useSetAtom(zoomOutAtom)
  const toggleGrid = useSetAtom(toggleGridAtom)
  const nextInk = useSetAtom(nextInkAtom)
  const prevInk = useSetAtom(prevInkAtom)

  // Calculate pixel dimensions with aspect ratio
  const pixelWidth = zoom * pixelAspect.widthMultiplier
  const pixelHeight = zoom * pixelAspect.heightMultiplier

  // Track previous zoom and pixel dimensions for scroll adjustment
  const prevZoomRef = useRef(zoom)
  const prevPixelWidthRef = useRef(pixelWidth)
  const prevPixelHeightRef = useRef(pixelHeight)

  // Adjust scroll position to maintain center when zoom changes
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const prevPixelWidth = prevPixelWidthRef.current
    const prevPixelHeight = prevPixelHeightRef.current

    // Only adjust if zoom actually changed
    if (prevPixelWidth !== pixelWidth || prevPixelHeight !== pixelHeight) {
      // Calculate the center point in the old coordinate system
      const oldCenterX = container.scrollLeft + container.clientWidth / 2
      const oldCenterY = container.scrollTop + container.clientHeight / 2

      // Convert to image coordinates (which pixel was at center)
      const imageCenterX = oldCenterX / prevPixelWidth
      const imageCenterY = oldCenterY / prevPixelHeight

      // Calculate new scroll position to keep the same image point at center
      const newScrollX = imageCenterX * pixelWidth - container.clientWidth / 2
      const newScrollY = imageCenterY * pixelHeight - container.clientHeight / 2

      container.scrollLeft = Math.max(0, newScrollX)
      container.scrollTop = Math.max(0, newScrollY)
    }

    // Update refs for next change
    prevZoomRef.current = zoom
    prevPixelWidthRef.current = pixelWidth
    prevPixelHeightRef.current = pixelHeight
  }, [containerRef, zoom, pixelWidth, pixelHeight])

  // Auto-scroll to keep cursor visible when it moves near edges
  useEffect(() => {
    const container = containerRef.current
    if (!container || !cursor) return

    // Calculate cursor position on screen
    const cursorScreenX = cursor.x * pixelWidth
    const cursorScreenY = cursor.y * pixelHeight
    const cursorScreenRight = cursorScreenX + pixelWidth
    const cursorScreenBottom = cursorScreenY + pixelHeight

    // Define scroll margins (how close to edge before scrolling)
    const margin = 50 // pixels from edge

    // Get current viewport bounds
    const viewportLeft = container.scrollLeft
    const viewportTop = container.scrollTop
    const viewportRight = viewportLeft + container.clientWidth
    const viewportBottom = viewportTop + container.clientHeight

    let newScrollX = container.scrollLeft
    let newScrollY = container.scrollTop

    // Check if cursor is near or outside viewport edges and scroll to keep it visible
    if (cursorScreenX < viewportLeft + margin) {
      // Cursor is near/past left edge - scroll left
      newScrollX = Math.max(0, cursorScreenX - margin)
    } else if (cursorScreenRight > viewportRight - margin) {
      // Cursor is near/past right edge - scroll right
      newScrollX = cursorScreenRight + margin - container.clientWidth
    }

    if (cursorScreenY < viewportTop + margin) {
      // Cursor is near/past top edge - scroll up
      newScrollY = Math.max(0, cursorScreenY - margin)
    } else if (cursorScreenBottom > viewportBottom - margin) {
      // Cursor is near/past bottom edge - scroll down
      newScrollY = cursorScreenBottom + margin - container.clientHeight
    }

    // Apply scroll if needed
    if (
      newScrollX !== container.scrollLeft ||
      newScrollY !== container.scrollTop
    ) {
      container.scrollTo({
        left: newScrollX,
        top: newScrollY,
        behavior: 'smooth'
      })
    }
  }, [containerRef, cursor, pixelWidth, pixelHeight])

  // Track if space is held for drawing mode
  const isSpaceHeld = useRef(false)

  // Convert screen coordinates to image coordinates
  const screenToImage = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } | null => {
      if (!dimensions) return null

      const x = Math.floor(screenX / pixelWidth)
      const y = Math.floor(screenY / pixelHeight)

      if (x < 0 || x >= dimensions.width || y < 0 || y >= dimensions.height) {
        return null
      }

      return { x, y }
    },
    [dimensions, pixelWidth, pixelHeight]
  )

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const imagePos = screenToImage(screenX, screenY)

      setHoveredPixel(imagePos)

      // Paint only while holding space
      if (imagePos && isSpaceHeld.current) {
        paintPixel(imagePos)
      }
    },
    [screenToImage, setHoveredPixel, paintPixel]
  )

  // Handle mouse down - set cursor position
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const imagePos = screenToImage(screenX, screenY)

      if (!imagePos) return

      // Set cursor position on click
      setCursor(imagePos)
    },
    [screenToImage, setCursor]
  )

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    // Nothing to do - cursor is set on mouse down
  }, [])

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setHoveredPixel(null)
  }, [setHoveredPixel])

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

      // Ink navigation with [ and ]
      if (e.key === '[' || e.key === 'Dead') {
        e.preventDefault()
        prevInk()
        return
      }
      if (e.key === ']' || e.key === '$') {
        e.preventDefault()
        nextInk()
        return
      }

      // Save (Ctrl/Cmd + S)
      if (isCtrlOrCmd && e.key === 's') {
        e.preventDefault()
        onSave?.()
        return
      }

      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault()
        onEscape?.()
        return
      }

      // Space key - track for draw mode
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        e.stopPropagation()
        isSpaceHeld.current = true
        // Paint at current cursor position
        if (cursor) {
          paintAtCursor()
        }
        return
      }

      // Arrow keys for cursor navigation (paint if space is held)
      const largeStep = e.shiftKey
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          e.stopPropagation()
          moveCursor('up', largeStep)
          if (isSpaceHeld.current) {
            // Paint after cursor moved (use setTimeout to ensure cursor is updated)
            setTimeout(() => paintAtCursor(), 0)
          }
          return
        case 'ArrowDown':
          e.preventDefault()
          e.stopPropagation()
          moveCursor('down', largeStep)
          if (isSpaceHeld.current) {
            setTimeout(() => paintAtCursor(), 0)
          }
          return
        case 'ArrowLeft':
          e.preventDefault()
          e.stopPropagation()
          moveCursor('left', largeStep)
          if (isSpaceHeld.current) {
            setTimeout(() => paintAtCursor(), 0)
          }
          return
        case 'ArrowRight':
          e.preventDefault()
          e.stopPropagation()
          moveCursor('right', largeStep)
          if (isSpaceHeld.current) {
            setTimeout(() => paintAtCursor(), 0)
          }
          return
        case 'Enter':
          if (cursor) {
            e.preventDefault()
            e.stopPropagation()
            paintAtCursor()
          }
          return
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        isSpaceHeld.current = false
      }
    }

    globalThis.addEventListener('keydown', handleKeyDown)
    globalThis.addEventListener('keyup', handleKeyUp)
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown)
      globalThis.removeEventListener('keyup', handleKeyUp)
    }
  }, [
    canUndo,
    canRedo,
    undo,
    redo,
    zoomIn,
    zoomOut,
    toggleGrid,
    nextInk,
    prevInk,
    onSave,
    onEscape,
    moveCursor,
    paintAtCursor,
    cursor
  ])

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
      pixelWidth={pixelWidth}
      pixelHeight={pixelHeight}
      gridVisible={gridVisible}
      cursor={cursor}
      hoveredPixel={hoveredPixel}
      getLinePalette={getLinePalette}
      getLineCpcPixelWidth={getLineCpcPixelWidth}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  )
}
