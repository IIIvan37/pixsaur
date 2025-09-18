import { WebGLRenderer } from './renderer'
import { Shader } from './shader'
import { vertexShader } from './shaders/vertex.glsl'
import { imageAdjustmentShader } from './shaders/image-adjustment.glsl'
import { logger } from '@/utils/logger'

export interface ImageAdjustmentConfig {
  rgb: { r: number; g: number; b: number }
  brightness: number
  contrast: number  
  saturation: number
  posterization: number
}

export class WebGLImageProcessor {
  private renderer: WebGLRenderer
  private adjustmentShader: Shader | null = null

  constructor() {
    this.renderer = new WebGLRenderer()
  }

  processAdjustments(imageData: ImageData, config: ImageAdjustmentConfig): ImageData | null {
    try {
      const { width, height } = imageData
      this.renderer.setSize(width, height)

      // Create shader if needed
      if (!this.adjustmentShader) {
        this.adjustmentShader = new Shader(this.renderer.gl, vertexShader, imageAdjustmentShader)
      }

      // Create and upload texture
      const texture = this.renderer.gl.createTexture()
      if (!texture) {
        return null
      }

      const gl = this.renderer.gl
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

      // Use the shader program
      gl.useProgram(this.adjustmentShader.program)

      // Set uniform values
      gl.uniform3f(gl.getUniformLocation(this.adjustmentShader.program, 'u_rgbFactors'), 
        config.rgb.r, config.rgb.g, config.rgb.b)
      gl.uniform1f(gl.getUniformLocation(this.adjustmentShader.program, 'u_brightness'), config.brightness)
      gl.uniform1f(gl.getUniformLocation(this.adjustmentShader.program, 'u_contrast'), config.contrast)
      gl.uniform1f(gl.getUniformLocation(this.adjustmentShader.program, 'u_saturation'), config.saturation)
      gl.uniform1f(gl.getUniformLocation(this.adjustmentShader.program, 'u_posterization'), config.posterization)

      // Set texture uniform
      gl.uniform1i(gl.getUniformLocation(this.adjustmentShader.program, 'u_image'), 0)

      // Setup vertex buffer for fullscreen quad
      this.setupFullscreenQuad()

      // Draw
      gl.drawArrays(gl.TRIANGLES, 0, 6)

      // Clean up texture
      gl.deleteTexture(texture)

      // Return processed image
      return this.renderer.toImageData(width, height)
    } catch (error) {
      logger.error('WebGL image adjustment failed:', error)
      return null
    }
  }

  private quadBuffer: WebGLBuffer | null = null

  private setupFullscreenQuad() {
    if (!this.quadBuffer) {
      const gl = this.renderer.gl
      
      // Create vertex buffer for fullscreen quad
      const vertices = new Float32Array([
        // Position (x,y)  Texture coords (u,v) - Y inversé pour WebGL
        -1, -1,           0, 1,  // bas-gauche -> haut-gauche texture
         1, -1,           1, 1,  // bas-droite -> haut-droite texture
        -1,  1,           0, 0,  // haut-gauche -> bas-gauche texture
        -1,  1,           0, 0,  // haut-gauche -> bas-gauche texture
         1, -1,           1, 1,  // bas-droite -> haut-droite texture
         1,  1,           1, 0,  // haut-droite -> bas-droite texture
      ])

      this.quadBuffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
    }

    const gl = this.renderer.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)

    // Position attribute (location 0, 2 floats, stride 16, offset 0)
    if (this.adjustmentShader) {
      const positionLoc = gl.getAttribLocation(this.adjustmentShader.program, 'a_position')
      if (positionLoc >= 0) {
        gl.enableVertexAttribArray(positionLoc)
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 16, 0)
      }

      // Texture coordinate attribute (location 1, 2 floats, stride 16, offset 8) 
      const texCoordLoc = gl.getAttribLocation(this.adjustmentShader.program, 'a_texCoord')
      if (texCoordLoc >= 0) {
        gl.enableVertexAttribArray(texCoordLoc)
        gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 16, 8)
      }
    }
  }

  dispose() {
    if (this.quadBuffer) {
      this.renderer.gl.deleteBuffer(this.quadBuffer)
    }
    this.renderer.dispose()
  }
}