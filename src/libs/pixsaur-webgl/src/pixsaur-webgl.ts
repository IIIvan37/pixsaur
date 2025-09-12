import { WebGLRenderer } from './renderer'
import { Shader } from './shader'
import { vertexShader } from './shaders/vertex.glsl'
import { cpcQuantizationShader } from './shaders/cpc-quantization.glsl'
import { bayerDitheringShader } from './shaders/bayer-dithering.glsl'
import type { Vector } from '@/libs/pixsaur-color/src/type'

export interface DitheringConfig {
  mode: 'none' | 'bayer2x2' | 'bayer4x4' | 'bayer8x8'
  intensity: number
}

export class PixsaurWebGL {
  private renderer: WebGLRenderer
  private gl: WebGL2RenderingContext
  
  // Shaders
  private quantizationShader?: Shader
  private bayerDitheringShader?: Shader
  
  // Geometry for fullscreen quad
  private quadVAO: WebGLVertexArrayObject | null = null
  private quadVBO: WebGLBuffer | null = null
  
  // Palette texture
  private paletteTexture: WebGLTexture | null = null

  constructor() {
    this.renderer = new WebGLRenderer()
    this.gl = this.renderer.gl
    
    this.initShaders()
    this.initGeometry()
  }

  private initShaders() {
    this.quantizationShader = new Shader(this.gl, vertexShader, cpcQuantizationShader)
    this.bayerDitheringShader = new Shader(this.gl, vertexShader, bayerDitheringShader)
  }

  private initGeometry() {
    // Create fullscreen quad
    const vertices = new Float32Array([
      // Position  // TexCoord
      -1, -1, 0,   0, 0,
       1, -1, 0,   1, 0,
       1,  1, 0,   1, 1,
      -1, -1, 0,   0, 0,
       1,  1, 0,   1, 1,
      -1,  1, 0,   0, 1
    ])

    this.quadVAO = this.gl.createVertexArray()
    this.quadVBO = this.gl.createBuffer()

    this.gl.bindVertexArray(this.quadVAO)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadVBO)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW)

    // Position attribute
    this.gl.enableVertexAttribArray(0)
    this.gl.vertexAttribPointer(0, 3, this.gl.FLOAT, false, 20, 0)

    // TexCoord attribute  
    this.gl.enableVertexAttribArray(1)
    this.gl.vertexAttribPointer(1, 2, this.gl.FLOAT, false, 20, 12)

    this.gl.bindVertexArray(null)
  }

  setPalette(palette: Vector<'RGB'>[]): void {
    // Convert palette to texture data
    const paletteData = new Uint8Array(palette.length * 4)
    for (let i = 0; i < palette.length; i++) {
      const [r, g, b] = palette[i]
      paletteData[i * 4 + 0] = r
      paletteData[i * 4 + 1] = g  
      paletteData[i * 4 + 2] = b
      paletteData[i * 4 + 3] = 255
    }

    if (this.paletteTexture) {
      this.gl.deleteTexture(this.paletteTexture)
    }

    this.paletteTexture = this.renderer.createTexture(palette.length, 1, paletteData)
  }

  // Apply CPC quantization only
  quantizeToCC(sourceImageData: ImageData): ImageData {
    if (!this.quantizationShader) throw new Error('Quantization shader not initialized')

    const { width, height } = sourceImageData
    this.renderer.setSize(width, height)

    // Create source texture
    const sourceTexture = this.renderer.createTextureFromImageData(sourceImageData)

    // Render
    this.quantizationShader.use()
    
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, sourceTexture)
    this.quantizationShader.setInt(this.quantizationShader.getUniformLocation('uSourceTexture'), 0)

    this.gl.bindVertexArray(this.quadVAO)
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)

    // Read result
    const result = this.renderer.toImageData(width, height)

    // Cleanup
    this.gl.deleteTexture(sourceTexture)

    return result
  }

  // Apply dithering with palette reduction
  applyDithering(
    sourceImageData: ImageData, 
    palette: Vector<'RGB'>[],
    config: DitheringConfig
  ): ImageData {
    if (!this.bayerDitheringShader || !this.paletteTexture) {
      throw new Error('Dithering shader or palette not initialized')
    }

    const { width, height } = sourceImageData
    this.renderer.setSize(width, height)

    // Create source texture
    const sourceTexture = this.renderer.createTextureFromImageData(sourceImageData)

    // Render
    this.bayerDitheringShader.use()

    // Bind textures
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, sourceTexture)
    this.bayerDitheringShader.setInt(this.bayerDitheringShader.getUniformLocation('uSourceTexture'), 0)

    this.gl.activeTexture(this.gl.TEXTURE1)  
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.paletteTexture)
    this.bayerDitheringShader.setInt(this.bayerDitheringShader.getUniformLocation('uPaletteTexture'), 1)

    // Set uniforms
    this.bayerDitheringShader.setVec2(
      this.bayerDitheringShader.getUniformLocation('uTextureSize'), 
      width, height
    )
    this.bayerDitheringShader.setFloat(
      this.bayerDitheringShader.getUniformLocation('uIntensity'), 
      config.intensity
    )
    this.bayerDitheringShader.setInt(
      this.bayerDitheringShader.getUniformLocation('uPaletteSize'), 
      palette.length
    )

    // Set Bayer matrix size
    let bayerSize = 8
    if (config.mode === 'bayer2x2') bayerSize = 2
    else if (config.mode === 'bayer4x4') bayerSize = 4
    
    this.bayerDitheringShader.setInt(
      this.bayerDitheringShader.getUniformLocation('uBayerSize'), 
      bayerSize
    )

    this.gl.bindVertexArray(this.quadVAO)
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)

    // Read result
    const result = this.renderer.toImageData(width, height)

    // Cleanup
    this.gl.deleteTexture(sourceTexture)

    return result
  }

  dispose() {
    this.quantizationShader?.dispose()
    this.bayerDitheringShader?.dispose()
    
    if (this.paletteTexture) this.gl.deleteTexture(this.paletteTexture)
    if (this.quadVBO) this.gl.deleteBuffer(this.quadVBO)
    if (this.quadVAO) this.gl.deleteVertexArray(this.quadVAO)
    
    this.renderer.dispose()
  }
}