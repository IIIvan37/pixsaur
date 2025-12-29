import type { Vector } from './pixsaur-color/src/type'

// CPC Modes
export type CPCMode = 'mode0' | 'mode1' | 'mode2'

// CPC Hardware Types
export enum CPCHardware {
  CLASSIC = 'classic',
  PLUS = 'plus',
  MODE_R = 'mode-r' // Mode R: interlaced palettes for doubled resolution
}

// Mode R specific types
export interface ModeRPair {
  indexA: number // Palette A color index (0-15)
  indexB: number // Palette B color index (0-15)
  colorA: Vector // Color in frame A
  colorB: Vector // Color in frame B
  blendedColor: Vector // Perceived blended color
  flickerScore: number // Lower = less flicker (based on luminance difference)
}

export interface ModeRPalettes {
  paletteA: Vector[] // 16 colors for frame A
  paletteB: Vector[] // 16 colors for frame B
  pairs: ModeRPair[] // 16 pairs defining the perceived colors
}

export interface ModeRConfig {
  antiFlickerWeight: number // 0-100: priority for reducing flicker vs color accuracy
  maxLuminanceDelta: number // Maximum luminance difference for pairs (anti-flicker)
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
