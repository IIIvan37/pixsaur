// CPC Mode represents ONLY the pixel aspect ratio
// - Mode 0: 2:1 wide pixels (160 base width, 16 colors)
// - Mode 1: 1:1 square pixels (320 base width, 4 colors)
// - Mode 2: 1:2 tall pixels (640 base width, 2 colors)
export type CpcModeKey = '0' | '1' | '2'

// Processor types for image processing
export type ProcessorType = 'auto' | 'cpu' | 'gpu'

// Contrast selection strategy for small palettes (modes 1-2)
export type ContrastStrategy = 'max' | 'balanced'

// This file defines types and constants related to CPC modes and color adjustments.
export type CpcModeConfig = {
  mode: 0 | 1 | 2
  nColors: number
  scaleX: number
  scaleY: number
}

// Extended mode config for export (includes target dimensions)
export type CpcModeConfigWithDimensions = CpcModeConfig & {
  width: number
  height: number
}

export const CPC_MODE_CONFIG: Record<CpcModeKey, CpcModeConfig> = {
  '0': {
    mode: 0,
    nColors: 16,
    scaleX: 2, // Wide pixels (2:1 aspect ratio)
    scaleY: 1
  },
  '1': {
    mode: 1,
    nColors: 4,
    scaleX: 1, // Square pixels (1:1 aspect ratio)
    scaleY: 1
  },
  '2': {
    mode: 2,
    nColors: 2,
    scaleX: 1, // Tall pixels (1:2 aspect ratio)
    scaleY: 2
  }
}

export type AdjustementKey =
  | 'red'
  | 'green'
  | 'blue'
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'posterization'
