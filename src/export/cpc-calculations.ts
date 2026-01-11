/**
 * CPC Calculations
 *
 * Re-exports CPC calculation functions from the domain layer for backward compatibility.
 * New code should import directly from '@/domain/cpc'.
 */

import type { PixelMode } from '@/app/store/config/types'

// Re-export quantization functions from domain layer
export { quantifyToCPCPlus, quantizeCPC } from '@/domain/cpc'

export function getWidthStepForMode(mode: PixelMode): number {
  if (mode === 0) return 4
  if (mode === 1) return 8
  return 16
}

export function getAspectRatioMultipliers(mode: number): {
  widthMultiplier: number
  heightMultiplier: number
} {
  return {
    widthMultiplier: mode === 0 ? 2 : 1,
    heightMultiplier: mode === 2 ? 2 : 1
  }
}

export function getPixelsPerByte(mode: PixelMode): number {
  if (mode === 0) return 2
  if (mode === 1) return 4
  return 8
}
