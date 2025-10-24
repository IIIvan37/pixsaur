import '@testing-library/jest-dom'
import { vi } from 'vitest'

globalThis.ImageData =
  globalThis.ImageData ||
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

// Mock canvas context for tests
if (typeof HTMLCanvasElement !== 'undefined') {
  // @ts-expect-error - Mock for testing
  HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
    if (contextType === '2d') {
      return {
        fillStyle: '',
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        getImageData: vi.fn((_x, _y, w, h) => new ImageData(w, h)),
        putImageData: vi.fn(),
        drawImage: vi.fn(),
        createImageData: vi.fn((w, h) => new ImageData(w, h)),
        canvas: {
          width: 0,
          height: 0
        },
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      } as unknown as CanvasRenderingContext2D
    }
    return null
  })
}
