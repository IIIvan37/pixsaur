/**
 * Mode R GPU Quantizer
 *
 * Uses WebGL shaders to parallelize the quantization of Mode R images.
 * Each pixel is processed independently to find the best blend pair.
 * Supports ordered dithering (Bayer, Blue Noise).
 */

import type REGL from 'regl'
import { logger } from '@/core/logger'
import {
  modeRQuantizeFragmentShader,
  simpleVertexShader
} from '@/libs/pixsaur-adapter/shaders'
import type { DitheringMode } from '@/libs/pixsaur-color/src'
import type { ModeRPalettes } from './types'

/** Dithering mode for GPU */
type GPUDitheringMode =
  | 'none'
  | 'bayer2x2'
  | 'bayer4x4'
  | 'bayer8x8'
  | 'halftone4x4'
  | 'blueNoise'

/** Bayer matrices for GPU upload */
const BAYER_MATRICES: Record<string, { size: number; data: number[] }> = {
  bayer2x2: {
    size: 2,
    data: [0, 2, 3, 1].map((v) => v / 4)
  },
  bayer4x4: {
    size: 4,
    data: [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
      (v) => v / 16
    )
  },
  bayer8x8: {
    size: 8,
    data: [
      0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4,
      36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33,
      9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63,
      31, 55, 23, 61, 29, 53, 21
    ].map((v) => v / 64)
  },
  halftone4x4: {
    size: 4,
    data: [7, 13, 11, 4, 12, 16, 14, 8, 10, 15, 6, 2, 5, 9, 3, 1].map(
      (v) => v / 16
    )
  }
}

/**
 * GPU-accelerated Mode R quantizer using ReGL
 */
export class ModeRGPUQuantizer {
  private readonly regl: REGL.Regl
  private quantizeCommand?: REGL.DrawCommand
  private blueNoiseTexture?: REGL.Texture2D
  private isInitialized = false

  constructor(regl: REGL.Regl) {
    this.regl = regl
    this.initializeCommand()
    this.initializeBlueNoise()
  }

  private initializeCommand(): void {
    try {
      this.quantizeCommand = this.regl({
        frag: modeRQuantizeFragmentShader,
        vert: simpleVertexShader,
        attributes: {
          a_position: [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1]
          ]
        },
        uniforms: {
          u_image: (_ctx, props: any) => props.inputTexture,
          u_blendLUT: (_ctx, props: any) => props.blendLUT,
          u_flickerLUT: (_ctx, props: any) => props.flickerLUT,
          u_bayerMatrix: (_ctx, props: any) => props.bayerMatrix,
          u_blueNoise: (_ctx, props: any) => props.blueNoise,
          u_imageSize: (_ctx, props: any) => props.imageSize,
          u_outputSize: (_ctx, props: any) => props.outputSize,
          u_flickerWeight: (_ctx, props: any) => props.flickerWeight,
          u_maxLuminanceDelta: (_ctx, props: any) => props.maxLuminanceDelta,
          u_ditheringMode: (_ctx, props: any) => props.ditheringMode,
          u_ditheringIntensity: (_ctx, props: any) => props.ditheringIntensity,
          u_bayerSize: (_ctx, props: any) => props.bayerSize
        },
        primitive: 'triangle strip',
        count: 4
      })
      this.isInitialized = true
      logger.info('[Mode R GPU] Quantize command initialized')
    } catch (error) {
      logger.error('[Mode R GPU] Failed to initialize command', error)
      this.isInitialized = false
    }
  }

  /**
   * Initialize 64x64 blue noise texture (simple procedural generation)
   */
  private initializeBlueNoise(): void {
    // Generate simple blue noise pattern (could be improved with real blue noise)
    const size = 64
    const data = new Uint8Array(size * size * 4)

    // Simple hash-based noise (good enough for dithering)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4
        // Different hash for each channel (decorrelated)
        data[idx] = this.hash(x, y, 0) & 255
        data[idx + 1] = this.hash(x, y, 1) & 255
        data[idx + 2] = this.hash(x, y, 2) & 255
        data[idx + 3] = 255
      }
    }

    try {
      this.blueNoiseTexture = this.regl.texture({
        width: size,
        height: size,
        format: 'rgba',
        type: 'uint8',
        data,
        wrap: 'repeat',
        mag: 'nearest',
        min: 'nearest'
      })
    } catch (error) {
      logger.warn('[Mode R GPU] Failed to create blue noise texture', error)
    }
  }

  /** Simple hash function for noise generation */
  private hash(x: number, y: number, seed: number): number {
    let h = seed
    h = ((h << 5) + h) ^ x
    h = ((h << 5) + h) ^ y
    h = h * 2654435761
    return (h >>> 0) % 256
  }

  /**
   * Build 16x16 blend LUT texture from palettes
   * Each pixel contains the blended RGB color
   */
  private buildBlendLUT(palettes: ModeRPalettes): Uint8Array {
    const data = new Uint8Array(16 * 16 * 4)

    for (let a = 0; a < 16; a++) {
      const colorA = palettes.paletteA[a]
      for (let b = 0; b < 16; b++) {
        const colorB = palettes.paletteB[b]

        // Blended color
        const blendR = Math.round((colorA[0] + colorB[0]) / 2)
        const blendG = Math.round((colorA[1] + colorB[1]) / 2)
        const blendB = Math.round((colorA[2] + colorB[2]) / 2)

        const idx = (b * 16 + a) * 4
        data[idx] = blendR
        data[idx + 1] = blendG
        data[idx + 2] = blendB
        data[idx + 3] = 255
      }
    }

    return data
  }

  /**
   * Build 16x16 flicker LUT texture from palettes
   * R channel contains luminance delta (flicker score)
   */
  private buildFlickerLUT(palettes: ModeRPalettes): Uint8Array {
    const data = new Uint8Array(16 * 16 * 4)

    for (let a = 0; a < 16; a++) {
      const colorA = palettes.paletteA[a]
      const lumA = 0.299 * colorA[0] + 0.587 * colorA[1] + 0.114 * colorA[2]

      for (let b = 0; b < 16; b++) {
        const colorB = palettes.paletteB[b]
        const lumB = 0.299 * colorB[0] + 0.587 * colorB[1] + 0.114 * colorB[2]

        const flickerScore = Math.abs(lumA - lumB)

        const idx = (b * 16 + a) * 4
        data[idx] = Math.min(255, Math.round(flickerScore))
        data[idx + 1] = 0
        data[idx + 2] = 0
        data[idx + 3] = 255
      }
    }

    return data
  }

  /**
   * Build Bayer matrix texture
   */
  private buildBayerTexture(mode: GPUDitheringMode): REGL.Texture2D | null {
    const matrix = BAYER_MATRICES[mode]
    if (!matrix) return null

    const size = matrix.size
    const data = new Uint8Array(size * size * 4)

    for (let i = 0; i < matrix.data.length; i++) {
      const idx = i * 4
      const val = Math.round(matrix.data[i] * 255)
      data[idx] = val
      data[idx + 1] = val
      data[idx + 2] = val
      data[idx + 3] = 255
    }

    return this.regl.texture({
      width: size,
      height: size,
      format: 'rgba',
      type: 'uint8',
      data,
      wrap: 'repeat',
      mag: 'nearest',
      min: 'nearest'
    })
  }

  /**
   * Quantize image using GPU
   * Returns index buffers A and B
   */
  quantize(
    imageData: Uint8ClampedArray,
    width: number,
    height: number,
    palettes: ModeRPalettes,
    flickerWeight: number,
    maxLuminanceDelta: number,
    ditheringMode: DitheringMode | 'none' = 'bayer4x4',
    ditheringIntensity: number = 50
  ): { indexBufferA: Uint8Array; indexBufferB: Uint8Array } | null {
    if (!this.isInitialized || !this.quantizeCommand) {
      logger.warn('[Mode R GPU] Not initialized, falling back to CPU')
      return null
    }

    const outWidth = Math.floor(width / 2)
    const outHeight = height

    // Determine GPU dithering mode
    let gpuDitheringMode = 0 // none
    let bayerSize = 4

    if (ditheringMode === 'blueNoise') {
      gpuDitheringMode = 2
    } else if (ditheringMode === 'bayer2x2') {
      gpuDitheringMode = 1
      bayerSize = 2
    } else if (
      ditheringMode === 'bayer4x4' ||
      ditheringMode === 'halftone4x4'
    ) {
      gpuDitheringMode = 1
      bayerSize = 4
    } else if (ditheringMode === 'bayer8x8') {
      gpuDitheringMode = 1
      bayerSize = 8
    }

    try {
      // Create input texture
      const inputTexture = this.regl.texture({
        width,
        height,
        format: 'rgba',
        type: 'uint8',
        data: imageData,
        flipY: false
      })

      // Create blend LUT texture (16x16)
      const blendLUTData = this.buildBlendLUT(palettes)
      const blendLUT = this.regl.texture({
        width: 16,
        height: 16,
        format: 'rgba',
        type: 'uint8',
        data: blendLUTData,
        mag: 'nearest',
        min: 'nearest'
      })

      // Create flicker LUT texture (16x16)
      const flickerLUTData = this.buildFlickerLUT(palettes)
      const flickerLUT = this.regl.texture({
        width: 16,
        height: 16,
        format: 'rgba',
        type: 'uint8',
        data: flickerLUTData,
        mag: 'nearest',
        min: 'nearest'
      })

      // Create Bayer matrix texture if needed
      const bayerTexture =
        gpuDitheringMode === 1
          ? this.buildBayerTexture(ditheringMode as GPUDitheringMode)
          : this.regl.texture({ width: 1, height: 1 }) // Dummy texture

      // Create output framebuffer
      const outTexture = this.regl.texture({
        width: outWidth,
        height: outHeight,
        format: 'rgba',
        type: 'uint8'
      })
      const fbo = this.regl.framebuffer({ color: outTexture })

      // Render
      fbo.use(() => {
        this.quantizeCommand!({
          inputTexture,
          blendLUT,
          flickerLUT,
          bayerMatrix: bayerTexture,
          blueNoise:
            this.blueNoiseTexture || this.regl.texture({ width: 1, height: 1 }),
          imageSize: [width, height],
          outputSize: [outWidth, outHeight],
          flickerWeight: flickerWeight / 100,
          maxLuminanceDelta,
          ditheringMode: gpuDitheringMode,
          ditheringIntensity: ditheringIntensity / 100,
          bayerSize
        })
      })

      // Read back results
      const result = new Uint8Array(outWidth * outHeight * 4)
      this.regl.read({ framebuffer: fbo, data: result })

      // Extract index buffers from RG channels
      const indexBufferA = new Uint8Array(outWidth * outHeight)
      const indexBufferB = new Uint8Array(outWidth * outHeight)

      for (let i = 0; i < outWidth * outHeight; i++) {
        // R channel contains indexA (0-1 -> 0-15)
        indexBufferA[i] = Math.round((result[i * 4] * 15) / 255)
        // G channel contains indexB (0-1 -> 0-15)
        indexBufferB[i] = Math.round((result[i * 4 + 1] * 15) / 255)
      }

      // Cleanup
      fbo.destroy()
      outTexture.destroy()
      inputTexture.destroy()
      blendLUT.destroy()
      flickerLUT.destroy()
      bayerTexture?.destroy()

      logger.info('[Mode R GPU] Quantization complete', {
        inputSize: `${width}×${height}`,
        outputSize: `${outWidth}×${outHeight}`,
        dithering: ditheringMode,
        intensity: ditheringIntensity
      })

      return { indexBufferA, indexBufferB }
    } catch (error) {
      logger.error('[Mode R GPU] Quantization failed', error)
      return null
    }
  }

  /**
   * Check if GPU quantization is available
   */
  isAvailable(): boolean {
    return this.isInitialized
  }

  /**
   * Check if dithering mode is supported on GPU
   */
  static isOrderedDithering(mode: DitheringMode | 'none'): boolean {
    return (
      mode === 'bayer2x2' ||
      mode === 'bayer4x4' ||
      mode === 'bayer8x8' ||
      mode === 'halftone4x4' ||
      mode === 'blueNoise'
    )
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.blueNoiseTexture?.destroy()
    this.isInitialized = false
  }
}

// Singleton instance (lazy initialized)
let gpuQuantizerInstance: ModeRGPUQuantizer | null = null

/**
 * Get or create the GPU quantizer instance
 */
export function getModeRGPUQuantizer(
  regl?: REGL.Regl
): ModeRGPUQuantizer | null {
  if (!gpuQuantizerInstance && regl) {
    try {
      gpuQuantizerInstance = new ModeRGPUQuantizer(regl)
    } catch (error) {
      logger.warn('[Mode R GPU] Failed to create quantizer', error)
      return null
    }
  }
  return gpuQuantizerInstance
}

/**
 * Dispose the GPU quantizer instance
 */
export function disposeModeRGPUQuantizer(): void {
  gpuQuantizerInstance?.dispose()
  gpuQuantizerInstance = null
}
