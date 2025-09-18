/* eslint-disable react-hooks/rules-of-hooks */
// Ce fichier contient des appels WebGL qui ne sont pas des hooks React
import type { 
  IImageProcessor, 
  IImageAdjustmentConfig, 
  IQuantizationConfig, 
  IDitheringConfig 
} from '../interfaces/image-processor'
import { WebGLRenderer } from '@/libs/pixsaur-webgl/src/renderer'
import { Shader } from '@/libs/pixsaur-webgl/src/shader'
import { vertexShader } from '@/libs/pixsaur-webgl/src/shaders/vertex.glsl'
import { cpcQuantizationShader } from '@/libs/pixsaur-webgl/src/shaders/cpc-quantization.glsl'
import { bayerDitheringShader } from '@/libs/pixsaur-webgl/src/shaders/bayer-dithering.glsl'
import { adapterLogger } from '@/utils/logger'

/**
 * Processeur WebGL optimisé avec pipeline multi-pass sans roundtrips CPU
 * Permet l'enchaînement d'opérations directement sur GPU pour des performances maximales
 */
export class WebGLPipelineProcessor implements IImageProcessor {
  public readonly isHardwareAccelerated = true
  private renderer: WebGLRenderer | null = null
  private quantizationShader: Shader | null = null
  private ditheringShader: Shader | null = null
  private quadBuffer: WebGLBuffer | null = null
  
  constructor() {
    try {
      this.renderer = new WebGLRenderer()
      adapterLogger.debug('WebGL Pipeline Processor initialized successfully')
    } catch (error) {
      adapterLogger.warn('Failed to initialize WebGL Pipeline Processor:', error)
      this.renderer = null
    }
  }
  
  isAvailable(): boolean {
    return this.renderer !== null
  }

  async processImage(_imageData: ImageData, _config: IImageAdjustmentConfig): Promise<ImageData> {
    // Pour l'instant, déléguer à la quantization + dithering pipeline
    throw new Error('processImage not implemented - use specific pipeline methods')
  }

  async applyAdjustments(imageData: ImageData, config: IImageAdjustmentConfig): Promise<ImageData> {
    // Déléguer vers processImage pour l'instant
    return this.processImage(imageData, config)
  }

  async processComplete(
    imageData: ImageData, 
    adjustmentConfig: IImageAdjustmentConfig,
    _quantizationConfig: IQuantizationConfig,
    ditheringConfig: IDitheringConfig,
    palette: number[][]
  ): Promise<ImageData> {
    // Pipeline complet optimisé WebGL
    if (!this.renderer) {
      throw new Error('WebGL renderer not available for complete processing')
    }

    try {
      // D'abord appliquer les ajustements si nécessaire
      const processedImage = imageData
      if (adjustmentConfig && Object.keys(adjustmentConfig).length > 0) {
        // Pour l'instant ignorer les ajustements, focus sur quantization+dithering
        adapterLogger.debug('Skipping adjustments in pipeline - not implemented yet')
      }

      // Ensuite faire quantization + dithering en pipeline optimisé
      return await this.processQuantizationAndDithering(processedImage, palette, ditheringConfig)
    } catch (error) {
      adapterLogger.error('Complete WebGL pipeline processing failed:', error)
      throw error
    }
  }
  
  async quantizeColors(imageData: ImageData, _config: IQuantizationConfig): Promise<ImageData> {
    if (!this.renderer) {
      throw new Error('WebGL renderer not available for quantization')
    }
    
    try {
      const { width, height } = imageData
      this.renderer.setSize(width, height)
      
      // Initialiser le shader de quantization
      this.quantizationShader ??= new Shader(this.renderer.gl, vertexShader, cpcQuantizationShader)
      
      // Créer texture source
      const sourceTexture = this.renderer.createTexture(imageData)
      if (!sourceTexture) throw new Error('Failed to create source texture')
      
      // Créer framebuffer de sortie
      const framebuffer = this.renderer.createFramebuffer(width, height)
      if (!framebuffer) throw new Error('Failed to create framebuffer')
      
      const gl = this.renderer.gl
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer.framebuffer)
      
      // Utiliser le shader de quantization
      gl.useProgram(this.quantizationShader.program)
      
      // Bind texture
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
      gl.uniform1i(gl.getUniformLocation(this.quantizationShader.program, 'uSourceTexture'), 0)
      
      // Render
      this.setupFullscreenQuad(gl)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      
      // Lire résultat
      const result = this.renderer.toImageData(width, height)
      
      // Cleanup
      gl.deleteTexture(sourceTexture)
      gl.deleteTexture(framebuffer.texture)
      gl.deleteFramebuffer(framebuffer.framebuffer)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      
      return result
      
    } catch (error) {
      adapterLogger.error('WebGL quantization failed:', error)
      throw error
    }
  }

  async applyDithering(
    imageData: ImageData,
    palette: number[][],
    config: IDitheringConfig
  ): Promise<ImageData> {
    if (!this.renderer) {
      throw new Error('WebGL renderer not available for dithering')
    }
    
    try {
      const { width, height } = imageData
      this.renderer.setSize(width, height)
      
      // Initialiser le shader de dithering
      this.ditheringShader ??= new Shader(this.renderer.gl, vertexShader, bayerDitheringShader)
      
      // Créer texture source
      const sourceTexture = this.renderer.createTexture(imageData)
      if (!sourceTexture) throw new Error('Failed to create source texture')
      
      // Créer texture de palette
      const paletteTexture = this.createPaletteTexture(this.renderer.gl, palette)
      if (!paletteTexture) throw new Error('Failed to create palette texture')
      
      // Créer framebuffer de sortie
      const framebuffer = this.renderer.createFramebuffer(width, height)
      if (!framebuffer) throw new Error('Failed to create framebuffer')
      
      const gl = this.renderer.gl
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer.framebuffer)
      
      // Utiliser le shader de dithering
      gl.useProgram(this.ditheringShader.program)
      
      // Bind textures
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
      gl.uniform1i(gl.getUniformLocation(this.ditheringShader.program, 'uSourceTexture'), 0)
      
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, paletteTexture)
      gl.uniform1i(gl.getUniformLocation(this.ditheringShader.program, 'uPaletteTexture'), 1)
      
      // Uniforms pour dithering
      const matrixSize = config.matrixSize || 4
      gl.uniform1i(gl.getUniformLocation(this.ditheringShader.program, 'uMatrixSize'), matrixSize)
      gl.uniform1i(gl.getUniformLocation(this.ditheringShader.program, 'uPaletteSize'), palette.length)
      gl.uniform2f(gl.getUniformLocation(this.ditheringShader.program, 'uTextureSize'), width, height)
      
      // Render
      this.setupFullscreenQuad(gl)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      
      // Lire résultat
      const result = this.renderer.toImageData(width, height)
      
      // Cleanup
      gl.deleteTexture(sourceTexture)
      gl.deleteTexture(paletteTexture)
      gl.deleteTexture(framebuffer.texture)
      gl.deleteFramebuffer(framebuffer.framebuffer)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      
      return result
      
    } catch (error) {
      adapterLogger.error('WebGL dithering failed:', error)
      throw error
    }
  }

  /**
   * Pipeline optimisé : Quantization + Dithering en une seule passe GPU
   * Évite le roundtrip CPU entre les deux opérations
   */
  async processQuantizationAndDithering(
    imageData: ImageData,
    palette: number[][],
    ditheringConfig: IDitheringConfig
  ): Promise<ImageData> {
    if (!this.renderer) {
      throw new Error('WebGL renderer not available for pipeline processing')
    }

    try {
      const { width, height } = imageData
      this.renderer.setSize(width, height)
      
      // Initialiser les shaders
      this.quantizationShader ??= new Shader(this.renderer.gl, vertexShader, cpcQuantizationShader)
      this.ditheringShader ??= new Shader(this.renderer.gl, vertexShader, bayerDitheringShader)
      
      const gl = this.renderer.gl
      
      // === PASS 1: Quantization ===
      
      // Créer texture source
      const sourceTexture = this.renderer.createTexture(imageData)
      if (!sourceTexture) throw new Error('Failed to create source texture')
      
      // Framebuffer intermédiaire pour quantization
      const intermediateFramebuffer = this.renderer.createFramebuffer(width, height)
      if (!intermediateFramebuffer) throw new Error('Failed to create intermediate framebuffer')
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, intermediateFramebuffer.framebuffer)
      gl.useProgram(this.quantizationShader.program)
      
      // Bind source texture
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
      gl.uniform1i(gl.getUniformLocation(this.quantizationShader.program, 'uSourceTexture'), 0)
      
      // Render quantization pass
      this.setupFullscreenQuad(gl)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      
      // === PASS 2: Dithering (utilise résultat quantization) ===
      
      // Créer texture de palette
      const paletteTexture = this.createPaletteTexture(gl, palette)
      if (!paletteTexture) throw new Error('Failed to create palette texture')
      
      // Framebuffer final
      const finalFramebuffer = this.renderer.createFramebuffer(width, height)
      if (!finalFramebuffer) throw new Error('Failed to create final framebuffer')
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, finalFramebuffer.framebuffer)
      gl.useProgram(this.ditheringShader.program)
      
      // Bind quantized image comme source pour dithering
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, intermediateFramebuffer.texture)
      gl.uniform1i(gl.getUniformLocation(this.ditheringShader.program, 'uSourceTexture'), 0)
      
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, paletteTexture)
      gl.uniform1i(gl.getUniformLocation(this.ditheringShader.program, 'uPaletteTexture'), 1)
      
      // Uniforms pour dithering
      const matrixSize = ditheringConfig.matrixSize || 4
      gl.uniform1i(gl.getUniformLocation(this.ditheringShader.program, 'uMatrixSize'), matrixSize)
      gl.uniform1i(gl.getUniformLocation(this.ditheringShader.program, 'uPaletteSize'), palette.length)
      gl.uniform2f(gl.getUniformLocation(this.ditheringShader.program, 'uTextureSize'), width, height)
      
      // Render dithering pass
      this.setupFullscreenQuad(gl)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      
      // Lire résultat final
      const result = this.renderer.toImageData(width, height)
      
      // Cleanup complet
      gl.deleteTexture(sourceTexture)
      gl.deleteTexture(paletteTexture)
      gl.deleteTexture(intermediateFramebuffer.texture)
      gl.deleteFramebuffer(intermediateFramebuffer.framebuffer)
      gl.deleteTexture(finalFramebuffer.texture)
      gl.deleteFramebuffer(finalFramebuffer.framebuffer)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      
      adapterLogger.debug(`WebGL pipeline processed ${width}x${height} image with quantization + dithering`)
      return result
      
    } catch (error) {
      adapterLogger.error('WebGL pipeline processing failed:', error)
      throw error
    }
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, palette.length, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, paletteData)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    return texture
  }
  
  dispose(): void {
    if (this.quadBuffer && this.renderer) {
      this.renderer.gl.deleteBuffer(this.quadBuffer)
      this.quadBuffer = null
    }
    
    if (this.quantizationShader && this.renderer) {
      this.renderer.gl.deleteProgram(this.quantizationShader.program)
      this.quantizationShader = null
    }
    
    if (this.ditheringShader && this.renderer) {
      this.renderer.gl.deleteProgram(this.ditheringShader.program)
      this.ditheringShader = null
    }
    
    if (this.renderer) {
      this.renderer.dispose()
      this.renderer = null
    }
    
    adapterLogger.debug('WebGL Pipeline Processor disposed')
  }
}