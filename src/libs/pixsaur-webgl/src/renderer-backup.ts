// WebGL Context Management
export class WebGLRenderer {
  public gl: WebGL2RenderingContext
  private readonly canvas: HTMLCanvasElement
  
  constructor() {
    this.canvas = document.createElement('canvas')
    const gl = this.canvas.getContext('webgl2')
    if (!gl) {
      throw new Error('WebGL2 not supported')
    }
    this.gl = gl
  }

  setSize(width: number, height: number) {
    this.canvas.width = width
    this.canvas.height = height
    this.gl.viewport(0, 0, width, height)
  }

  createTexture(width: number, height: number, data?: Uint8Array): WebGLTexture {
    const texture = this.gl.createTexture()
    if (!texture) throw new Error('Failed to create texture')

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    
    // Set texture parameters for pixel-perfect rendering
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST)

    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      width,
      height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      data || null
    )

    return texture
  }

  createTextureFromImageData(imageData: ImageData): WebGLTexture {
    return this.createTexture(imageData.width, imageData.height, new Uint8Array(imageData.data.buffer))
  }

  processImageAdjustments(
    imageData: ImageData,
    adjustments: {
      rgb: { r: number; g: number; b: number }
      brightness: number
      contrast: number  
      saturation: number
      posterization: number
    }
  ): ImageData | null {
    try {
      const { width, height } = imageData
      this.setSize(width, height)

      // Create and upload texture
      const texture = this.gl.createTexture()
      if (!texture) return null

      this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, imageData)
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST)
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST)
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)

      // Set uniforms for adjustment parameters
      const adjustmentProgram = this.getOrCreateAdjustmentProgram()
      if (!adjustmentProgram) return null

      this.gl.useProgram(adjustmentProgram)

      // Set uniform values
      this.gl.uniform3f(this.gl.getUniformLocation(adjustmentProgram, 'u_rgbFactors'), 
        adjustments.rgb.r, adjustments.rgb.g, adjustments.rgb.b)
      this.gl.uniform1f(this.gl.getUniformLocation(adjustmentProgram, 'u_brightness'), adjustments.brightness)
      this.gl.uniform1f(this.gl.getUniformLocation(adjustmentProgram, 'u_contrast'), adjustments.contrast)
      this.gl.uniform1f(this.gl.getUniformLocation(adjustmentProgram, 'u_saturation'), adjustments.saturation)
      this.gl.uniform1f(this.gl.getUniformLocation(adjustmentProgram, 'u_posterization'), adjustments.posterization)

      // Set texture uniform
      this.gl.uniform1i(this.gl.getUniformLocation(adjustmentProgram, 'u_image'), 0)

      // Render fullscreen quad
      this.renderFullscreenQuad()

      // Clean up texture
      this.gl.deleteTexture(texture)

      // Return processed image
      return this.toImageData(width, height)
    } catch (error) {
      console.error('WebGL image adjustment failed:', error)
      return null
    }
  }

  private adjustmentProgram: WebGLProgram | null = null

  private getOrCreateAdjustmentProgram(): WebGLProgram | null {
    if (this.adjustmentProgram) {
      return this.adjustmentProgram
    }

    try {
      // Import the shader (we'll need to create this)
      const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, `#version 300 es
        in vec4 a_position;
        in vec2 a_texCoord;
        out vec2 v_texCoord;
        
        void main() {
          gl_Position = a_position;
          v_texCoord = a_texCoord;
        }`)

      const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, this.getAdjustmentFragmentShader())
      
      this.adjustmentProgram = this.createProgram(vertexShader, fragmentShader)
      
      // Clean up individual shaders
      this.gl.deleteShader(vertexShader)
      this.gl.deleteShader(fragmentShader)
      
      return this.adjustmentProgram
    } catch (error) {
      console.error('Failed to create adjustment program:', error)
      return null
    }
  }

  private getAdjustmentFragmentShader(): string {
    // We'll import this from the shader file
    return `#version 300 es
      precision highp float;
      
      in vec2 v_texCoord;
      out vec4 fragColor;
      
      uniform sampler2D u_image;
      uniform vec3 u_rgbFactors;
      uniform float u_brightness;
      uniform float u_contrast;
      uniform float u_saturation;
      uniform float u_posterization;
      
      // ... (rest of shader code will be imported)
      void main() {
        vec4 pixel = texture(u_image, v_texCoord);
        fragColor = pixel; // Placeholder
      }`
  }

  readPixels(x: number, y: number, width: number, height: number): Uint8Array {
    const pixels = new Uint8Array(width * height * 4)
    this.gl.readPixels(x, y, width, height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels)
    return pixels
  }

  toImageData(width: number, height: number): ImageData {
    const pixels = this.readPixels(0, 0, width, height)
    
    // WebGL pixels are bottom-up, flip them
    const flipped = new Uint8ClampedArray(pixels.length)
    for (let y = 0; y < height; y++) {
      const srcRow = (height - 1 - y) * width * 4
      const dstRow = y * width * 4
      flipped.set(pixels.subarray(srcRow, srcRow + width * 4), dstRow)
    }
    
    return new ImageData(flipped, width, height)
  }

  dispose() {
    // Clean up resources if needed
  }
}