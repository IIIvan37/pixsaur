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

  // Initialize counts for all palette colors
  for (const color of palette) {
    if (color) {
      const hex = rgbToHex(color)
      occurrences.set(hex, 0)
    }
  }

  // Count pixels
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const hex = `${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`

    if (occurrences.has(hex)) {
      occurrences.set(hex, (occurrences.get(hex) || 0) + 1)
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
