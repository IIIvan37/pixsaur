// WebGL Context Management
export class WebGLRenderer {
  public gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  
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