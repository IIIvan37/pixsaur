/**
 * Tests for PNG Export Utilities
 */

import { describe, expect, it } from 'vitest'
import type { CpcModeConfig } from '@/app/store/config/types'
import {
  canvasToPNGBlob,
  createCorrectedAspectCanvas,
  createSquarePixelsCanvas
} from './export-png-utils'

// Mock HTMLCanvasElement for tests
function createMockCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx) {
    // Fill with a test pattern
    ctx.fillStyle = '#FF0000'
    ctx.fillRect(0, 0, width, height)
  }
  return canvas
}

describe('export-png-utils', () => {
  describe('createSquarePixelsCanvas', () => {
    it('should create canvas with native CPC dimensions for mode 0', () => {
      const sourceCanvas = createMockCanvas(320, 200)
      const modeConfig: CpcModeConfig = {
        overscan: false,
        mode: 0,
        width: 160,
        height: 200,
        nColors: 16,
        scaleX: 2,
        scaleY: 1
      }

      const result = createSquarePixelsCanvas(sourceCanvas, modeConfig)

      expect(result.width).toBe(160)
      expect(result.height).toBe(200)
    })

    it('should create canvas with native CPC dimensions for mode 1', () => {
      const sourceCanvas = createMockCanvas(320, 200)
      const modeConfig: CpcModeConfig = {
        overscan: false,
        mode: 1,
        width: 320,
        height: 200,
        nColors: 4,
        scaleX: 1,
        scaleY: 1
      }

      const result = createSquarePixelsCanvas(sourceCanvas, modeConfig)

      expect(result.width).toBe(320)
      expect(result.height).toBe(200)
    })

    it('should create canvas with native CPC dimensions for mode 2', () => {
      const sourceCanvas = createMockCanvas(640, 400)
      const modeConfig: CpcModeConfig = {
        overscan: false,
        mode: 2,
        width: 640,
        height: 200,
        nColors: 2,
        scaleX: 1,
        scaleY: 2
      }

      const result = createSquarePixelsCanvas(sourceCanvas, modeConfig)

      expect(result.width).toBe(640)
      expect(result.height).toBe(200)
    })

    it('should handle overscan dimensions', () => {
      const sourceCanvas = createMockCanvas(384, 280)
      const modeConfig: CpcModeConfig = {
        overscan: true,
        mode: 0,
        width: 192,
        height: 280,
        nColors: 16,
        scaleX: 2,
        scaleY: 1
      }

      const result = createSquarePixelsCanvas(sourceCanvas, modeConfig)

      expect(result.width).toBe(192)
      expect(result.height).toBe(280)
    })

    it('should handle custom dimensions', () => {
      const sourceCanvas = createMockCanvas(320, 248)
      const modeConfig: CpcModeConfig = {
        overscan: false,
        mode: 0,
        width: 160,
        height: 248,
        nColors: 16,
        scaleX: 2,
        scaleY: 1
      }

      const result = createSquarePixelsCanvas(sourceCanvas, modeConfig)

      expect(result.width).toBe(160)
      expect(result.height).toBe(248)
    })
  })

  describe('createCorrectedAspectCanvas', () => {
    it('should apply 2x width multiplier for mode 0', () => {
      const sourceCanvas = createMockCanvas(160, 200)
      const modeConfig: CpcModeConfig = {
        overscan: false,
        mode: 0,
        width: 160,
        height: 200,
        nColors: 16,
        scaleX: 2,
        scaleY: 1
      }

      const result = createCorrectedAspectCanvas(sourceCanvas, modeConfig)

      // Mode 0: width should be doubled (widthMultiplier = 2)
      expect(result.width).toBe(320)
      expect(result.height).toBe(200)
    })

    it('should keep 1:1 ratio for mode 1', () => {
      const sourceCanvas = createMockCanvas(320, 200)
      const modeConfig: CpcModeConfig = {
        overscan: false,
        mode: 1,
        width: 320,
        height: 200,
        nColors: 4,
        scaleX: 1,
        scaleY: 1
      }

      const result = createCorrectedAspectCanvas(sourceCanvas, modeConfig)

      // Mode 1: no change (widthMultiplier = 1, heightMultiplier = 1)
      expect(result.width).toBe(320)
      expect(result.height).toBe(200)
    })

    it('should apply 2x height multiplier for mode 2', () => {
      const sourceCanvas = createMockCanvas(640, 200)
      const modeConfig: CpcModeConfig = {
        overscan: false,
        mode: 2,
        width: 640,
        height: 200,
        nColors: 2,
        scaleX: 1,
        scaleY: 2
      }

      const result = createCorrectedAspectCanvas(sourceCanvas, modeConfig)

      // Mode 2: height should be doubled (heightMultiplier = 2)
      expect(result.width).toBe(640)
      expect(result.height).toBe(400)
    })

    it('should handle overscan dimensions with ratio correction', () => {
      const sourceCanvas = createMockCanvas(192, 280)
      const modeConfig: CpcModeConfig = {
        overscan: true,
        mode: 0,
        width: 192,
        height: 280,
        nColors: 16,
        scaleX: 2,
        scaleY: 1
      }

      const result = createCorrectedAspectCanvas(sourceCanvas, modeConfig)

      // Mode 0 overscan: width doubled
      expect(result.width).toBe(384)
      expect(result.height).toBe(280)
    })
  })

  describe('canvasToPNGBlob', () => {
    it('should convert canvas to PNG blob', async () => {
      const canvas = createMockCanvas(160, 200)

      const blob = await canvasToPNGBlob(canvas)

      // In test environment, toBlob may not produce a proper PNG
      // We just verify it returns a Blob instance
      expect(blob).toBeInstanceOf(Blob)
      // In real browser environment: expect(blob.type).toBe('image/png')
    })

    it('should handle canvas conversion without errors', async () => {
      const canvas1 = createMockCanvas(160, 200)
      const canvas2 = createMockCanvas(320, 200)

      // Just verify the function completes without throwing
      const blob1 = await canvasToPNGBlob(canvas1)
      const blob2 = await canvasToPNGBlob(canvas2)

      expect(blob1).toBeInstanceOf(Blob)
      expect(blob2).toBeInstanceOf(Blob)
    })
  })

  describe('Integration: Square pixels → Corrected aspect workflow', () => {
    it('should maintain correct dimensions through full workflow', () => {
      // Simulate mode 0: Start with source that may have ratio applied
      const sourceCanvas = createMockCanvas(320, 200)
      const modeConfig: CpcModeConfig = {
        overscan: false,
        mode: 0,
        width: 160,
        height: 200,
        nColors: 16,
        scaleX: 2,
        scaleY: 1
      }

      // Step 1: Create square pixels version (1:1 ratio)
      const squareCanvas = createSquarePixelsCanvas(sourceCanvas, modeConfig)
      expect(squareCanvas.width).toBe(160)
      expect(squareCanvas.height).toBe(200)

      // Step 2: Create corrected aspect version from same source
      const correctedCanvas = createCorrectedAspectCanvas(
        sourceCanvas,
        modeConfig
      )
      expect(correctedCanvas.width).toBe(320)
      expect(correctedCanvas.height).toBe(200)

      // Verify ratio relationship
      expect(correctedCanvas.width / squareCanvas.width).toBe(2)
      expect(correctedCanvas.height / squareCanvas.height).toBe(1)
    })

    it('should handle mode 2 workflow correctly', () => {
      const sourceCanvas = createMockCanvas(640, 400)
      const modeConfig: CpcModeConfig = {
        overscan: false,
        mode: 2,
        width: 640,
        height: 200,
        nColors: 2,
        scaleX: 1,
        scaleY: 2
      }

      // Square pixels: native dimensions
      const squareCanvas = createSquarePixelsCanvas(sourceCanvas, modeConfig)
      expect(squareCanvas.width).toBe(640)
      expect(squareCanvas.height).toBe(200)

      // Corrected aspect: height doubled
      const correctedCanvas = createCorrectedAspectCanvas(
        sourceCanvas,
        modeConfig
      )
      expect(correctedCanvas.width).toBe(640)
      expect(correctedCanvas.height).toBe(400)

      // Verify ratio relationship
      expect(correctedCanvas.width / squareCanvas.width).toBe(1)
      expect(correctedCanvas.height / squareCanvas.height).toBe(2)
    })
  })
})
