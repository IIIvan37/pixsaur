import type { Vector } from '@/libs/pixsaur-color/src/type'

/**
 * Count occurrences of each color in the image data
 * @param imageData - Preview image data
 * @param palette - Array of palette colors
 * @returns Map of color hex to occurrence count
 */
export function countColorOccurrences(
  imageData: ImageData | null,
  palette: Array<Vector<'RGB'> | null>
): Map<string, number> {
  const occurrences = new Map<string, number>()

  if (!imageData) return occurrences

  // Filter out null colors and prepare palette with hex keys
  const validPalette = palette
    .filter((c): c is Vector<'RGB'> => c !== null)
    .map((color) => ({
      color,
      hex: rgbToHex(color),
      r: Math.round(color[0]),
      g: Math.round(color[1]),
      b: Math.round(color[2])
    }))

  // Initialize counts
  for (const { hex } of validPalette) {
    occurrences.set(hex, 0)
  }

  // Count pixels by finding nearest color in palette
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // Find the closest color in palette (should be exact match since image uses palette colors)
    let minDistance = Number.POSITIVE_INFINITY
    let closestHex = ''

    for (const paletteColor of validPalette) {
      const distance =
        Math.abs(r - paletteColor.r) +
        Math.abs(g - paletteColor.g) +
        Math.abs(b - paletteColor.b)

      if (distance < minDistance) {
        minDistance = distance
        closestHex = paletteColor.hex
      }

      // Exact match, no need to continue
      if (distance === 0) break
    }

    if (closestHex) {
      occurrences.set(closestHex, (occurrences.get(closestHex) || 0) + 1)
    }
  }

  return occurrences
}

/**
 * Convert RGB vector to hex string (without #)
 */
function rgbToHex(color: Vector<'RGB'>): string {
  const [r, g, b] = color
  return `${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`
}

/**
 * Format occurrence count for display
 */
export function formatOccurrenceCount(count: number): string {
  if (count === 0) return '0 pixel'
  if (count === 1) return '1 pixel'
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M pixels`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k pixels`
  }
  return `${count} pixels`
}
