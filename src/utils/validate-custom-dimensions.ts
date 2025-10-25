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
  readonly valid: boolean
  readonly widthInBytes: number
  readonly bytes: number
  readonly kb: number
  readonly errors: readonly string[]
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
 *   console.log(`✅ ${result.kb.toFixed(2)} Ko`)
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

  // Pixels per byte by mode
  const pixelsPerByte = [2, 4, 8][mode]

  // Width constraint by mode
  const widthStep = [4, 8, 16][mode]

  // Validate width alignment
  if (width % widthStep !== 0) {
    errors.push(`Width must be multiple of ${widthStep} for Mode ${mode}`)
  }

  // Calculate width in bytes
  const widthInBytes = width / pixelsPerByte

  // Validate width in bytes is even
  if (widthInBytes % 2 !== 0) {
    errors.push(`Width in bytes (${widthInBytes}) must be even`)
  }

  // Validate height is multiple of 8 (CPC interlacing)
  if (height % 8 !== 0) {
    errors.push('Height must be multiple of 8 (CPC interlacing)')
  }

  // Calculate memory usage
  const bytes = height * widthInBytes
  const kb = bytes / 1024

  // Validate memory limit (64 Ko)
  if (bytes > 65536) {
    errors.push(`Memory usage ${kb.toFixed(2)} Ko exceeds 64 Ko limit`)
  }

  // Validate minimum dimensions
  if (width < widthStep) {
    errors.push(`Width must be at least ${widthStep} pixels`)
  }

  if (height < 8) {
    errors.push('Height must be at least 8 lines')
  }

  return {
    valid: errors.length === 0,
    widthInBytes,
    bytes,
    kb,
    errors: Object.freeze(errors)
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

/**
 * Calculates maximum dimensions for a given memory budget
 *
 * @param mode - CPC mode (0, 1, or 2)
 * @param maxBytes - Maximum memory in bytes (default: 65536)
 * @returns Maximum width and height that fit in memory
 *
 * @example
 * ```typescript
 * const max = getMaxDimensions(0, 16384) // 16 Ko
 * console.log(`Max: ${max.width}×${max.height}`)
 * ```
 */
export function getMaxDimensions(
  mode: CpcMode,
  maxBytes: number = 65536
): { readonly width: number; readonly height: number } {
  const pixelsPerByte = [2, 4, 8][mode]
  const widthStep = getWidthStep(mode)
  const heightStep = getHeightStep()

  // Start with maximum height (needs to be multiple of 8)
  let height = Math.floor(544 / heightStep) * heightStep // Max CPC height ~544

  // Calculate max width for this height
  while (height >= heightStep) {
    const maxWidthInBytes = Math.floor(maxBytes / height)
    // Ensure widthInBytes is even
    const widthInBytes = Math.floor(maxWidthInBytes / 2) * 2
    const width = widthInBytes * pixelsPerByte

    // Round down to width step
    const alignedWidth = Math.floor(width / widthStep) * widthStep

    if (alignedWidth >= widthStep) {
      return { width: alignedWidth, height }
    }

    height -= heightStep
  }

  // Fallback to minimum valid dimensions
  return { width: widthStep, height: heightStep }
}
