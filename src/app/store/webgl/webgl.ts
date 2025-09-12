import { atom } from 'jotai'
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