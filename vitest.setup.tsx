import '@testing-library/jest-dom'

global.ImageData =
  global.ImageData ||
  class {
    width: number
    height: number
    data: Uint8ClampedArray
    constructor(width: number, height: number) {
      this.width = width
      this.height = height
      this.data = new Uint8ClampedArray(width * height * 4)
    }
  }
