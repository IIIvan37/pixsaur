import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import styles from './editor-canvas.module.css'

export type EditorCanvasViewProps = Readonly<{
  containerRef: React.RefObject<HTMLDivElement | null>
  indexBuffer: Uint8Array
  width: number
  height: number
  pixelWidth: number
  pixelHeight: number
  gridVisible: boolean
  cursor: { x: number; y: number } | null
  hoveredPixel: { x: number; y: number } | null
  getLinePalette: (line: number) => Vector<'RGB'>[]
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void
  onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void
  onMouseLeave: () => void
}>

/**
 * Render all pixels to canvas (full image with aspect ratio)
 */
function renderPixels(
  ctx: CanvasRenderingContext2D,
  indexBuffer: Uint8Array,
  width: number,
  height: number,
  pixelWidth: number,
  pixelHeight: number,
  getLinePalette: (line: number) => Vector<'RGB'>[]
) {
  for (let y = 0; y < height; y++) {
    const palette = getLinePalette(y)
    for (let x = 0; x < width; x++) {
      const inkIndex = indexBuffer[y * width + x]
      const color = palette[inkIndex] ?? [0, 0, 0]
      ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`
      ctx.fillRect(x * pixelWidth, y * pixelHeight, pixelWidth, pixelHeight)
    }
  }
}

/**
 * Draw grid overlay
 */
function renderGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pixelWidth: number,
  pixelHeight: number
) {
  const canvasWidth = width * pixelWidth
  const canvasHeight = height * pixelHeight

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.lineWidth = 1

  ctx.beginPath()
  for (let x = 0; x <= width; x++) {
    const screenX = x * pixelWidth
    ctx.moveTo(screenX + 0.5, 0)
    ctx.lineTo(screenX + 0.5, canvasHeight)
  }
  for (let y = 0; y <= height; y++) {
    const screenY = y * pixelHeight
    ctx.moveTo(0, screenY + 0.5)
    ctx.lineTo(canvasWidth, screenY + 0.5)
  }
  ctx.stroke()
}

/**
 * Draw cursor highlight (keyboard navigation)
 */
function renderCursor(
  ctx: CanvasRenderingContext2D,
  cursor: { x: number; y: number },
  pixelWidth: number,
  pixelHeight: number
) {
  const screenX = cursor.x * pixelWidth
  const screenY = cursor.y * pixelHeight

  ctx.strokeStyle = '#ffcc00'
  ctx.lineWidth = 2
  ctx.strokeRect(screenX + 1, screenY + 1, pixelWidth - 2, pixelHeight - 2)
}

/**
 * Draw hover highlight
 */
function renderHover(
  ctx: CanvasRenderingContext2D,
  pixel: { x: number; y: number },
  pixelWidth: number,
  pixelHeight: number
) {
  const screenX = pixel.x * pixelWidth
  const screenY = pixel.y * pixelHeight

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.lineWidth = 1
  ctx.strokeRect(screenX + 0.5, screenY + 0.5, pixelWidth - 1, pixelHeight - 1)
}

/**
 * Dumb component for the editor canvas.
 * Renders the pixel grid with aspect ratio, grid, cursor, and hover highlights.
 * Uses native scrolling for navigation.
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
    pixelWidth,
    pixelHeight,
    gridVisible,
    cursor,
    hoveredPixel,
    getLinePalette,
    onMouseMove,
    onMouseDown,
    onMouseUp,
    onMouseLeave
  },
  ref
) {
  // Local ref for canvas access in useEffect
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Expose canvas ref to parent via forwardRef
  useImperativeHandle(ref, () => canvasRef.current!, [])

  const canvasWidth = width * pixelWidth
  const canvasHeight = height * pixelHeight

  // Minimum pixel size for grid visibility (4px in smallest dimension)
  const minPixelSize = Math.min(pixelWidth, pixelHeight)

  // Render the canvas whenever dependencies change
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Render all pixels
    renderPixels(
      ctx,
      indexBuffer,
      width,
      height,
      pixelWidth,
      pixelHeight,
      getLinePalette
    )

    // Draw grid if pixel size >= 4
    if (gridVisible && minPixelSize >= 4) {
      renderGrid(ctx, width, height, pixelWidth, pixelHeight)
    }

    // Draw cursor (keyboard navigation)
    if (cursor) {
      renderCursor(ctx, cursor, pixelWidth, pixelHeight)
    }

    // Draw hover highlight (if different from cursor)
    const shouldShowHover =
      hoveredPixel &&
      (!cursor || hoveredPixel.x !== cursor.x || hoveredPixel.y !== cursor.y)

    if (shouldShowHover) {
      renderHover(ctx, hoveredPixel, pixelWidth, pixelHeight)
    }
  }, [
    indexBuffer,
    width,
    height,
    pixelWidth,
    pixelHeight,
    gridVisible,
    cursor,
    hoveredPixel,
    canvasWidth,
    canvasHeight,
    minPixelSize,
    getLinePalette
  ])

  return (
    <div ref={containerRef} className={styles.container}>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className={styles.canvas}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      />
    </div>
  )
})
