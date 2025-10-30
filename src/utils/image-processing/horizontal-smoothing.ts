/**
 * Horizontal Smoothing for CPC Image Processing
 *
 * Applies anti-aliasing by averaging pixels horizontally based on CPC pixel width.
 * Reduces the "blocky" appearance in low-resolution modes, especially Mode 0.
 *
 * Based on ConvImgCpc implementation (ConvertBase.cs:97-116)
 */

/**
 * Apply horizontal smoothing to an image based on CPC pixel width.
 *
 * @param imageData - Source image data to smooth
 * @param pixelWidth - Width of CPC pixels in source pixels (1, 2, or 4)
 *   - Mode 2 (640×200): pixelWidth = 1 (fine pixels, minimal smoothing)
 *   - Mode 1 (320×200): pixelWidth = 2 (medium pixels)
 *   - Mode 0 (160×200): pixelWidth = 4 (large pixels, maximum smoothing)
 * @returns New ImageData with horizontal smoothing applied
 */
export function applyHorizontalSmoothing(
  imageData: ImageData,
  pixelWidth: number
): ImageData {
  const { width, height, data } = imageData
  const smoothed = new ImageData(width, height)

  // No smoothing needed for pixelWidth = 1 (Mode 2)
  if (pixelWidth <= 1) {
    smoothed.data.set(data)
    return smoothed
  }

  // Apply horizontal averaging
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const destIdx = (y * width + x) * 4

      // Calculate horizontal sampling range centered on current pixel
      // For pixelWidth=4: take 2 pixels left + current + 1 pixel right = 4 pixels
      // For pixelWidth=2: take current + 1 pixel right = 2 pixels
      const samplesLeft = Math.floor((pixelWidth - 1) / 2)
      const samplesRight = Math.ceil((pixelWidth - 1) / 2)

      const startX = Math.max(0, x - samplesLeft)
      const endX = Math.min(width - 1, x + samplesRight)
      const sampleCount = endX - startX + 1

      let r = 0
      let g = 0
      let b = 0
      let a = 0

      // Average pixels in horizontal range
      for (let sx = startX; sx <= endX; sx++) {
        const srcIdx = (y * width + sx) * 4
        r += data[srcIdx]
        g += data[srcIdx + 1]
        b += data[srcIdx + 2]
        a += data[srcIdx + 3]
      }

      // Write averaged color
      smoothed.data[destIdx] = Math.round(r / sampleCount)
      smoothed.data[destIdx + 1] = Math.round(g / sampleCount)
      smoothed.data[destIdx + 2] = Math.round(b / sampleCount)
      smoothed.data[destIdx + 3] = Math.round(a / sampleCount)
    }
  }

  return smoothed
}

/**
 * Get pixel width for a given CPC mode.
 *
 * @param mode - CPC mode (0, 1, or 2)
 * @returns Pixel width multiplier for horizontal smoothing
 */
export function getPixelWidthForMode(mode: number): number {
  switch (mode) {
    case 0:
      return 4 // Mode 0: 160×200, large pixels
    case 1:
      return 2 // Mode 1: 320×200, medium pixels
    default:
      return 1 // Mode 2: 640×200, fine pixels (no smoothing)
  }
}
