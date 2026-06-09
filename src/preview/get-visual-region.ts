// Copied from previous utils implementation
import type { CpcModeConfig } from '@/app/store/config/types'
import type { Selection } from '@/libs/pixsaur-adapter/io/downscale-image'
import {
  type ResampleFilter,
  resampleLinear
} from './image-processing/horizontal-resample'

export function getVisualRegion(
  src: ImageData,
  selection: Selection
): ImageData {
  const { sx, sy, width: sw, height: sh } = selection
  const extractCanvas = document.createElement('canvas')
  extractCanvas.width = src.width
  extractCanvas.height = src.height
  const extractCtx = extractCanvas.getContext('2d')!
  extractCtx.imageSmoothingEnabled = true
  extractCtx.putImageData(src, 0, 0)
  return extractCtx.getImageData(sx, sy, sw, sh)
}

export function getVisualRegionNormalized(
  src: ImageData,
  modeConfig: CpcModeConfig,
  filter?: ResampleFilter
): ImageData | null {
  const targetW = modeConfig.width
  const targetH = modeConfig.height
  const pixelAspectRatio = {
    0: 2 / 1,
    1: 1,
    2: 1 / 2
  }[modeConfig.mode]

  const correctedH = src.height * pixelAspectRatio
  const scale = Math.min(targetW / src.width, targetH / correctedH)
  const scaledW = Math.round(src.width * scale)
  const scaledH = Math.round(src.height * scale * pixelAspectRatio)
  if (scaledW === 0 || scaledH === 0) return null

  // Linear-light scale-to-fit when a filter is provided (all pixel modes).
  // Without a filter, fall back to the legacy canvas path below.
  if (filter) {
    return resampleLinear(src, scaledW, scaledH, filter)
  }

  const scaledCanvas = document.createElement('canvas')
  scaledCanvas.width = scaledW
  scaledCanvas.height = scaledH
  const scaledCtx = scaledCanvas.getContext('2d')!
  scaledCtx.imageSmoothingEnabled = true

  const regionCanvas = document.createElement('canvas')
  regionCanvas.width = src.width
  regionCanvas.height = src.height
  const regionCanvasCtx = regionCanvas.getContext('2d')!
  regionCanvasCtx.imageSmoothingEnabled = true
  regionCanvasCtx.putImageData(src, 0, 0)

  scaledCtx.drawImage(
    regionCanvas,
    0,
    0,
    src.width,
    src.height,
    0,
    0,
    scaledW,
    scaledH
  )

  return scaledCtx.getImageData(0, 0, scaledW, scaledH)
}
