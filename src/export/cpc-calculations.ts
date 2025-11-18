import type { PixelMode } from '@/app/store/config/types'

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

export function quantizeCPC(value: number): number {
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

export function quantifyToCPCPlus(value: number): number {
  const clampedValue = Math.max(0, Math.min(255, value))
  const val4bit = Math.round((clampedValue / 255) * 15)
  return Math.round((val4bit / 15) * 255)
}

export function getPixelsPerByte(mode: PixelMode): number {
  if (mode === 0) return 2
  if (mode === 1) return 4
  return 8
}
