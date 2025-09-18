import type { IPaletteProcessor } from '../interfaces/image-processor'
import { WebGLRenderer } from '@/libs/pixsaur-webgl/src/renderer'
import { Shader } from '@/libs/pixsaur-webgl/src/shader'
import { vertexShader } from '@/libs/pixsaur-webgl/src/shaders/vertex.glsl'
import { dominantColorsShader } from '@/libs/pixsaur-webgl/src/shaders/dominant-colors.glsl'
import { adapterLogger } from '@/utils/logger'

export class WebGLPaletteProcessor implements IPaletteProcessor {
  public readonly isHardwareAccelerated = true
  private renderer: WebGLRenderer | null = null
  private dominantColorsShaderProgram: Shader | null = null
  private quadBuffer: WebGLBuffer | null = null
  
  constructor() {
    try {
      this.renderer = new WebGLRenderer()
      adapterLogger.debug('WebGL Palette Processor initialized successfully')
    } catch (error) {
      adapterLogger.warn('Failed to initialize WebGL Palette Processor:', error)
      this.renderer = null
    }
  }
  
  isAvailable(): boolean {
    return this.renderer !== null
  }
  
  async extractDominantColors(imageData: ImageData, maxColors: number): Promise<number[][]> {
    if (!this.renderer) {
      // Fallback vers une palette CPC basique si WebGL indisponible
      return this.getCPCFallbackPalette(maxColors)
    }

    try {
      return await this.extractDominantColorsWebGL(imageData, maxColors)
    } catch (error) {
      adapterLogger.warn('WebGL palette extraction failed, using CPU fallback:', error)
      return this.getCPCFallbackPalette(maxColors)
    }
  }

  private async extractDominantColorsWebGL(imageData: ImageData, maxColors: number): Promise<number[][]> {
    if (!this.renderer) throw new Error('WebGL renderer not available')
    
    const { width, height } = imageData
    const gl = this.renderer.gl

    // Initialiser le shader de couleurs dominantes si nécessaire
    this.dominantColorsShaderProgram ??= new Shader(gl, vertexShader, dominantColorsShader)

    // Créer texture source
    const sourceTexture = gl.createTexture()
    if (!sourceTexture) throw new Error('Failed to create source texture')
    
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, imageData.data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    // Créer framebuffer de sortie réduit pour l'échantillonnage
    const sampleSize = Math.min(64, Math.max(8, Math.sqrt(maxColors * 4))) // Taille adaptative
    const outputSize = Math.floor(sampleSize)
    
    const outputTexture = gl.createTexture()
    if (!outputTexture) throw new Error('Failed to create output texture')
    
    gl.bindTexture(gl.TEXTURE_2D, outputTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, outputSize, outputSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

    const framebuffer = gl.createFramebuffer()
    if (!framebuffer) throw new Error('Failed to create framebuffer')
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outputTexture, 0)

    // Setup viewport et render
    gl.viewport(0, 0, outputSize, outputSize)
    gl.useProgram(this.dominantColorsShaderProgram.program)
    
    // Bind texture source
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
    gl.uniform1i(gl.getUniformLocation(this.dominantColorsShaderProgram.program, 'uSourceTexture'), 0)
    
    // Uniforms
    gl.uniform2f(gl.getUniformLocation(this.dominantColorsShaderProgram.program, 'uTextureSize'), width, height)
    gl.uniform1i(gl.getUniformLocation(this.dominantColorsShaderProgram.program, 'uSampleStep'), Math.max(1, Math.floor(Math.min(width, height) / outputSize)))

    // Render fullscreen quad
    this.setupFullscreenQuad(gl)
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    // Lire les résultats
    const pixelData = new Uint8Array(outputSize * outputSize * 4)
    gl.readPixels(0, 0, outputSize, outputSize, gl.RGBA, gl.UNSIGNED_BYTE, pixelData)

    // Nettoyer
    gl.deleteTexture(sourceTexture)
    gl.deleteTexture(outputTexture) 
    gl.deleteFramebuffer(framebuffer)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    // Extraire et analyser les couleurs dominantes
    const colors = this.analyzeExtractedColors(pixelData, maxColors)
    
    adapterLogger.debug(`WebGL extracted ${colors.length} dominant colors from ${width}x${height} image`)
    return colors
  }

  private analyzeExtractedColors(pixelData: Uint8Array, maxColors: number): number[][] {
    const colorMap = new Map<string, { count: number, color: number[] }>()
    
    // Compter les occurrences de chaque couleur
    for (let i = 0; i < pixelData.length; i += 4) {
      const r = pixelData[i]
      const g = pixelData[i + 1] 
      const b = pixelData[i + 2]
      const colorKey = `${r},${g},${b}`
      
      if (colorMap.has(colorKey)) {
        const colorEntry = colorMap.get(colorKey)
        if (colorEntry) {
          colorEntry.count++
        }
      } else {
        colorMap.set(colorKey, { count: 1, color: [r, g, b] })
      }
    }
    
    // Trier par fréquence et prendre les plus dominantes
    const sortedColors = Array.from(colorMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, maxColors)
      .map(item => item.color)
    
    // Assurer un minimum de couleurs avec fallback CPC si nécessaire
    if (sortedColors.length < maxColors) {
      const cpcFallback = this.getCPCFallbackPalette(maxColors - sortedColors.length)
      sortedColors.push(...cpcFallback)
    }
    
    return sortedColors.slice(0, maxColors)
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

  private getCPCFallbackPalette(maxColors: number): number[][] {
    const cpcBasic = [
      [0, 0, 0],       // Noir
      [128, 0, 0],     // Rouge
      [0, 128, 0],     // Vert  
      [128, 128, 0],   // Jaune
      [0, 0, 128],     // Bleu
      [128, 0, 128],   // Magenta
      [0, 128, 128],   // Cyan
      [255, 255, 255], // Blanc
      [128, 128, 128], // Gris
      [255, 0, 0],     // Rouge vif
      [0, 255, 0],     // Vert vif
      [255, 255, 0],   // Jaune vif
      [0, 0, 255],     // Bleu vif
      [255, 0, 255],   // Magenta vif
      [0, 255, 255],   // Cyan vif
      [255, 128, 0],   // Orange
    ]
    
    return cpcBasic.slice(0, Math.min(maxColors, cpcBasic.length))
  }
  
  dispose(): void {
    if (this.dominantColorsShaderProgram && this.renderer) {
      this.renderer.gl.deleteProgram(this.dominantColorsShaderProgram.program)
      this.dominantColorsShaderProgram = null
    }
    
    if (this.renderer) {
      this.renderer.dispose()
      this.renderer = null
    }
    
    adapterLogger.debug('WebGL Palette Processor disposed')
  }
}