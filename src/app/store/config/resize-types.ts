/**
 * Resize Types for Pixsaur
 * Based on ConvImgCpc resize system
 */

/**
 * CPC mode type (0, 1, or 2)
 */
export type CPCMode = 0 | 1 | 2

/**
 * Resize modes for transforming selection to output
 */
export type ResizeMode =
  | 'fit' // Stretch to fill target dimensions
  | 'keepSmaller' // Fit inside target (letterbox/pillarbox)
  | 'keepLarger' // Fill target (crop excess)
  | 'userSize' // Custom position & size (advanced)
  | 'origin' // Keep original selection size

/**
 * Resize configuration
 */
export interface ResizeConfig {
  mode: ResizeMode
  targetWidth: number // Output width in CPC pixels (must be multiple of 8 for mode 0, 4 for mode 1, 2 for mode 2)
  targetHeight: number // Output height in CPC pixels (must be even)
  customPosition?: { x: number; y: number } // For userSize mode
  customSize?: { width: number; height: number } // For userSize mode
}

/**
 * Memory validation result
 */
export interface MemoryValidation {
  valid: boolean
  bytes: number
  kb: number
  message?: string
}

/**
 * Calculate memory usage for CPC screen
 * @param width Output width
 * @param height Output height
 * @param mode CPC mode (0, 1, or 2)
 * @returns Memory validation result
 */
export function validateCPCMemory(
  width: number,
  height: number,
  mode: CPCMode
): MemoryValidation {
  // Mode 0: 4 pixels per byte (0.25 bytes/pixel)
  // Mode 1: 2 pixels per byte (0.5 bytes/pixel)
  // Mode 2: 1 pixel per byte (1 byte/pixel)
  let bytesPerPixel: number
  if (mode === 0) {
    bytesPerPixel = 0.25
  } else if (mode === 1) {
    bytesPerPixel = 0.5
  } else {
    bytesPerPixel = 1
  }

  const bytes = width * height * bytesPerPixel
  const kb = bytes / 1024

  // CPC memory limits
  const MAX_MEMORY = 64 * 1024 // 64 Ko
  const STANDARD_MEMORY = 16 * 1024 // 16 Ko (common config)

  if (bytes > MAX_MEMORY) {
    return {
      valid: false,
      bytes,
      kb,
      message: `Exceeds 64Ko limit (${kb.toFixed(2)} Ko)`
    }
  }

  if (bytes > STANDARD_MEMORY) {
    return {
      valid: true,
      bytes,
      kb,
      message: `Warning: ${kb.toFixed(2)} Ko (> 16Ko standard)`
    }
  }

  return {
    valid: true,
    bytes,
    kb,
    message: `${kb.toFixed(2)} Ko / 64 Ko`
  }
}

/**
 * Validate width constraints for CPC modes
 * Mode 0: Multiple of 8
 * Mode 1: Multiple of 4
 * Mode 2: Multiple of 2
 */
export function validateWidthForMode(
  width: number,
  mode: CPCMode
): { valid: boolean; message?: string } {
  let multiple: number
  if (mode === 0) {
    multiple = 8
  } else if (mode === 1) {
    multiple = 4
  } else {
    multiple = 2
  }

  if (width % multiple !== 0) {
    return {
      valid: false,
      message: `Width must be multiple of ${multiple} for mode ${mode}`
    }
  }

  return { valid: true }
}

/**
 * Validate height (must be even for all modes)
 */
export function validateHeight(height: number): {
  valid: boolean
  message?: string
} {
  if (height % 2 !== 0) {
    return {
      valid: false,
      message: 'Height must be even'
    }
  }

  return { valid: true }
}

/**
 * Get default target dimensions for CPC mode
 */
export function getDefaultTargetSize(mode: CPCMode): {
  width: number
  height: number
} {
  switch (mode) {
    case 0:
      return { width: 160, height: 200 } // Mode 0: 160×200
    case 1:
      return { width: 320, height: 200 } // Mode 1: 320×200
    case 2:
      return { width: 640, height: 200 } // Mode 2: 640×200
  }
}

/**
 * CPC preset configurations
 */
export const CPC_PRESETS = {
  mode0: [
    { name: 'Standard', width: 160, height: 200 },
    { name: 'Overscan', width: 192, height: 272 }
  ],
  mode1: [
    { name: 'Standard', width: 320, height: 200 },
    { name: 'Overscan', width: 384, height: 272 }
  ],
  mode2: [
    { name: 'Standard', width: 640, height: 200 },
    { name: 'Overscan', width: 768, height: 272 }
  ]
} as const
