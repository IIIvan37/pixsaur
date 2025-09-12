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

  createTexture(data: ImageData): WebGLTexture | null {
    const texture = this.gl.createTexture()
    if (!texture) return null

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      data
    )

    // Set texture parameters
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)

    return texture
  }

  createFramebuffer(width: number, height: number): { framebuffer: WebGLFramebuffer; texture: WebGLTexture } | null {
    const framebuffer = this.gl.createFramebuffer()
    const texture = this.gl.createTexture()
    
    if (!framebuffer || !texture) return null

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer)
    
    // Create texture for framebuffer
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST)

    // Attach texture to framebuffer
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture, 0)

    return { framebuffer, texture }
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