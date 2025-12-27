import { forwardRef, useEffect } from 'react'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import styles from './editor-canvas.module.css'

export type EditorCanvasViewProps = Readonly<{
  containerRef: React.RefObject<HTMLDivElement | null>
  indexBuffer: Uint8Array
  width: number
  height: number
  zoom: number
  viewport: { x: number; y: number }
  gridVisible: boolean
  cursor: { x: number; y: number } | null
  hoveredPixel: { x: number; y: number } | null
  canvasWidth: number
  canvasHeight: number
  getLinePalette: (line: number) => Vector<'RGB'>[]
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void
  onMouseLeave: () => void
  onWheel: (e: React.WheelEvent<HTMLCanvasElement>) => void
}>

type RenderContext = {
  ctx: CanvasRenderingContext2D
  zoom: number
  viewport: { x: number; y: number }
  canvasWidth: number
  canvasHeight: number
}

/**
 * Render pixels to canvas
 */
function renderPixels(
  rc: RenderContext,
  indexBuffer: Uint8Array,
  width: number,
  height: number,
  getLinePalette: (line: number) => Vector<'RGB'>[]
) {
  const { ctx, zoom, viewport, canvasWidth, canvasHeight } = rc
  const startX = Math.floor(viewport.x / zoom)
  const startY = Math.floor(viewport.y / zoom)
  const visibleWidth = Math.ceil(canvasWidth / zoom) + 1
  const visibleHeight = Math.ceil(canvasHeight / zoom) + 1

  for (let y = startY; y < Math.min(startY + visibleHeight, height); y++) {
    const palette = getLinePalette(y)
    for (let x = startX; x < Math.min(startX + visibleWidth, width); x++) {
      const inkIndex = indexBuffer[y * width + x]
      const color = palette[inkIndex] ?? [0, 0, 0]
      ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`
      ctx.fillRect(
        (x - startX) * zoom - (viewport.x % zoom),
        (y - startY) * zoom - (viewport.y % zoom),
        zoom,
        zoom
      )
    }
  }
}

/**
 * Draw grid overlay
 */
function renderGrid(rc: RenderContext) {
  const { ctx, zoom, viewport, canvasWidth, canvasHeight } = rc
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.lineWidth = 1

  const offsetX = -(viewport.x % zoom)
  const offsetY = -(viewport.y % zoom)

  ctx.beginPath()
  for (let x = offsetX; x <= canvasWidth; x += zoom) {
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, canvasHeight)
  }
  ctx.stroke()

  ctx.beginPath()
  for (let y = offsetY; y <= canvasHeight; y += zoom) {
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(canvasWidth, y + 0.5)
  }
  ctx.stroke()
}

/**
 * Draw cursor highlight
 */
function renderCursor(
  rc: RenderContext,
  cursorPos: { x: number; y: number },
  startX: number,
  startY: number
) {
  const { ctx, zoom, viewport, canvasWidth, canvasHeight } = rc
  const screenX = (cursorPos.x - startX) * zoom - (viewport.x % zoom)
  const screenY = (cursorPos.y - startY) * zoom - (viewport.y % zoom)

  const isVisible =
    screenX >= -zoom &&
    screenX < canvasWidth + zoom &&
    screenY >= -zoom &&
    screenY < canvasHeight + zoom

  if (!isVisible) return

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.strokeRect(screenX + 1, screenY + 1, zoom - 2, zoom - 2)

  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 1
  ctx.strokeRect(screenX + 2, screenY + 2, zoom - 4, zoom - 4)
}

/**
 * Draw hover highlight
 */
function renderHover(
  rc: RenderContext,
  hoverPos: { x: number; y: number },
  startX: number,
  startY: number
) {
  const { ctx, zoom, viewport, canvasWidth, canvasHeight } = rc
  const screenX = (hoverPos.x - startX) * zoom - (viewport.x % zoom)
  const screenY = (hoverPos.y - startY) * zoom - (viewport.y % zoom)

  const isVisible =
    screenX >= -zoom &&
    screenX < canvasWidth + zoom &&
    screenY >= -zoom &&
    screenY < canvasHeight + zoom

  if (!isVisible) return

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.lineWidth = 1
  ctx.strokeRect(screenX + 0.5, screenY + 0.5, zoom - 1, zoom - 1)
}

/**
 * Dumb component for rendering the editor canvas.
 * Handles only rendering logic, no state management.
 */
export const EditorCanvasView = forwardRef<
  HTMLCanvasElement,
  EditorCanvasViewProps
>(function EditorCanvasView(
  {
    containerRef,
    indexBuffer,
    width,
    height,
    zoom,
    viewport,
    gridVisible,
    cursor,
    hoveredPixel,
    canvasWidth,
    canvasHeight,
    getLinePalette,
    onMouseMove,
    onMouseDown,
    onMouseLeave,
    onWheel
  },
  ref
) {
  // Render the canvas whenever dependencies change
  useEffect(() => {
    const canvas = typeof ref === 'function' ? null : ref?.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Create render context
    const rc: RenderContext = { ctx, zoom, viewport, canvasWidth, canvasHeight }

    // Clear canvas
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Calculate visible region start
    const startX = Math.floor(viewport.x / zoom)
    const startY = Math.floor(viewport.y / zoom)

    // Render pixels
    renderPixels(rc, indexBuffer, width, height, getLinePalette)

    // Draw grid if zoom >= 4
    if (gridVisible && zoom >= 4) {
      renderGrid(rc)
    }

    // Draw cursor (keyboard navigation)
    if (cursor) {
      renderCursor(rc, cursor, startX, startY)
    }

    // Draw hover highlight (if different from cursor)
    const shouldShowHover =
      hoveredPixel &&
      (!cursor || hoveredPixel.x !== cursor.x || hoveredPixel.y !== cursor.y)

    if (shouldShowHover) {
      renderHover(rc, hoveredPixel, startX, startY)
    }
  }, [
    ref,
    indexBuffer,
    width,
    height,
    zoom,
    viewport,
    gridVisible,
    cursor,
    hoveredPixel,
    canvasWidth,
    canvasHeight,
    getLinePalette
  ])

  return (
    <div ref={containerRef} className={styles.container}>
      <canvas
        ref={ref}
        width={canvasWidth}
        height={canvasHeight}
        className={styles.canvas}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseLeave={onMouseLeave}
        onWheel={onWheel}
      />
    </div>
  )
})
