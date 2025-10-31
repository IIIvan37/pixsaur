import type { PixelMode } from '@/app/store/config/types'

/**
 * Calculate width step based on pixel mode
 * Mode 0: 4 pixels per step
 * Mode 1: 8 pixels per step
 * Mode 2: 16 pixels per step
 */
export function getWidthStepForMode(mode: PixelMode): number {
  if (mode === 0) return 4
  if (mode === 1) return 8
  return 16
}

/**
 * Get aspect ratio multipliers for CPC mode display correction
 * Mode 0: 2 pixels/byte, PAR = 2.0 (wide pixels) - double width
 * Mode 1: 4 pixels/byte, PAR = 1.0 (square pixels) - no change
 * Mode 2: 8 pixels/byte, narrow pixels - double height instead
 */
export function getAspectRatioMultipliers(mode: number): {
  widthMultiplier: number
  heightMultiplier: number
} {
  return {
    widthMultiplier: mode === 0 ? 2 : 1,
    heightMultiplier: mode === 2 ? 2 : 1
  }
}

/**
 * Quantize a value to CPC Classic hardware values (0, 128, 255)
 */
export function quantizeCPC(value: number): number {
  // Clamp value to valid range [0, 255]
  const clampedValue = Math.max(0, Math.min(255, value))
  const cpcValues = [0, 128, 255]
  return cpcValues.reduce(
    (prev, curr) =>
      Math.abs(curr - clampedValue) < Math.abs(prev - clampedValue)
        ? curr
        : prev,
    cpcValues[0]
  )
}

/**
 * Quantize a value to CPC Plus format (4-bit per component)
 */
export function quantifyToCPCPlus(value: number): number {
  // Clamp value to valid range [0, 255]
  const clampedValue = Math.max(0, Math.min(255, value))
  const val4bit = Math.round((clampedValue / 255) * 15)
  return Math.round((val4bit / 15) * 255)
}

/**
 * Get pixels per byte for a given pixel mode
 * Mode 0: 2 pixels per byte
 * Mode 1: 4 pixels per byte
 * Mode 2: 8 pixels per byte
 */
export function getPixelsPerByte(mode: PixelMode): number {
  if (mode === 0) return 2 // Mode 0: 2 pixels per byte
  if (mode === 1) return 4 // Mode 1: 4 pixels per byte
  return 8 // Mode 2: 8 pixels per byte
}
