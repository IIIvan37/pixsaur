import type { Vector } from './pixsaur-color/src/type'

// CPC Modes
export type CPCMode = 'mode0' | 'mode1' | 'mode2'

// CPC Hardware Types
export enum CPCHardware {
  CLASSIC = 'classic',
  PLUS = 'plus'
}

// CPC Color (Classic 27 colors)
export interface CPCColor {
  index: number
  name: string
  hex: string
  vector: Vector
}

// CPC Plus Color (4096 possible colors)
export interface CPCPlusColor {
  index: number
  r: number // 0-15 (4-bit)
  g: number // 0-15 (4-bit)
  b: number // 0-15 (4-bit)
  vector: Vector // RGB values [0-255]
}

// CPC Palette
export type CPCPalette = CPCColor[]
export type CPCPlusPalette = CPCPlusColor[]

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
