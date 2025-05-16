import { Vector } from './pixsaur-color/src/type'

// CPC Modes
export type CPCMode = 'mode0' | 'mode1' | 'mode2'

// CPC Color
export interface CPCColor {
  index: number
  name: string
  hex: string
  vector: Vector
}

// CPC Palette
export type CPCPalette = CPCColor[]

// Image Adjustments
export interface ImageAdjustments {
  red: number
  green: number
  blue: number
  brightness: number
  contrast: number
  saturation: number
}

// Selection Rectangle
export interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}

// Pixsaur Settings
export interface PixsaurSettings {
  cpcMode: CPCMode
  dithering: number
  quantizationStrength: number
  showAnimation: boolean
  lockedColors: number[]
  imageAdjustments: ImageAdjustments
}
