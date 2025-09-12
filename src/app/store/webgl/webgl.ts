import { atom } from 'jotai'
import { PixsaurWebGL, type DitheringConfig } from '@/libs/pixsaur-webgl'
import { generateAmstradCPCPalette } from '@/palettes/cpc-palette'
import type { Vector } from '@/libs/pixsaur-color/src/type'

// Singleton WebGL instance
const webglInstanceAtom = atom<PixsaurWebGL | null>(null)

// Initialize WebGL instance
export const initWebGLAtom = atom(null, (_get, set) => {
  try {
    const webgl = new PixsaurWebGL()
    // Set CPC palette immediately
    const cpcPalette = generateAmstradCPCPalette()
    webgl.setPalette(cpcPalette)
    set(webglInstanceAtom, webgl)
  } catch (error) {
    console.error('Failed to initialize WebGL:', error)
    set(webglInstanceAtom, null)
  }
})

// Atom to check if WebGL is available
export const webglAvailableAtom = atom((get) => {
  const instance = get(webglInstanceAtom)
  return instance !== null
})

// WebGL-based CPC quantization
export const webglQuantizeAtom = atom(
  null,
  async (get, _set, imageData: ImageData) => {
    const webgl = get(webglInstanceAtom)
    if (!webgl) {
      throw new Error('WebGL not initialized')
    }
    
    try {
      return webgl.quantizeToCC(imageData)
    } catch (error) {
      console.error('WebGL quantization failed:', error)
      throw error
    }
  }
)

// WebGL-based dithering
export const webglDitherAtom = atom(
  null,
  async (get, _set, params: {
    imageData: ImageData
    palette: Vector<'RGB'>[]
    config: DitheringConfig
  }) => {
    const webgl = get(webglInstanceAtom)
    if (!webgl) {
      throw new Error('WebGL not initialized')
    }
    
    try {
      // Update palette if needed
      webgl.setPalette(params.palette)
      return webgl.applyDithering(params.imageData, params.palette, params.config)
    } catch (error) {
      console.error('WebGL dithering failed:', error)
      throw error
    }
  }
)

// Cleanup atom
export const cleanupWebGLAtom = atom(null, (get, set) => {
  const webgl = get(webglInstanceAtom)
  if (webgl) {
    webgl.dispose()
    set(webglInstanceAtom, null)
  }
})