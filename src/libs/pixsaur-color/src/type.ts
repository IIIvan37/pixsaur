export type ColorSpace = 'RGB' | 'Lab' | 'XYZ'

export interface ColorVectorMap {
  RGB: [r: number, g: number, b: number]
  Lab: [L: number, a: number, b: number]
  XYZ: [X: number, Y: number, Z: number]
}

export type Vector<CS extends ColorSpace = ColorSpace> = ColorVectorMap[CS]
