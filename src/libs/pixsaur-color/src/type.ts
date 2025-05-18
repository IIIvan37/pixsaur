export type ColorSpace = 'RGB' | 'Lab' | 'XYZ'

export interface ColorVectorMap {
  RGB: [r: number, g: number, b: number] | Float32Array
  Lab: [L: number, a: number, b: number] | Float32Array
  XYZ: [X: number, Y: number, Z: number] | Float32Array
}

export type Vector<CS extends ColorSpace = ColorSpace> = ColorVectorMap[CS]
