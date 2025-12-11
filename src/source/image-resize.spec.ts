import { describe, expect, it, vi } from 'vitest'
import type { ResizeConfig } from '@/app/store/config/resize-types'
import { CPC_MODE_CONFIG } from '@/app/store/config/types'
import { applyResize, extractSelection, type Selection } from '@/source'

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
        modeConfig: CPC_MODE_CONFIG['0'] // Mode 0: 160×200
      }

      const result = applyResize(source, testSelection, config)

      expect(result.width).toBe(100)
      expect(result.height).toBe(100)
    })

    it('should extract selection without transformation', () => {
      const source = createMockCanvas(100, 100)
      const config: ResizeConfig = {
        mode: 'auto',
        modeConfig: CPC_MODE_CONFIG['1'] // Mode 1: 320×200
      }

      const result = applyResize(source, testSelection, config)

      expect(result.width).toBe(100)
      expect(result.height).toBe(100)
    })
  })

  describe('resizeOrigin', () => {
    it('should create canvas with CPC native dimensions for each mode', () => {
      const source = createMockCanvas(100, 100)
      const selection: Selection = { sx: 0, sy: 0, width: 50, height: 50 }

      // Mode 0: 160×200 CPC native
      const config0: ResizeConfig = {
        mode: 'origin',
        modeConfig: CPC_MODE_CONFIG['0']
      }
      const result0 = applyResize(source, selection, config0)
      expect(result0.width).toBe(160)
      expect(result0.height).toBe(200)

      // Mode 1: 320×200 CPC native
      const config1: ResizeConfig = {
        mode: 'origin',
        modeConfig: CPC_MODE_CONFIG['1']
      }
      const result1 = applyResize(source, selection, config1)
      expect(result1.width).toBe(320)
      expect(result1.height).toBe(200)

      // Mode 2: 640×200 CPC native
      const config2: ResizeConfig = {
        mode: 'origin',
        modeConfig: CPC_MODE_CONFIG['2']
      }
      const result2 = applyResize(source, selection, config2)
      expect(result2.width).toBe(640)
      expect(result2.height).toBe(200)
    })

    it('should compress source to CPC dimensions in mode 0', () => {
      const source = createMockCanvas(320, 200)
      const selection: Selection = { sx: 0, sy: 0, width: 320, height: 200 }
      const config: ResizeConfig = {
        mode: 'origin',
        modeConfig: CPC_MODE_CONFIG['0'] // Mode 0: 160×200, ratio=2
      }

      const result = applyResize(source, selection, config)

      // Mode 0: 320×200 source → 160×200 CPC (compression horizontale)
      // Canvas fait 160×200 (dimensions CPC natives)
      expect(result.width).toBe(160)
      expect(result.height).toBe(200)
    })

    it('should keep 1:1 mapping in mode 1 (square pixels)', () => {
      const source = createMockCanvas(320, 200)
      const selection: Selection = { sx: 0, sy: 0, width: 320, height: 200 }
      const config: ResizeConfig = {
        mode: 'origin',
        modeConfig: CPC_MODE_CONFIG['1'] // Mode 1: 320×200, ratio=1
      }

      const result = applyResize(source, selection, config)

      // Mode 1: copie 1:1 sans transformation
      expect(result.width).toBe(320)
      expect(result.height).toBe(200)
    })

    it('should keep 1:1 mapping in mode 2', () => {
      const source = createMockCanvas(640, 200)
      const selection: Selection = { sx: 0, sy: 0, width: 640, height: 200 }
      const config: ResizeConfig = {
        mode: 'origin',
        modeConfig: CPC_MODE_CONFIG['2'] // Mode 2: 640×200, ratio=0.5
      }

      const result = applyResize(source, selection, config)

      // Mode 2: 640×200 CPC native
      expect(result.width).toBe(640)
      expect(result.height).toBe(200)
    })

    it('should limit output to CPC dimensions when selection is larger', () => {
      const source = createMockCanvas(500, 500)
      const selection: Selection = { sx: 0, sy: 0, width: 500, height: 500 }
      const config: ResizeConfig = {
        mode: 'origin',
        modeConfig: CPC_MODE_CONFIG['1'] // Mode 1: 320×200
      }

      const result = applyResize(source, selection, config)

      // Limité aux dimensions CPC
      expect(result.width).toBe(320)
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
