/**
 * Validation utilities for CPC custom dimensions
 *
 * CPC Hardware Constraints:
 * - Width must be aligned to mode-specific boundaries (4/8/16 pixels)
 * - Width in bytes (width / pixelsPerByte) must be even
 * - Height must be multiple of 8 (CPC interlacing)
 * - Total memory must not exceed 64 Ko
 */

/** CPC mode number */
export type CpcMode = 0 | 1 | 2

export interface ValidationResult {
  valid: boolean
  bytes: number
  kb: number
  errors: string[]
}

/**
 * Validates custom dimensions for a CPC mode
 *
 * @param width - Image width in pixels
 * @param height - Image height in lines
 * @param mode - CPC mode (0, 1, or 2)
 * @returns Validation result with memory calculations and error messages
 *
 * @example
 * ```typescript
 * const result = validateCustomDimensions(164, 248, 0)
 * if (result.valid) {
 *   console.log(`${result.kb.toFixed(2)} Ko`)
 * } else {
 *   console.error(result.errors.join(', '))
 * }
 * ```
 */
export function validateCustomDimensions(
  width: number,
  height: number,
  mode: CpcMode
): ValidationResult {
  const errors: string[] = []

  // Mode-specific constraints
  const widthStep = getWidthStep(mode)
  const pixelsPerByte = [2, 4, 8][mode] // Mode 0=2px/byte, Mode 1=4px/byte, Mode 2=8px/byte

  // 1. Width must be multiple of widthStep (4, 8, or 16)
  if (width % widthStep !== 0) {
    errors.push(`Largeur doit être multiple de ${widthStep}`)
  }

  // 2. Width in bytes must be even
  const widthInBytes = width / pixelsPerByte
  if (widthInBytes % 2 !== 0) {
    errors.push(`Largeur en octets (${widthInBytes}) doit être paire`)
  }

  // 3. Height must be multiple of 8
  if (height % 8 !== 0) {
    errors.push('Hauteur doit être multiple de 8')
  }

  // 4. Calculate total memory
  const totalBytes = widthInBytes * height
  const totalKb = totalBytes / 1024

  // 5. Check 64Ko limit
  if (totalBytes > 65536) {
    errors.push(`Mémoire ${totalKb.toFixed(2)} Ko dépasse 64 Ko`)
  }

  return {
    valid: errors.length === 0,
    bytes: totalBytes,
    kb: totalKb,
    errors
  }
}

/**
 * Gets the width step constraint for a CPC mode
 *
 * @param mode - CPC mode (0, 1, or 2)
 * @returns Width step (4, 8, or 16)
 */
export function getWidthStep(mode: CpcMode): number {
  return [4, 8, 16][mode]
}

/**
 * Gets the height step constraint (always 8 for CPC)
 *
 * @returns Height step (8)
 */
export function getHeightStep(): number {
  return 8
}
