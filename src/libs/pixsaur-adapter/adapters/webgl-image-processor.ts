/* eslint-disable react-hooks/rules-of-hooks */
// Ce fichier contient des appels WebGL qui ne sont pas des hooks React
import type { 
  IImageProcessor, 
  IImageAdjustmentConfig, 
  IQuantizationConfig, 
  IDitheringConfig 
} from '../interfaces/image-processor'
import { WebGLImageProcessor as ExistingWebGLProcessor } from '@/libs/pixsaur-webgl/src/image-processor'
import { WebGLRenderer } from '@/libs/pixsaur-webgl/src/renderer'
import { Shader } from '@/libs/pixsaur-webgl/src/shader'
import { vertexShader } from '@/libs/pixsaur-webgl/src/shaders/vertex.glsl'
import { cpcQuantizationShader } from '@/libs/pixsaur-webgl/src/shaders/cpc-quantization.glsl'
import { bayerDitheringShader } from '@/libs/pixsaur-webgl/src/shaders/bayer-dithering.glsl'
import type { ImageAdjustmentConfig } from '@/libs/pixsaur-webgl/src/image-processor'

export class WebGLImageProcessor implements IImageProcessor {
  public readonly isHardwareAccelerated = true
  private processor: ExistingWebGLProcessor | null = null
  private renderer: WebGLRenderer | null = null
  private quantizationShader: Shader | null = null
  private ditheringShader: Shader | null = null
  private quadBuffer: WebGLBuffer | null = null
  
  constructor() {
    try {
      this.processor = new ExistingWebGLProcessor()
      this.renderer = new WebGLRenderer()
    } catch (error) {
      console.error('Failed to initialize WebGL processor:', error)
      this.processor = null
      this.renderer = null
    }
  }
  
  isAvailable(): boolean {
    return this.processor !== null && this.renderer !== null
  }
  
  async applyAdjustments(imageData: ImageData, config: IImageAdjustmentConfig): Promise<ImageData> {
    if (!this.processor) {
      throw new Error('WebGL processor not available')
    }
    
    // Convertir notre interface vers celle du WebGLImageProcessor existant
    const webglConfig: ImageAdjustmentConfig = {
      rgb: config.rgb,
      brightness: config.brightness,
      contrast: config.contrast,
      saturation: config.saturation,
      posterization: config.posterization
    }
    
    const result = this.processor.processAdjustments(imageData, webglConfig)
    if (!result) {
      throw new Error('WebGL adjustment processing failed')
    }
    
    return result
  }

  private activateShaderProgram(gl: WebGL2RenderingContext, program: WebGLProgram): void {
    gl.useProgram(program)
  }

  async quantizeColors(imageData: ImageData, _config: IQuantizationConfig): Promise<ImageData> {
    if (!this.renderer) {
      // Fallback CPU direct si pas de renderer WebGL
      return this.quantizeColorsCPU(imageData)
    }

    try {
      const { width, height } = imageData
      this.renderer.setSize(width, height)

      // Initialiser le shader de quantization si nécessaire
      this.quantizationShader ??= new Shader(this.renderer.gl, vertexShader, cpcQuantizationShader)

      // Créer texture source
      const sourceTexture = this.renderer.createTexture(imageData)
      if (!sourceTexture) {
        throw new Error('Failed to create source texture')
      }

      // Créer framebuffer de sortie
      const framebuffer = this.renderer.createFramebuffer(width, height)
      if (!framebuffer) {
        throw new Error('Failed to create framebuffer')
      }

      const gl = this.renderer.gl

      // Activer le programme shader et configurer les uniforms
      this.activateShaderProgram(gl, this.quantizationShader.program)
      
      // Bind texture
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
      gl.uniform1i(gl.getUniformLocation(this.quantizationShader.program, 'uSourceTexture'), 0)

      // Setup et render fullscreen quad
      this.setupFullscreenQuad(gl)
      gl.drawArrays(gl.TRIANGLES, 0, 6)

      // Lire le résultat et nettoyer
      const result = this.renderer.toImageData(width, height)
      
      gl.deleteTexture(sourceTexture)
      gl.deleteFramebuffer(framebuffer.framebuffer)
      gl.deleteTexture(framebuffer.texture)

      return result
    } catch (error) {
      // Fallback CPU si WebGL échoue
      console.warn('WebGL quantization failed, falling back to CPU:', error)
      return this.quantizeColorsCPU(imageData)
    }
  }

  private quantizeColorsCPU(imageData: ImageData): ImageData {
    const data = new Uint8ClampedArray(imageData.data)
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = this.quantizeCPC(data[i])     // R
      data[i + 1] = this.quantizeCPC(data[i + 1]) // G  
      data[i + 2] = this.quantizeCPC(data[i + 2]) // B
      // Alpha reste inchangé
    }
    
    return new ImageData(data, imageData.width, imageData.height)
  }
  
  async applyDithering(
    imageData: ImageData, 
    palette: number[][], 
    config: IDitheringConfig
  ): Promise<ImageData> {
    if (!this.renderer) {
      // Fallback : pas de dithering si pas de WebGL
      console.warn('WebGL renderer not available, skipping dithering')
      return imageData
    }

    try {
      const { width, height } = imageData
      this.renderer.setSize(width, height)

      // Créer le shader de dithering si nécessaire
      this.ditheringShader ??= new Shader(this.renderer.gl, vertexShader, bayerDitheringShader)

      const gl = this.renderer.gl

      // Créer texture source
      const sourceTexture = this.renderer.createTexture(imageData)
      if (!sourceTexture) {
        throw new Error('Failed to create source texture')
      }

      // Créer texture palette CPC
      const paletteTexture = this.createPaletteTexture(gl, palette)
      if (!paletteTexture) {
        throw new Error('Failed to create palette texture')
      }

      // Créer framebuffer de sortie
      const framebuffer = this.renderer.createFramebuffer(width, height)
      if (!framebuffer) {
        throw new Error('Failed to create framebuffer')
      }

      // Activer le programme shader et configurer les uniforms
      this.activateShaderProgram(gl, this.ditheringShader.program)
      
      // Bind textures
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
      gl.uniform1i(gl.getUniformLocation(this.ditheringShader.program, 'uSourceTexture'), 0)
      
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, paletteTexture)
      gl.uniform1i(gl.getUniformLocation(this.ditheringShader.program, 'uPaletteTexture'), 1)

      // Configure uniforms
      gl.uniform2f(gl.getUniformLocation(this.ditheringShader.program, 'uTextureSize'), width, height)
      gl.uniform1f(gl.getUniformLocation(this.ditheringShader.program, 'uIntensity'), config.intensity || 0.1)
      gl.uniform1i(gl.getUniformLocation(this.ditheringShader.program, 'uPaletteSize'), palette.length)
      gl.uniform1i(gl.getUniformLocation(this.ditheringShader.program, 'uBayerSize'), config.matrixSize || 4)

      // Setup et render fullscreen quad
      this.setupFullscreenQuad(gl)
      gl.drawArrays(gl.TRIANGLES, 0, 6)

      // Lire le résultat et nettoyer
      const result = this.renderer.toImageData(width, height)
      
      gl.deleteTexture(sourceTexture)
      gl.deleteTexture(paletteTexture)
      gl.deleteFramebuffer(framebuffer.framebuffer)
      gl.deleteTexture(framebuffer.texture)

      return result
    } catch (error) {
      // Fallback: pas de dithering si WebGL échoue
      console.warn('WebGL dithering failed, returning original image:', error)
      return imageData
    }
  }
  
  async processComplete(
    imageData: ImageData,
    adjustments: IImageAdjustmentConfig,
    quantization: IQuantizationConfig,
    dithering: IDitheringConfig,
    palette: number[][]
  ): Promise<ImageData> {
    // Pipeline séquentiel pour commencer, optimisation multi-pass plus tard
    let result = await this.applyAdjustments(imageData, adjustments)
    result = await this.quantizeColors(result, quantization)
    result = await this.applyDithering(result, palette, dithering)
    return result
  }
  
  dispose(): void {
    // Nettoyer le buffer avant de nettoyer le renderer
    if (this.quadBuffer && this.renderer?.gl) {
      const gl = this.renderer.gl
      gl.deleteBuffer(this.quadBuffer)
      this.quadBuffer = null
    }
    
    if (this.processor) {
      this.processor.dispose()
      this.processor = null
    }
    
    if (this.renderer) {
      this.renderer.dispose()
      this.renderer = null
    }
    
    // Les shaders sont nettoyés automatiquement avec le contexte GL
    this.quantizationShader = null
    this.ditheringShader = null
  }
  
  private quantizeCPC(value: number): number {
    const levels = [0, 128, 255]
    let best = levels[0]
    let bestDist = Math.abs(value - best)
    
    for (const lvl of levels) {
      const dist = Math.abs(value - lvl)
      if (dist < bestDist) {
        bestDist = dist
        best = lvl
      }
    }
    
    return best
  }

  private setupFullscreenQuad(gl: WebGL2RenderingContext) {
    if (!this.quadBuffer) {
      const vertices = new Float32Array([
        -1, -1, 0, 0,  // bottom left
         1, -1, 1, 0,  // bottom right  
        -1,  1, 0, 1,  // top left
         1, -1, 1, 0,  // bottom right
         1,  1, 1, 1,  // top right
        -1,  1, 0, 1   // top left
      ])

      this.quadBuffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
    
    // Position attribute (location 0)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 4 * 4, 0)
    
    // Texture coordinate attribute (location 1)  
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 4 * 4, 2 * 4)
  }

  private createPaletteTexture(gl: WebGL2RenderingContext, palette: number[][]): WebGLTexture | null {
    const texture = gl.createTexture()
    if (!texture) return null

    // Convertir palette en format RGBA
    const paletteData = new Uint8Array(palette.length * 4)
    for (let i = 0; i < palette.length; i++) {
      const [r, g, b] = palette[i]
      paletteData[i * 4] = r
      paletteData[i * 4 + 1] = g
      paletteData[i * 4 + 2] = b
      paletteData[i * 4 + 3] = 255 // Alpha opaque
    }

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      palette.length,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      paletteData
    )

    // Configuration texture palette
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    return texture
  }
}