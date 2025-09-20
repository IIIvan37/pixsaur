import '@testing-library/jest-dom'

global.ImageData =
  global.ImageData ||
  class {
    width: number
    height: number
    data: Uint8ClampedArray

    constructor(
      dataOrWidth: Uint8ClampedArray | number,
      width?: number,
      height?: number
    ) {
      if (typeof dataOrWidth === 'number' && width !== undefined) {
        // new ImageData(width, height)
        this.width = dataOrWidth
        this.height = width
        this.data = new Uint8ClampedArray(dataOrWidth * width * 4)
      } else if (width !== undefined && height !== undefined) {
        // new ImageData(data, width, height)
        this.data = new Uint8ClampedArray(dataOrWidth as Uint8ClampedArray)
        this.width = width
        this.height = height
      } else {
        throw new Error('Invalid ImageData constructor arguments')
      }
    }
  }
