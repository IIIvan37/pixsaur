/**
 * WebGL implementation of {@link ImageProcessor}, built on `regl`.
 *
 * It requires a live `regl` instance and **throws from its constructor** when
 * the GPU pipeline cannot be set up: the fallback decision belongs to
 * `processorFactory`, not here, so there is exactly one place that answers
 * "GPU or CPU?".
 *
 * Two steps still run on the CPU whichever processor is in use — the chroma
 * key and the median filter (see `applyCpuOnlyFilters`) — and the GPU
 * quantizer refuses images below its pixel floor, so this processor keeps a
 * {@link CpuProcessor} to delegate to. That delegation forwards the caller's
 * options untouched.
 */

import type REGL from 'regl'
import { adapterLogger } from '@/core'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import {
  createBlurKernel,
  createSharpenKernel,
  getBlurPassCount,
  kernelToMat3
} from '../convolution-kernels'
import type {
  AdjustmentConfig,
  ImageProcessor,
  PaletteStrategy,
  QuantizationOptions
} from '../interfaces'
import {
  convolutionFragmentShader,
  imageAdjustmentFragmentShader,
  rasterFragmentShader,
  simpleVertexShader,
  sobelFragmentShader
} from '../shaders'
import { applyCpuOnlyFilters, CpuProcessor } from './cpu-processor'
import { ReGLQuantizer } from './regl-quantizer'

/** GPU is only worth its upload cost from this many pixels up. */
const MIN_PIXELS_FOR_GPU = 128 * 128

/** The full-screen quad every pass draws. */
const FULLSCREEN_QUAD = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1]
]

export class GpuProcessor implements ImageProcessor {
  readonly type = 'gpu' as const

  private readonly regl: REGL.Regl
  private readonly cpu: CpuProcessor
  private readonly quantizer: ReGLQuantizer

  private readonly imageAdjustmentCommand: REGL.DrawCommand
  private readonly convolutionCommand: REGL.DrawCommand
  private readonly sobelCommand: REGL.DrawCommand
  private readonly rasterPreviewCommand: REGL.DrawCommand

  private inputTexture?: REGL.Texture2D

  /**
   * @throws when the quantizer or any GPU command cannot be built. The caller
   *   (`processorFactory`) decides what to do about it.
   */
  constructor(regl: REGL.Regl, cpu: CpuProcessor = new CpuProcessor()) {
    this.regl = regl
    this.cpu = cpu
    this.quantizer = new ReGLQuantizer(regl)

    this.imageAdjustmentCommand = regl({
      frag: imageAdjustmentFragmentShader,
      vert: simpleVertexShader,
      attributes: { a_position: FULLSCREEN_QUAD },
      uniforms: {
        u_image: (_ctx, props: any) => props.inputTexture,
        u_rgbFactors: (_ctx, props: any) => props.rgbFactors,
        u_brightness: (_ctx, props: any) => props.brightness,
        u_contrast: (_ctx, props: any) => props.contrast,
        u_saturation: (_ctx, props: any) => props.saturation,
        u_hue: (_ctx, props: any) => (props.hue || 0) / 360, // -180/+180 -> -0.5/+0.5
        u_vibrance: (_ctx, props: any) => props.vibrance || 0,
        u_temperature: (_ctx, props: any) => props.temperature || 0,
        u_tint: (_ctx, props: any) => props.tint || 0,
        u_gamma: (_ctx, props: any) => props.gamma || 1,
        u_exposure: (_ctx, props: any) => props.exposure || 0,
        u_highlights: (_ctx, props: any) => props.highlights || 0,
        u_shadows: (_ctx, props: any) => props.shadows || 0,
        u_posterization: (_ctx, props: any) => props.posterization
      },
      primitive: 'triangle strip',
      count: 4
    })

    this.convolutionCommand = regl({
      frag: convolutionFragmentShader,
      vert: simpleVertexShader,
      attributes: { a_position: FULLSCREEN_QUAD },
      uniforms: {
        u_image: (_ctx, props: any) => props.inputTexture,
        u_texelSize: (_ctx, props: any) => props.texelSize,
        u_kernel: (_ctx, props: any) => props.kernel,
        u_strength: (_ctx, props: any) => props.strength
      },
      primitive: 'triangle strip',
      count: 4
    })

    this.sobelCommand = regl({
      frag: sobelFragmentShader,
      vert: simpleVertexShader,
      attributes: { a_position: FULLSCREEN_QUAD },
      uniforms: {
        u_image: (_ctx, props: any) => props.inputTexture,
        u_texelSize: (_ctx, props: any) => props.texelSize,
        u_strength: (_ctx, props: any) => props.strength
      },
      primitive: 'triangle strip',
      count: 4
    })

    this.rasterPreviewCommand = regl({
      frag: rasterFragmentShader,
      vert: simpleVertexShader,
      attributes: { a_position: FULLSCREEN_QUAD },
      uniforms: {
        u_indexTex: (_ctx, props: any) => props.indexTex,
        u_paletteTex: (_ctx, props: any) => props.paletteTex,
        u_height: (_ctx, props: any) => props.height
      },
      primitive: 'triangle strip',
      count: 4
    })

    adapterLogger.info('[ADAPTER] GPU processor initialized (ReGL)')
  }

  applyAdjustments(
    imageData: ImageData,
    adjustments: AdjustmentConfig
  ): ImageData {
    return this.applyAdjustmentsGPU(
      applyCpuOnlyFilters(imageData, adjustments),
      adjustments
    )
  }

  /**
   * Pipeline: input -> colorimetric adjustments -> convolution (if any) ->
   * Sobel edges (if any) -> read back.
   */
  private applyAdjustmentsGPU(
    imageData: ImageData,
    adjustments: AdjustmentConfig
  ): ImageData {
    const { width, height } = imageData
    const totalPixels = width * height
    const hasConvolution =
      (adjustments.sharpen ?? 0) !== 0 || (adjustments.blur ?? 0) !== 0
    const hasEdges = (adjustments.edges ?? 0) !== 0

    const startTime = performance.now()

    // Réutiliser l'allocation existante si possible
    if (this.inputTexture) {
      this.inputTexture({
        width,
        height,
        data: imageData.data,
        format: 'rgba',
        type: 'uint8'
      })
    } else {
      this.inputTexture = this.regl.texture({
        width,
        height,
        data: imageData.data,
        format: 'rgba',
        type: 'uint8'
      })
    }

    const adjustmentOutputTexture = this.regl.texture({
      width,
      height,
      format: 'rgba',
      type: 'uint8'
    })

    const adjustmentFramebuffer = this.regl.framebuffer({
      color: adjustmentOutputTexture
    })

    // Pass 1: ajustements colorimétriques
    adjustmentFramebuffer.use(() => {
      this.imageAdjustmentCommand({
        inputTexture: this.inputTexture,
        rgbFactors: [adjustments.rgb.r, adjustments.rgb.g, adjustments.rgb.b],
        brightness: adjustments.brightness,
        contrast: adjustments.contrast,
        saturation: adjustments.saturation,
        hue: adjustments.hue,
        vibrance: adjustments.vibrance,
        temperature: adjustments.temperature,
        tint: adjustments.tint,
        gamma: adjustments.gamma,
        exposure: adjustments.exposure,
        highlights: adjustments.highlights,
        shadows: adjustments.shadows,
        posterization: adjustments.posterization
      })
    })

    let finalTexture = adjustmentOutputTexture
    let convolutionFramebuffer: REGL.Framebuffer2D | null = null
    let convolutionPasses = 0

    // Pass 2+: convolution (blur puis sharpen)
    if (hasConvolution) {
      const sharpen = adjustments.sharpen ?? 0
      const blur = adjustments.blur ?? 0
      const blurPasses = getBlurPassCount(blur)
      const sharpenPasses = sharpen === 0 ? 0 : 1
      convolutionPasses = blurPasses + sharpenPasses

      const convolutionOutputTexture = this.regl.texture({
        width,
        height,
        format: 'rgba',
        type: 'uint8'
      })

      convolutionFramebuffer = this.regl.framebuffer({
        color: convolutionOutputTexture
      })

      // Ping-pong entre deux textures temporaires
      let currentInput = adjustmentOutputTexture
      let tempTexture1: REGL.Texture2D | undefined
      let tempTexture2: REGL.Texture2D | undefined
      let passIndex = 0

      const getOutputTexture = (isLastPass: boolean) => {
        if (isLastPass) return convolutionOutputTexture
        if (!tempTexture1) {
          tempTexture1 = this.regl.texture({
            width,
            height,
            format: 'rgba',
            type: 'uint8'
          })
        }
        if (passIndex % 2 === 0) {
          return tempTexture1
        }
        if (!tempTexture2) {
          tempTexture2 = this.regl.texture({
            width,
            height,
            format: 'rgba',
            type: 'uint8'
          })
        }
        return tempTexture2
      }

      // Blur d'abord (multi-pass): première passe kernel interpolé, puis full Gaussian
      for (let i = 0; i < blurPasses; i++) {
        const blurKernel = kernelToMat3(createBlurKernel(blur, i))
        const isLastPass = i === blurPasses - 1 && sharpenPasses === 0
        const outputTexture = getOutputTexture(isLastPass)

        const fb = this.regl.framebuffer({ color: outputTexture })
        fb.use(() => {
          this.convolutionCommand({
            inputTexture: currentInput,
            texelSize: [1 / width, 1 / height],
            kernel: blurKernel,
            strength: 1
          })
        })
        fb.destroy()

        currentInput = outputTexture
        passIndex++
      }

      if (sharpenPasses > 0) {
        const sharpenKernel = kernelToMat3(createSharpenKernel(sharpen))

        const fb = this.regl.framebuffer({ color: convolutionOutputTexture })
        fb.use(() => {
          this.convolutionCommand({
            inputTexture: currentInput,
            texelSize: [1 / width, 1 / height],
            kernel: sharpenKernel,
            strength: 1
          })
        })
        fb.destroy()
      }

      tempTexture1?.destroy()
      tempTexture2?.destroy()

      finalTexture = convolutionOutputTexture
    }

    // Pass 3: détection de contours Sobel
    let edgesFramebuffer: REGL.Framebuffer2D | null = null
    let edgesPasses = 0
    if (hasEdges) {
      edgesPasses = 1
      const edgesOutputTexture = this.regl.texture({
        width,
        height,
        format: 'rgba',
        type: 'uint8'
      })

      edgesFramebuffer = this.regl.framebuffer({ color: edgesOutputTexture })

      edgesFramebuffer.use(() => {
        this.sobelCommand({
          inputTexture: finalTexture,
          texelSize: [1 / width, 1 / height],
          strength: adjustments.edges
        })
      })

      // La texture de convolution ne sert plus
      if (hasConvolution && convolutionFramebuffer) {
        convolutionFramebuffer.destroy()
        finalTexture.destroy()
      }

      finalTexture = edgesOutputTexture
    }

    // Lecture du résultat final
    const resultData = new Uint8ClampedArray(width * height * 4)
    const nonEdgeFramebuffer = hasConvolution
      ? convolutionFramebuffer
      : adjustmentFramebuffer
    const finalFramebuffer = hasEdges ? edgesFramebuffer : nonEdgeFramebuffer
    this.regl.read({
      framebuffer: finalFramebuffer ?? undefined,
      data: new Uint8Array(resultData.buffer)
    })

    adjustmentFramebuffer.destroy()
    adjustmentOutputTexture.destroy()
    if (hasConvolution && !hasEdges && convolutionFramebuffer) {
      convolutionFramebuffer.destroy()
      finalTexture.destroy()
    }
    if (hasEdges && edgesFramebuffer) {
      edgesFramebuffer.destroy()
      finalTexture.destroy()
    }

    const totalTime = performance.now() - startTime
    const totalPasses = 1 + convolutionPasses + edgesPasses
    adapterLogger.info(
      `[ReGL] GPU adjustments completed: ${totalPixels} pixels in ${totalTime.toFixed(1)}ms (${totalPasses} pass${totalPasses > 1 ? 'es' : ''}, ${(totalPixels / totalTime / 1000).toFixed(1)}M pixels/sec)`
    )

    return new ImageData(resultData, width, height)
  }

  /**
   * GPU quantization, delegating to the CPU processor — options included —
   * when the GPU quantizer refuses the image (too small) or fails.
   */
  async quantizePalette(
    buffer: Uint8ClampedArray,
    imageData: ImageData | { width: number; height: number },
    targetColors: number,
    basePalette: Vector[],
    preselected: Vector[],
    paletteStrategy?: PaletteStrategy,
    options?: QuantizationOptions
  ): Promise<Vector[]> {
    try {
      const fullImageData =
        'data' in imageData
          ? imageData
          : new ImageData(
              new Uint8ClampedArray(buffer),
              imageData.width,
              imageData.height
            )

      const result = await this.quantizer.quantizePalette(
        buffer,
        fullImageData,
        basePalette,
        preselected,
        {
          // RGB colorspace uses euclidean distance
          distanceMetric: 'euclidean',
          targetColors,
          paletteStrategy: paletteStrategy ?? 'exhaustive-contrast',
          autoDistinctMapping: options?.autoDistinctMapping ?? false,
          colorDiversity: options?.colorDiversity ?? 50,
          gpuOptions: { minPixelsForGPU: MIN_PIXELS_FOR_GPU }
        }
      )

      return [...result] // readonly -> mutable
    } catch (error) {
      adapterLogger.warn(
        '[ADAPTER] ReGL quantization failed, falling back to CPU',
        error
      )
      return this.cpu.quantizePalette(
        buffer,
        imageData,
        targetColors,
        basePalette,
        preselected,
        paletteStrategy,
        options
      )
    }
  }

  renderRasterPreview(
    indexBuffer: Uint8Array,
    width: number,
    height: number,
    globalPalette: Vector[],
    rasterChanges: RasterChange[]
  ): ImageData {
    adapterLogger.info(
      `[RASTER] Rendering raster preview via GPU (${width}x${height}, ${rasterChanges.length} changes)`
    )

    // Indices empaquetés dans le canal A d'une RGBA8
    const indexRgba = new Uint8Array(width * height * 4)
    for (let i = 0, j = 3; i < indexBuffer.length; i++, j += 4) {
      indexRgba[j] = indexBuffer[i]
    }

    const indexTex = this.regl.texture({
      width,
      height,
      format: 'rgba',
      type: 'uint8',
      data: indexRgba
    })

    const paletteTex = this.regl.texture({
      width: 16,
      height,
      format: 'rgba',
      type: 'uint8',
      data: buildPaletteLUT(globalPalette, rasterChanges, height)
    })

    const outTex = this.regl.texture({
      width,
      height,
      format: 'rgba',
      type: 'uint8'
    })
    const fbo = this.regl.framebuffer({ color: outTex })

    fbo.use(() => {
      this.rasterPreviewCommand({ indexTex, paletteTex, height })
    })

    const result = new Uint8Array(width * height * 4)
    this.regl.read({ framebuffer: fbo, data: result })

    fbo.destroy()
    outTex.destroy()
    indexTex.destroy()
    paletteTex.destroy()

    return new ImageData(new Uint8ClampedArray(result.buffer), width, height)
  }

  dispose(): void {
    try {
      this.quantizer.dispose()
      this.inputTexture?.destroy()
      this.inputTexture = undefined
      this.regl.destroy()
    } catch (error) {
      adapterLogger.error(
        '[ADAPTER] Error during GPU processor disposal',
        error
      )
    }
  }
}

/**
 * Palette LUT (16 x height, RGBA8): line `y` holds the palette in force at that
 * scanline, i.e. the global palette with every raster change up to `y` applied.
 */
function buildPaletteLUT(
  globalPalette: Vector[],
  rasterChanges: RasterChange[],
  height: number
): Uint8Array {
  const lut = new Uint8Array(16 * height * 4)

  const changesByLine = new Map<number, RasterChange[]>()
  for (const change of rasterChanges) {
    const list = changesByLine.get(change.line)
    if (list) list.push(change)
    else changesByLine.set(change.line, [change])
  }

  const cur: Vector[] = globalPalette.map((c) => [c[0], c[1], c[2]] as Vector)

  for (let y = 0; y < height; y++) {
    const onLine = changesByLine.get(y)
    if (onLine) {
      for (const ch of onLine) {
        cur[ch.inkIndex] = [ch.color[0], ch.color[1], ch.color[2]] as Vector
      }
    }

    for (let i = 0; i < 16; i++) {
      const off = (y * 16 + i) * 4
      const c = cur[i] || ([0, 0, 0] as Vector)
      lut[off] = c[0]
      lut[off + 1] = c[1]
      lut[off + 2] = c[2]
      lut[off + 3] = 255
    }
  }

  return lut
}
