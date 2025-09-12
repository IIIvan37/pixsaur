export class Shader {
  public program: WebGLProgram
  
  constructor(
    private gl: WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string
  ) {
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource)
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource)
    
    this.program = this.createProgram(vertexShader, fragmentShader)
    
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
  }

  private compileShader(type: GLenum, source: string): WebGLShader {
    const shader = this.gl.createShader(type)
    if (!shader) throw new Error('Failed to create shader')

    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(shader)
      this.gl.deleteShader(shader)
      throw new Error(`Shader compilation error: ${error}`)
    }

    return shader
  }

  private createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
    const program = this.gl.createProgram()
    if (!program) throw new Error('Failed to create program')

    this.gl.attachShader(program, vertexShader)
    this.gl.attachShader(program, fragmentShader)
    this.gl.linkProgram(program)

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(program)
      this.gl.deleteProgram(program)
      throw new Error(`Program linking error: ${error}`)
    }

    return program
  }

  use() {
    this.gl.useProgram(this.program)
  }

  getUniformLocation(name: string): WebGLUniformLocation | null {
    return this.gl.getUniformLocation(this.program, name)
  }

  getAttribLocation(name: string): number {
    return this.gl.getAttribLocation(this.program, name)
  }

  setFloat(location: WebGLUniformLocation | null, value: number) {
    if (location) this.gl.uniform1f(location, value)
  }

  setInt(location: WebGLUniformLocation | null, value: number) {
    if (location) this.gl.uniform1i(location, value)
  }

  setVec2(location: WebGLUniformLocation | null, x: number, y: number) {
    if (location) this.gl.uniform2f(location, x, y)
  }

  setVec3(location: WebGLUniformLocation | null, x: number, y: number, z: number) {
    if (location) this.gl.uniform3f(location, x, y, z)
  }

  setVec4(location: WebGLUniformLocation | null, x: number, y: number, z: number, w: number) {
    if (location) this.gl.uniform4f(location, x, y, z, w)
  }

  dispose() {
    this.gl.deleteProgram(this.program)
  }
}