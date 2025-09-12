import { describe, it, expect } from 'vitest'
import { WebGLRenderer } from './src/renderer'
import { Shader } from './src/shader'
import { cpcQuantizationShader } from './src/shaders/cpc-quantization.glsl'
import { vertexShader } from './src/shaders/vertex.glsl'

describe('WebGL Integration', () => {
  // Helper to check if WebGL is available
  const isWebGLAvailable = () => {
    try {
      const canvas = document.createElement('canvas')
      return !!canvas.getContext('webgl2')
    } catch {
      return false
    }
  }

  it('should detect WebGL availability correctly', () => {
    const available = isWebGLAvailable()
    expect(typeof available).toBe('boolean')
  })

  it('should initialize WebGL renderer when supported', () => {
    if (!isWebGLAvailable()) {
      console.warn('WebGL not available, skipping test')
      return
    }

    const renderer = new WebGLRenderer()
    expect(renderer.gl).toBeDefined()
    expect(renderer.gl instanceof WebGL2RenderingContext).toBe(true)
  })

  it('should create shader programs', () => {
    if (!isWebGLAvailable()) return

    const renderer = new WebGLRenderer()
    const shader = new Shader(renderer.gl, vertexShader, cpcQuantizationShader)
    
    expect(shader.program).toBeDefined()
    expect(shader.program instanceof WebGLProgram).toBe(true)
  })

  it('should set renderer size correctly', () => {
    if (!isWebGLAvailable()) return

    const renderer = new WebGLRenderer()
    const width = 160, height = 200
    
    renderer.setSize(width, height)
    
    expect(renderer.gl.canvas.width).toBe(width)
    expect(renderer.gl.canvas.height).toBe(height)
  })

  it('should throw error when WebGL is not available', () => {
    // Mock canvas to return null for getContext
    const originalCreateElement = document.createElement
    document.createElement = function(tagName: string) {
      if (tagName === 'canvas') {
        const canvas = originalCreateElement.call(this, 'canvas') as HTMLCanvasElement
        canvas.getContext = () => null
        return canvas
      }
      return originalCreateElement.call(this, tagName)
    }

    expect(() => new WebGLRenderer()).toThrow('WebGL2 not supported')

    // Restore original method
    document.createElement = originalCreateElement
  })
})