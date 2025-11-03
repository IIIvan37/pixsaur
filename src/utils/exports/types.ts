/**
 * Export configuration types for Pixsaur
 * Based on ConvImgCpc export system analysis
 */

/**
 * Output format for exports
 */
export type OutputFormat =
  | 'scr-binary' // Standard SCR file (AMSDOS header + pixels)
  | 'asm-scr' // ASM file with SCR format data (entrelaced)
  | 'asm-linear' // ASM file with linear data (sequential)
  | 'dsk' // Disk image
  | 'png' // PNG preview

/**
 * Data format for ASM exports
 */
export type DataFormat =
  | 'scr' // CPC screen format with entrelacement (16Ko)
  | 'linear' // Linear sequential data (simpler, for custom routines)

/**
 * ASM label configuration
 */
export interface ASMLabels {
  enabled: boolean
  media: string // Label for image data (default: "ImageData")
  palette: string // Label for palette data (default: "Palette")
}

/**
 * ZIP content selection
 */
export interface ZipContentConfig {
  includeSCR: boolean // Include SCR ASM file
  includeLinear: boolean // Include Linear ASM file
  includePalettes: boolean // Include palette files (firmware/hardware for Classic, CPC+ values for Plus)
  includePNG: boolean // Include PNG preview
  includePNGCorrected: boolean // Include PNG with corrected aspect ratio
  includeDSK: boolean // Include DSK disk image with SCR + BASIC loader
}

/**
 * DSK generation options
 */
export interface DskGeneratorOptions {
  scrData: Uint8Array // SCR screen data (16KB)
  palette: number[] // CPC palette (firmware indices 0-26)
  mode: 0 | 1 | 2 // CPC graphics mode
  screenFilename?: string // Filename for .SCR on DSK (default: "IMAGE.SCR")
  basicFilename?: string // Filename for BASIC loader (default: "LOADER.BAS")
  dskFilename?: string // Output DSK filename (default: "pixsaur.dsk")
}

/**
 * Complete export configuration
 */
export interface ExportConfig {
  // ZIP content selection
  content: ZipContentConfig

  // ASM-specific options
  labels: ASMLabels

  // Code generation options (for future phases)
  // includeCode: boolean        // TODO: Phase 2 - Include display routine
  // compression: string         // TODO: Phase 2 - Compression method

  // Export metadata
  filename: string // Base filename for ZIP (without extension)
}

/**
 * Default export configuration
 */
export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  content: {
    includeSCR: true,
    includeLinear: true,
    includePalettes: true,
    includePNG: true,
    includePNGCorrected: true,
    includeDSK: false // Disabled by default (requires standard mode)
  },
  labels: {
    enabled: true,
    media: 'ImageData',
    palette: 'Palette'
  },
  filename: 'pixsaur_export'
}

/**
 * Export result type
 */
export interface ExportResult {
  success: boolean
  filename: string
  size: number // Size in bytes
  format: OutputFormat
  error?: string
}
