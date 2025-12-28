import { Trans } from '@lingui/react/macro'
import { useCallback, useEffect, useRef } from 'react'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import styles from './editor-minimap.module.css'

type ViewportRect = {
  x: number
  y: number
  width: number
  height: number
}

export type EditorMinimapViewProps = Readonly<{
  indexBuffer: Uint8Array
  width: number
  height: number
  pixelAspect: { widthMultiplier: number; heightMultiplier: number }
  viewportRect: ViewportRect
  getLinePalette: (line: number) => Vector<'RGB'>[]
  onMinimapClick: (normalizedX: number, normalizedY: number) => void
}>

// Maximum minimap size in pixels
const MAX_MINIMAP_WIDTH = 200
const MAX_MINIMAP_HEIGHT = 150

/**
 * Dumb component for the editor minimap.
 * Displays a thumbnail of the full image with viewport indicator.
 */
export function EditorMinimapView({
  indexBuffer,
  width,
  height,
  pixelAspect,
  viewportRect,
  getLinePalette,
  onMinimapClick
}: EditorMinimapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Calculate minimap dimensions preserving aspect ratio
  const imageAspect =
    (width * pixelAspect.widthMultiplier) /
    (height * pixelAspect.heightMultiplier)

  let minimapWidth: number
  let minimapHeight: number

  if (imageAspect > MAX_MINIMAP_WIDTH / MAX_MINIMAP_HEIGHT) {
    // Image is wider than container
    minimapWidth = MAX_MINIMAP_WIDTH
    minimapHeight = MAX_MINIMAP_WIDTH / imageAspect
  } else {
    // Image is taller than container
    minimapHeight = MAX_MINIMAP_HEIGHT
    minimapWidth = MAX_MINIMAP_HEIGHT * imageAspect
  }

  // Render the minimap
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, minimapWidth, minimapHeight)

    // Calculate scale factors
    const scaleX = minimapWidth / width
    const scaleY = minimapHeight / height

    // Render pixels (simplified - 1 pixel per image pixel)
    for (let y = 0; y < height; y++) {
      const palette = getLinePalette(y)
      for (let x = 0; x < width; x++) {
        const inkIndex = indexBuffer[y * width + x]
        const color = palette[inkIndex] ?? [0, 0, 0]
        ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`

        // Draw pixel scaled to minimap size
        const px = Math.floor(x * scaleX)
        const py = Math.floor(y * scaleY)
        const pw = Math.ceil(scaleX) || 1
        const ph = Math.ceil(scaleY) || 1
        ctx.fillRect(px, py, pw, ph)
      }
    }

    // Draw viewport rectangle
    const vpX = viewportRect.x * minimapWidth
    const vpY = viewportRect.y * minimapHeight
    const vpW = Math.min(viewportRect.width, 1) * minimapWidth
    const vpH = Math.min(viewportRect.height, 1) * minimapHeight

    // Always draw the viewport indicator
    // Semi-transparent dark overlay outside viewport
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'

    // Top
    if (vpY > 0) {
      ctx.fillRect(0, 0, minimapWidth, vpY)
    }
    // Bottom
    if (vpY + vpH < minimapHeight) {
      ctx.fillRect(0, vpY + vpH, minimapWidth, minimapHeight - vpY - vpH)
    }
    // Left
    if (vpX > 0) {
      ctx.fillRect(0, vpY, vpX, vpH)
    }
    // Right
    if (vpX + vpW < minimapWidth) {
      ctx.fillRect(vpX + vpW, vpY, minimapWidth - vpX - vpW, vpH)
    }

    // Viewport border - bright yellow with glow effect
    ctx.shadowColor = '#ffcc00'
    ctx.shadowBlur = 4
    ctx.strokeStyle = '#ffcc00'
    ctx.lineWidth = 2
    ctx.strokeRect(vpX + 1, vpY + 1, Math.max(vpW - 2, 4), Math.max(vpH - 2, 4))

    // Inner white border for better contrast
    ctx.shadowBlur = 0
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.lineWidth = 1
    ctx.strokeRect(vpX + 2, vpY + 2, Math.max(vpW - 4, 2), Math.max(vpH - 4, 2))
  }, [
    indexBuffer,
    width,
    height,
    minimapWidth,
    minimapHeight,
    viewportRect,
    getLinePalette
  ])

  // Handle click on minimap
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      // Use rect.width/height (CSS display size) instead of minimapWidth/Height (canvas internal size)
      // This ensures correct coordinates even if the canvas is scaled by CSS
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top) / rect.height

      onMinimapClick(x, y)
    },
    [onMinimapClick]
  )

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Trans>Navigation</Trans>
      </div>
      <canvas
        ref={canvasRef}
        width={minimapWidth}
        height={minimapHeight}
        className={styles.canvas}
        onClick={handleClick}
        title='Cliquer pour naviguer'
      />
    </div>
  )
}
