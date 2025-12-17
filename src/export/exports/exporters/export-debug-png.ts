/**
 * Debug PNG Export - Reconstructs image from indexBuffer + palette + rasterChanges
 * This validates that the exported data is correct by rebuilding the image.
 */
import type JSZip from 'jszip'
import type { CpcModeConfig } from '@/app/store/config/types'
import type { RasterChange } from '@/libs/pixsaur-raster/types'

/**
 * Quantize RGB to CPC Plus 12-bit format for accurate comparison
 */
function quantizeToCPCPlus(
  r: number,
  g: number,
  b: number
): [number, number, number] {
  const quantize = (v: number) => Math.round(v / 17) * 17
  return [quantize(r), quantize(g), quantize(b)]
}

/**
 * Export a debug PNG WITHOUT rasters - just indexBuffer + base palette
 * This shows what the CPC displays without rasters: slots 0-3 are BLACK
 */
async function exportDebugPNGWithoutRasters(
  zip: JSZip,
  indexBuffer: Uint8Array,
  width: number,
  height: number,
  basePalette: Array<[number, number, number]>,
  modeConfig: CpcModeConfig
): Promise<void> {
  // Quantize palette to CPC Plus, with slots 0-3 set to BLACK (as on CPC without rasters)
  const palette: Array<[number, number, number]> = basePalette.map(
    ([r, g, b], index) => {
      // Slots 0-3 are raster slots - they are BLACK without rasters
      if (index < 4) {
        return [0, 0, 0] as [number, number, number]
      }
      return quantizeToCPCPlus(r, g, b)
    }
  )

  // Create output image with CPC aspect ratio correction
  const scaleX = modeConfig.scaleX
  const scaleY = modeConfig.scaleY
  const outputWidth = width * scaleX
  const outputHeight = height * scaleY

  const imageData = new Uint8ClampedArray(outputWidth * outputHeight * 4)

  // Process each pixel using ONLY base palette (no rasters)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = y * width + x
      const paletteIdx = indexBuffer[srcIdx]

      let r = 0,
        g = 0,
        b = 0
      if (paletteIdx < palette.length) {
        ;[r, g, b] = palette[paletteIdx]
      }

      // Write to output with scaling
      for (let sy = 0; sy < scaleY; sy++) {
        for (let sx = 0; sx < scaleX; sx++) {
          const outX = x * scaleX + sx
          const outY = y * scaleY + sy
          const outIdx = (outY * outputWidth + outX) * 4
          imageData[outIdx] = r
          imageData[outIdx + 1] = g
          imageData[outIdx + 2] = b
          imageData[outIdx + 3] = 255
        }
      }
    }
  }

  // Encode to PNG
  const canvas = new OffscreenCanvas(outputWidth, outputHeight)
  const ctx = canvas.getContext('2d')!
  const imgData = new ImageData(imageData, outputWidth, outputHeight)
  ctx.putImageData(imgData, 0, 0)

  const blob = await canvas.convertToBlob({ type: 'image/png' })
  const arrayBuffer = await blob.arrayBuffer()

  zip.file('debug_NO_rasters.png', arrayBuffer)
}

/**
 * Export a debug PNG that reconstructs the image from indexBuffer + palette + rasters.
 * This helps validate that the export data is correct.
 */
export async function exportDebugPNG(
  zip: JSZip,
  indexBuffer: Uint8Array,
  width: number,
  height: number,
  basePalette: Array<[number, number, number]>,
  rasterChanges: RasterChange[],
  modeConfig: CpcModeConfig
): Promise<void> {
  // Also export version WITHOUT rasters for comparison
  await exportDebugPNGWithoutRasters(
    zip,
    indexBuffer,
    width,
    height,
    basePalette,
    modeConfig
  )

  // Group raster changes by line
  const changesByLine = new Map<number, RasterChange[]>()
  for (const change of rasterChanges) {
    const existing = changesByLine.get(change.line) || []
    existing.push(change)
    changesByLine.set(change.line, existing)
  }

  // Initialize current palette from base (quantized to CPC Plus)
  const currentPalette: Array<[number, number, number]> = basePalette.map(
    ([r, g, b]) => quantizeToCPCPlus(r, g, b)
  )

  // Create output image with CPC aspect ratio correction
  const scaleX = modeConfig.scaleX
  const scaleY = modeConfig.scaleY
  const outputWidth = width * scaleX
  const outputHeight = height * scaleY

  const imageData = new Uint8ClampedArray(outputWidth * outputHeight * 4)

  // Process each line
  for (let y = 0; y < height; y++) {
    // Apply raster changes for this line BEFORE rendering
    const lineChanges = changesByLine.get(y)
    if (lineChanges) {
      for (const change of lineChanges) {
        if (change.inkIndex < currentPalette.length) {
          currentPalette[change.inkIndex] = quantizeToCPCPlus(
            change.color[0],
            change.color[1],
            change.color[2]
          )
        }
      }
    }

    // Render this line using current palette
    for (let x = 0; x < width; x++) {
      const srcIdx = y * width + x
      const paletteIdx = indexBuffer[srcIdx]

      let r = 0,
        g = 0,
        b = 0
      if (paletteIdx < currentPalette.length) {
        ;[r, g, b] = currentPalette[paletteIdx]
      }

      // Write to output with scaling
      for (let sy = 0; sy < scaleY; sy++) {
        for (let sx = 0; sx < scaleX; sx++) {
          const outX = x * scaleX + sx
          const outY = y * scaleY + sy
          const outIdx = (outY * outputWidth + outX) * 4
          imageData[outIdx] = r
          imageData[outIdx + 1] = g
          imageData[outIdx + 2] = b
          imageData[outIdx + 3] = 255
        }
      }
    }
  }

  // Encode to PNG
  const canvas = new OffscreenCanvas(outputWidth, outputHeight)
  const ctx = canvas.getContext('2d')!
  const imgData = new ImageData(imageData, outputWidth, outputHeight)
  ctx.putImageData(imgData, 0, 0)

  const blob = await canvas.convertToBlob({ type: 'image/png' })
  const arrayBuffer = await blob.arrayBuffer()

  zip.file('debug_WITH_rasters.png', arrayBuffer)

  // Also export some debug info
  const debugInfo = [
    `Debug Raster Reconstruction`,
    `===========================`,
    `Image dimensions: ${width}x${height}`,
    `Output dimensions: ${outputWidth}x${outputHeight} (scaled ${scaleX}x${scaleY})`,
    `Mode: ${modeConfig.mode}`,
    `Overscan: ${modeConfig.overscan}`,
    `Index buffer size: ${indexBuffer.length}`,
    `Raster changes: ${rasterChanges.length}`,
    `Lines with changes: ${changesByLine.size}`,
    ``,
    `Base palette (all 16 slots):`,
    ...basePalette.map((c, i) => `  Ink ${i}: RGB(${c[0]}, ${c[1]}, ${c[2]})`),
    ``,
    `First 20 raster changes:`,
    ...rasterChanges
      .slice(0, 20)
      .map(
        (c) =>
          `  Line ${c.line}, Ink ${c.inkIndex}: RGB(${c.color[0]}, ${c.color[1]}, ${c.color[2]})`
      ),
    ``,
    `Index buffer distribution (all 16 values):`,
    ...Array.from({ length: 16 }, (_, i) => {
      const count = indexBuffer.filter((v) => v === i).length
      const percent = ((count / indexBuffer.length) * 100).toFixed(1)
      return `  Index ${i}: ${count} pixels (${percent}%)`
    })
  ].join('\n')

  zip.file('debug_raster_info.txt', debugInfo)
}
