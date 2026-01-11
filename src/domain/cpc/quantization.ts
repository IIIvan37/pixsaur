/**
 * CPC Color Quantization
 *
 * Centralized quantization functions for CPC Classic and CPC Plus hardware.
 * These functions convert 8-bit RGB values to the appropriate CPC color space.
 */

import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { CPCHardware } from '@/libs/types'

// CPC Classic color levels (3 levels per component: 0, 128, 255)
const CPC_CLASSIC_LEVELS = [0, 128, 255] as const

/**
 * Quantize a single RGB component value to CPC Classic levels (0, 128, 255)
 *
 * @param value - RGB component value (0-255)
 * @returns Nearest CPC Classic level
 */
export function quantizeCPC(value: number): number {
  const clampedValue = Math.max(0, Math.min(255, value))
  return CPC_CLASSIC_LEVELS.reduce(
    (prev, curr) =>
      Math.abs(curr - clampedValue) < Math.abs(prev - clampedValue)
        ? curr
        : prev,
    CPC_CLASSIC_LEVELS[0]
  )
}

/**
 * Quantize a single RGB component value to CPC Plus levels (16 levels, 4-bit)
 *
 * @param value - RGB component value (0-255)
 * @returns Nearest CPC Plus level (mapped back to 0-255 range)
 */
export function quantifyToCPCPlus(value: number): number {
  const clampedValue = Math.max(0, Math.min(255, value))
  const val4bit = Math.round((clampedValue / 255) * 15)
  return Math.round((val4bit / 15) * 255)
}

/**
 * Convert 8-bit RGB value to 4-bit CPC Plus level (0-15)
 *
 * @param value - RGB component value (0-255)
 * @returns CPC Plus 4-bit level (0-15)
 */
export function toCPCPlusLevel(value: number): number {
  const clamped = Math.max(0, Math.min(255, value))
  return Math.round((clamped / 255) * 15)
}

/**
 * Quantize an RGB color vector for CPC Classic (27 colors)
 *
 * @param color - RGB color vector [r, g, b]
 * @returns Quantized color vector
 */
export function quantizeColorCPCClassic(color: Vector): Vector {
  return [quantizeCPC(color[0]), quantizeCPC(color[1]), quantizeCPC(color[2])]
}

/**
 * Quantize an RGB color vector for CPC Plus (4096 colors)
 *
 * @param color - RGB color vector [r, g, b]
 * @returns Quantized color vector
 */
export function quantizeColorCPCPlus(color: Vector): Vector {
  return [
    quantifyToCPCPlus(color[0]),
    quantifyToCPCPlus(color[1]),
    quantifyToCPCPlus(color[2])
  ]
}

/**
 * Quantize an RGB color vector based on the target hardware
 *
 * @param color - RGB color vector [r, g, b]
 * @param hardware - Target CPC hardware ('classic' or 'plus')
 * @returns Quantized color vector
 */
export function quantizeColorForHardware(
  color: Vector,
  hardware: CPCHardware
): Vector {
  return hardware === 'classic'
    ? quantizeColorCPCClassic(color)
    : quantizeColorCPCPlus(color)
}

/**
 * Quantize an array of colors in-place for CPC Classic
 * Optionally skips colors that match the locked color keys
 *
 * @param colors - Array of color vectors to quantize (mutated in-place)
 * @param lockedColorKeys - Set of "r,g,b" strings to skip
 */
export function quantizeArrayCPCClassic(
  colors: Vector[],
  lockedColorKeys: Set<string> = new Set()
): void {
  for (const color of colors) {
    const colorKey = `${color[0]},${color[1]},${color[2]}`
    if (lockedColorKeys.has(colorKey)) continue

    color[0] = quantizeCPC(color[0])
    color[1] = quantizeCPC(color[1])
    color[2] = quantizeCPC(color[2])
  }
}

/**
 * Quantize an array of colors in-place for CPC Plus
 * Optionally skips colors that match the locked color keys
 *
 * @param colors - Array of color vectors to quantize (mutated in-place)
 * @param lockedColorKeys - Set of "r,g,b" strings to skip
 */
export function quantizeArrayCPCPlus(
  colors: Vector[],
  lockedColorKeys: Set<string> = new Set()
): void {
  for (const color of colors) {
    const colorKey = `${color[0]},${color[1]},${color[2]}`
    if (lockedColorKeys.has(colorKey)) continue

    color[0] = quantifyToCPCPlus(color[0])
    color[1] = quantifyToCPCPlus(color[1])
    color[2] = quantifyToCPCPlus(color[2])
  }
}

/**
 * Quantize an array of colors in-place based on hardware
 *
 * @param colors - Array of color vectors to quantize (mutated in-place)
 * @param hardware - Target CPC hardware
 * @param lockedColorKeys - Set of "r,g,b" strings to skip
 */
export function quantizeArrayForHardware(
  colors: Vector[],
  hardware: CPCHardware,
  lockedColorKeys: Set<string> = new Set()
): void {
  if (hardware === 'classic') {
    quantizeArrayCPCClassic(colors, lockedColorKeys)
  } else {
    quantizeArrayCPCPlus(colors, lockedColorKeys)
  }
}
