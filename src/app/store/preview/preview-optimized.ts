import { atom } from 'jotai'
import { 
  quantizerAtom, 
  croppedImageAtom,
  reducedPaletteRgbAtom
} from './preview'
import { modeAtom, ditheringAtom } from '../config/config'
import { getVisualRegionNormalized } from '@/utils/get-visual-region'
import { CPC_MODE_CONFIG } from '../config/types'
import { remapImageDataToPalette } from '@/utils/exports/rgb-to-indexes'
import type { Vector } from '@/libs/pixsaur-color/src/type'

// Palette réduite sans copie profonde systématique
export const optimizedReducedPaletteRawAtom = atom<Vector[]>((get) => {
  const quantizer = get(quantizerAtom)
  const mode = get(modeAtom)
  if (!quantizer) return []
  
  // Éviter la copie profonde - retourner directement
  const raw = quantizer.quantize(CPC_MODE_CONFIG[mode].nColors)
  return raw
})

// Cache pour éviter les recalculs de dithering coûteux
const ditheringCacheAtom = atom<{
  key: string
  buffer: Uint8ClampedArray
  width: number  
  height: number
} | null>(null)

export const previewBufferCacheAtom = atom(
  (get) => {
    const quantizer = get(quantizerAtom)
    const reduced = get(optimizedReducedPaletteRawAtom)
    const cropped = get(croppedImageAtom)
    const dithering = get(ditheringAtom)
    const mode = get(modeAtom)
    
    if (!quantizer || !cropped) return null

    const normalized = getVisualRegionNormalized(cropped, mode)
    
    // Clé de cache basée sur les paramètres
    const cacheKey = `${normalized.width}x${normalized.height}_${dithering.mode}_${dithering.intensity}_${mode}_${reduced.length}`
    
    const cached = get(ditheringCacheAtom)
    if (cached && cached.key === cacheKey) {
      return {
        buffer: cached.buffer,
        width: cached.width,
        height: cached.height
      }
    }
    
    // Le dithering est la partie la plus coûteuse - la calculer
    const previewBuffer = quantizer.dither(normalized, reduced, {
      mode: dithering.mode,
      intensity: dithering.intensity
    })

    return {
      buffer: previewBuffer,
      width: normalized.width,
      height: normalized.height,
      cacheKey
    }
  },
  (_get, set, update: { buffer: Uint8ClampedArray; width: number; height: number; cacheKey: string } | null) => {
    if (update?.cacheKey) {
      set(ditheringCacheAtom, {
        key: update.cacheKey,
        buffer: update.buffer,
        width: update.width,
        height: update.height
      })
    }
  }
)

// Image preview optimisée évitant les créations de canvas multiples
export const optimizedPreviewImageAtom = atom((get) => {
  const bufferCache = get(previewBufferCacheAtom)
  const reducedRgb = get(reducedPaletteRgbAtom)
  const mode = get(modeAtom)
  
  if (!bufferCache) return null

  const { buffer, width, height } = bufferCache
  
  // Éviter la création de canvas intermédiaire si possible
  const sourceImageData = new ImageData(
    new Uint8ClampedArray(buffer),
    width,
    height
  )
  
  // Remappage final en RGB
  const remapped = remapImageDataToPalette(sourceImageData, reducedRgb)
  
  const targetW = CPC_MODE_CONFIG[mode].width
  const targetH = CPC_MODE_CONFIG[mode].height
  
  // Si les dimensions correspondent déjà, éviter le redimensionnement
  if (remapped.width === targetW && remapped.height === targetH) {
    return remapped
  }
  
  // Utiliser une seule création de canvas optimisée
  return resizeImageDataOptimized(remapped, targetW, targetH)
})

// Helper function pour redimensionnement optimisé
function resizeImageDataOptimized(source: ImageData, targetWidth: number, targetHeight: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return source
  
  // Canvas temporaire pour la source
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = source.width
  tempCanvas.height = source.height
  tempCanvas.getContext('2d')?.putImageData(source, 0, 0)
  
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  
  const dx = Math.floor((targetWidth - source.width) / 2)
  const dy = Math.floor((targetHeight - source.height) / 2)
  
  ctx.drawImage(tempCanvas, 0, 0, source.width, source.height, dx, dy, source.width, source.height)
  
  return ctx.getImageData(0, 0, targetWidth, targetHeight)
}