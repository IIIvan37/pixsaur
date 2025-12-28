import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useRef } from 'react'
import {
  canRedoAtom,
  canUndoAtom,
  type EditorTool,
  editorCursorAtom,
  editorDimensionsAtom,
  editorGridVisibleAtom,
  editorHoveredPixelAtom,
  editorIndexBufferAtom,
  editorPixelAspectAtom,
  editorToolAtom,
  editorZoomAtom,
  eyedropperAtom,
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
  const tool = useAtomValue(editorToolAtom)
  const getLinePalette = useAtomValue(getLinePaletteAtom)
  const canUndo = useAtomValue(canUndoAtom)
  const canRedo = useAtomValue(canRedoAtom)

  // Actions
  const setHoveredPixel = useSetAtom(editorHoveredPixelAtom)
  const setCursor = useSetAtom(editorCursorAtom)
  const setTool = useSetAtom(editorToolAtom)
  const paintPixel = useSetAtom(paintPixelAtom)
  const eyedropper = useSetAtom(eyedropperAtom)
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

  // Track if mouse is being dragged (for paint vs click distinction)
  const isDragging = useRef(false)

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const imagePos = screenToImage(screenX, screenY)

      setHoveredPixel(imagePos)

      // Paint while dragging with pencil tool OR while holding space
      if (imagePos && tool === 'pencil') {
        if (e.buttons === 1 || isSpaceHeld.current) {
          isDragging.current = true
          paintPixel(imagePos)
        }
      }
    },
    [screenToImage, setHoveredPixel, tool, paintPixel]
  )

  // Handle mouse down - start potential drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      isDragging.current = false

      const rect = e.currentTarget.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const imagePos = screenToImage(screenX, screenY)

      if (!imagePos) return

      // Eyedropper works on click
      if (tool === 'eyedropper') {
        eyedropper(imagePos)
      }
    },
    [screenToImage, tool, eyedropper]
  )

  // Handle mouse up - set cursor position if it was a click (not drag)
  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const imagePos = screenToImage(screenX, screenY)

      if (!imagePos) return

      // If it was a simple click (not drag), set cursor position
      if (!isDragging.current) {
        setCursor(imagePos)
      }

      isDragging.current = false
    },
    [screenToImage, setCursor]
  )

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

      // Tool shortcuts (when not holding Ctrl/Cmd)
      if (!isCtrlOrCmd) {
        const toolShortcuts: Record<string, EditorTool> = {
          p: 'pencil',
          b: 'pencil', // Brush alias
          i: 'eyedropper',
          g: 'fill', // Paint bucket (fill)
          s: 'select'
        }
        const lowKey = e.key.toLowerCase()
        if (lowKey in toolShortcuts) {
          e.preventDefault()
          setTool(toolShortcuts[lowKey])
          return
        }
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
        if (cursor && tool === 'pencil') {
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
          if (isSpaceHeld.current && tool === 'pencil') {
            // Paint after cursor moved (use setTimeout to ensure cursor is updated)
            setTimeout(() => paintAtCursor(), 0)
          }
          return
        case 'ArrowDown':
          e.preventDefault()
          e.stopPropagation()
          moveCursor('down', largeStep)
          if (isSpaceHeld.current && tool === 'pencil') {
            setTimeout(() => paintAtCursor(), 0)
          }
          return
        case 'ArrowLeft':
          e.preventDefault()
          e.stopPropagation()
          moveCursor('left', largeStep)
          if (isSpaceHeld.current && tool === 'pencil') {
            setTimeout(() => paintAtCursor(), 0)
          }
          return
        case 'ArrowRight':
          e.preventDefault()
          e.stopPropagation()
          moveCursor('right', largeStep)
          if (isSpaceHeld.current && tool === 'pencil') {
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
    setTool,
    onSave,
    onEscape,
    tool,
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
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  )
}
