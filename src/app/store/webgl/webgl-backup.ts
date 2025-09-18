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
import { WebGLImageProcessor, type ImageAdjustmentConfig } from '../../../libs/pixsaur-webgl/src/image-processor'

// Check if WebGL2 is available
export const webglAvailableAtom = atom<boolean>(() => {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    return !!gl
  } catch {
    return false
  }
})

// WebGL Image Processor instance (singleton)
const webglProcessorAtom = atom<WebGLImageProcessor | null>((get) => {
  const available = get(webglAvailableAtom)
  if (!available) return null
  
  try {
    return new WebGLImageProcessor()
  } catch (error) {
    console.warn('Failed to create WebGL processor:', error)
    return null
  }
})

// WebGL-accelerated image adjustment function
export const webglAdjustImageAtom = atom(null, (get, _set, { imageData, config }: { 
  imageData: ImageData
  config: ImageAdjustmentConfig 
}) => {
  const processor = get(webglProcessorAtom)
  if (!processor) return null
  
  return processor.processAdjustments(imageData, config)
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