export type ColorSpace = 'RGB'

export interface ColorVectorMap {
  RGB: [r: number, g: number, b: number] | Float32Array
}

export type Vector<CS extends ColorSpace = ColorSpace> = ColorVectorMap[CS]
