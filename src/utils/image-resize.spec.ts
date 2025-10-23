import { describe, it, expect, vi } from 'vitest'
import {
  applyResize,
  extractSelection,
  type Selection
} from './image-resize'
import type { ResizeConfig } from '@/app/store/config/resize-types'

// Mock canvas for testing (happy-dom doesn't support 2D context fully)
function createMockCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  // Mock getContext to return a minimal working context
  const originalGetContext = canvas.getContext.bind(canvas)
  vi.spyOn(canvas, 'getContext').mockImplementation((type: string) => {
    if (type === '2d') {
      return {
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({
          data: new Uint8ClampedArray([0, 0, 0, 255])
        }))
      } as any
    }
    return originalGetContext(type)
  })

  return canvas
}

describe('image-resize', () => {
  const testSelection: Selection = {
    sx: 0,
    sy: 0,
    width: 100,
    height: 100
  }

  describe('resizeAuto', () => {
    it('should create canvas with exact target dimensions matching selection', () => {
      const source = createMockCanvas(100, 100)
      const config: ResizeConfig = {
        mode: 'auto',
        targetWidth: 160,
        targetHeight: 200
      }

      const result = applyResize(source, testSelection, config)

      expect(result.width).toBe(100)
      expect(result.height).toBe(100)
    })

    it('should extract selection without transformation', () => {
      const source = createMockCanvas(100, 100)
      const config: ResizeConfig = {
        mode: 'auto',
        targetWidth: 320,
        targetHeight: 200
      }

      const result = applyResize(source, testSelection, config)

      expect(result.width).toBe(100)
      expect(result.height).toBe(100)
    })
  })

  describe('resizeKeepSmaller', () => {
    it('should create canvas with target dimensions', () => {
      const source = createMockCanvas(100, 100)
      const config: ResizeConfig = {
        mode: 'keepSmaller',
        targetWidth: 160,
        targetHeight: 200
      }

      const result = applyResize(source, testSelection, config)

      expect(result.width).toBe(160)
      expect(result.height).toBe(200)
    })
  })

  describe('resizeKeepLarger', () => {
    it('should create canvas with target dimensions', () => {
      const source = createMockCanvas(100, 100)
      const config: ResizeConfig = {
        mode: 'keepLarger',
        targetWidth: 160,
        targetHeight: 200
      }

      const result = applyResize(source, testSelection, config)

      expect(result.width).toBe(160)
      expect(result.height).toBe(200)
    })
  })

  describe('resizeOrigin', () => {
    it('should create canvas with target dimensions when smaller', () => {
      const source = createMockCanvas(100, 100)
      const selection: Selection = { sx: 0, sy: 0, width: 50, height: 50 }
      const config: ResizeConfig = {
        mode: 'origin',
        targetWidth: 160,
        targetHeight: 200
      }

      const result = applyResize(source, selection, config)

      expect(result.width).toBe(160)
      expect(result.height).toBe(200)
    })

    it('should create canvas with target dimensions when larger', () => {
      const source = createMockCanvas(200, 200)
      const selection: Selection = { sx: 0, sy: 0, width: 200, height: 200 }
      const config: ResizeConfig = {
        mode: 'origin',
        targetWidth: 100,
        targetHeight: 100
      }

      const result = applyResize(source, selection, config)

      expect(result.width).toBe(100)
      expect(result.height).toBe(100)
    })
  })

  describe('resizeUserSize', () => {
    it('should use custom parameters when provided', () => {
      const source = createMockCanvas(100, 100)
      const config: ResizeConfig = {
        mode: 'userSize',
        targetWidth: 160,
        targetHeight: 200,
        customPosition: { x: 10, y: 20 },
        customSize: { width: 80, height: 100 }
      }

      const result = applyResize(source, testSelection, config)

      expect(result.width).toBe(160)
      expect(result.height).toBe(200)
    })

    it('should fallback to fit mode when custom params missing', () => {
      const source = createMockCanvas(100, 100)
      const config: ResizeConfig = {
        mode: 'userSize',
        targetWidth: 160,
        targetHeight: 200
      }

      const result = applyResize(source, testSelection, config)

      expect(result.width).toBe(160)
      expect(result.height).toBe(200)
    })
  })

  describe('extractSelection', () => {
    it('should create canvas with selection dimensions', () => {
      const source = createMockCanvas(200, 200)
      const selection: Selection = { sx: 50, sy: 50, width: 100, height: 100 }

      const result = extractSelection(source, selection)

      expect(result.width).toBe(100)
      expect(result.height).toBe(100)
    })
  })
})

