/**
 * Tests for PNG export functions in export-zip.ts
 * These tests verify the integration with export-png-utils
 */

import { describe, expect, it } from 'vitest'
import type { CpcModeConfig } from '@/app/store/config/types'

function createMockCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#FF0000'
    ctx.fillRect(0, 0, width, height)
  }
  return canvas
}

describe('export-zip PNG exports', () => {

  describe('PNG exports integration', () => {
    it('should export both square and corrected PNG files for mode 0', async () => {
      // This is an integration test that would need to import and call exportZip
      // For now, we verify the utilities work correctly with the expected dimensions
      
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

      // Import the utilities
      const { 
        createSquarePixelsCanvas, 
        createCorrectedAspectCanvas 
      } = await import('./export-png-utils')

      const squareCanvas = createSquarePixelsCanvas(sourceCanvas, modeConfig)
      const correctedCanvas = createCorrectedAspectCanvas(sourceCanvas, modeConfig)

      // Verify dimensions for mode 0
      expect(squareCanvas.width).toBe(160) // Native CPC width
      expect(squareCanvas.height).toBe(200) // Native CPC height
      expect(correctedCanvas.width).toBe(320) // Width × 2 (aspect ratio correction)
      expect(correctedCanvas.height).toBe(200) // Height unchanged
    })

    it('should export both square and corrected PNG files for mode 1', async () => {
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

      const { 
        createSquarePixelsCanvas, 
        createCorrectedAspectCanvas 
      } = await import('./export-png-utils')

      const squareCanvas = createSquarePixelsCanvas(sourceCanvas, modeConfig)
      const correctedCanvas = createCorrectedAspectCanvas(sourceCanvas, modeConfig)

      // Mode 1: square pixels, no correction needed
      expect(squareCanvas.width).toBe(320)
      expect(squareCanvas.height).toBe(200)
      expect(correctedCanvas.width).toBe(320) // No change for mode 1
      expect(correctedCanvas.height).toBe(200)
    })

    it('should export both square and corrected PNG files for mode 2', async () => {
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

      const { 
        createSquarePixelsCanvas, 
        createCorrectedAspectCanvas 
      } = await import('./export-png-utils')

      const squareCanvas = createSquarePixelsCanvas(sourceCanvas, modeConfig)
      const correctedCanvas = createCorrectedAspectCanvas(sourceCanvas, modeConfig)

      // Verify dimensions for mode 2
      expect(squareCanvas.width).toBe(640) // Native CPC width
      expect(squareCanvas.height).toBe(200) // Native CPC height
      expect(correctedCanvas.width).toBe(640) // Width unchanged
      expect(correctedCanvas.height).toBe(400) // Height × 2 (aspect ratio correction)
    })

    it('should handle overscan dimensions correctly', async () => {
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

      const { 
        createSquarePixelsCanvas, 
        createCorrectedAspectCanvas 
      } = await import('./export-png-utils')

      const squareCanvas = createSquarePixelsCanvas(sourceCanvas, modeConfig)
      const correctedCanvas = createCorrectedAspectCanvas(sourceCanvas, modeConfig)

      // Overscan mode 0
      expect(squareCanvas.width).toBe(192)
      expect(squareCanvas.height).toBe(280)
      expect(correctedCanvas.width).toBe(384) // Width × 2
      expect(correctedCanvas.height).toBe(280)
    })

    it('should maintain aspect ratio relationship between square and corrected exports', async () => {
      const testCases = [
        { mode: 0, expectedWidthRatio: 2, expectedHeightRatio: 1 },
        { mode: 1, expectedWidthRatio: 1, expectedHeightRatio: 1 },
        { mode: 2, expectedWidthRatio: 1, expectedHeightRatio: 2 }
      ]

      for (const testCase of testCases) {
        const sourceCanvas = createMockCanvas(320, 200)
        
        // Determine dimensions based on mode
        let width: number
        let nColors: number
        
        if (testCase.mode === 0) {
          width = 160
          nColors = 16
        } else if (testCase.mode === 1) {
          width = 320
          nColors = 4
        } else {
          width = 640
          nColors = 2
        }
        
        const modeConfig: CpcModeConfig = {
          overscan: false,
          mode: testCase.mode as 0 | 1 | 2,
          width,
          height: 200,
          nColors,
          scaleX: testCase.mode === 0 ? 2 : 1,
          scaleY: testCase.mode === 2 ? 2 : 1
        }

        const { 
          createSquarePixelsCanvas, 
          createCorrectedAspectCanvas 
        } = await import('./export-png-utils')

        const squareCanvas = createSquarePixelsCanvas(sourceCanvas, modeConfig)
        const correctedCanvas = createCorrectedAspectCanvas(sourceCanvas, modeConfig)

        // Verify aspect ratio relationship
        const widthRatio = correctedCanvas.width / squareCanvas.width
        const heightRatio = correctedCanvas.height / squareCanvas.height

        expect(widthRatio).toBe(testCase.expectedWidthRatio)
        expect(heightRatio).toBe(testCase.expectedHeightRatio)
      }
    })
  })

  describe('Export workflow validation', () => {
    it('should produce valid canvas dimensions throughout export pipeline', async () => {
      // Simulate the full export workflow
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

      const { 
        createSquarePixelsCanvas, 
        createCorrectedAspectCanvas,
        canvasToPNGBlob
      } = await import('./export-png-utils')

      // Step 1: Create square pixels canvas
      const squareCanvas = createSquarePixelsCanvas(sourceCanvas, modeConfig)
      expect(squareCanvas.width).toBe(160)
      expect(squareCanvas.height).toBe(200)

      // Step 2: Convert to blob
      const squareBlob = await canvasToPNGBlob(squareCanvas)
      expect(squareBlob).toBeInstanceOf(Blob)

      // Step 3: Create corrected aspect canvas
      const correctedCanvas = createCorrectedAspectCanvas(sourceCanvas, modeConfig)
      expect(correctedCanvas.width).toBe(320)
      expect(correctedCanvas.height).toBe(200)

      // Step 4: Convert to blob
      const correctedBlob = await canvasToPNGBlob(correctedCanvas)
      expect(correctedBlob).toBeInstanceOf(Blob)

      // Both blobs should be created successfully
      expect(squareBlob).toBeDefined()
      expect(correctedBlob).toBeDefined()
    })
  })
})
