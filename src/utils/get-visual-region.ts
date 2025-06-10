// 📁 utils/image/getVisualRegionNormalized.ts
import { CPC_MODE_CONFIG, CpcModeKey } from '@/app/store/config/types'
import { Selection } from '@/libs/pixsaur-adapter/io/downscale-image'

/**
 * Extracts and scales a rectangular region from an ImageData source.
 * The region is uniformly scaled to fit within `targetW × 200`, preserving aspect ratio.
 * Pixel shape correction is applied according to the CPC mode to match display proportions.
 *
 * The result is centered in a canvas of fixed size `targetW × 200`.
 *
 * @param src       The full source ImageData
 * @param selection The region to extract (sx, sy, width, height)
 * @param targetW   The desired width of the final canvas (based on CPC mode)
 * @param mode      The CPC mode: 0, 1, or 2 (for aspect ratio correction)
 * @returns         A new ImageData of size targetW × 200 with centered, corrected scaled region
 */
export function getVisualRegion(
  src: ImageData,
  selection: Selection
): ImageData {
  const { sx, sy, width: sw, height: sh } = selection
  // Step 1 — Extract the selected region
  const extractCanvas = document.createElement('canvas')
  extractCanvas.width = src.width
  extractCanvas.height = src.height
  const extractCtx = extractCanvas.getContext('2d')!
  extractCtx.imageSmoothingEnabled = true // pas de lissage
  extractCtx.putImageData(src, 0, 0)
  return extractCtx.getImageData(sx, sy, sw, sh)
}

export function getVisualRegionNormalized(src: ImageData, mode: CpcModeKey) {
  const modeConfig = CPC_MODE_CONFIG[mode]
  const targetW = modeConfig.width
  const targetH = modeConfig.height
  // Step 2 — Compute the CPC pixel aspect ratio (used for visual correction)
  const pixelAspectRatio = {
    0: 2 / 1, // Mode 0: wide pixels
    1: 1 / 1, // Mode 1: square pixels
    2: 1 / 2 // Mode 2: tall pixels
  }[modeConfig.mode]
  // Step 3 — Compute the uniform scale factor considering aspect correction
  const correctedH = src.height * pixelAspectRatio
  const scale = Math.min(targetW / src.width, targetH / correctedH)
  const scaledW = Math.round(src.width * scale)
  const scaledH = Math.round(src.height * scale * pixelAspectRatio)
  if (scaledW === 0 || scaledH === 0) {
    console.warn('Skipped: scaled dimensions are zero', scaledW, scaledH)
    return new ImageData(targetW, targetH) // image noire
  }
  // Step 4 — Resize the selection to scaledW × scaledH
  const scaledCanvas = document.createElement('canvas')
  scaledCanvas.width = scaledW
  scaledCanvas.height = scaledH
  const scaledCtx = scaledCanvas.getContext('2d')!
  scaledCtx.imageSmoothingEnabled = true

  const regionCanvas = document.createElement('canvas')
  regionCanvas.width = src.width
  regionCanvas.height = src.height
  regionCanvas.getContext('2d')!.putImageData(src, 0, 0)

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
