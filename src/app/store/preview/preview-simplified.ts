import { atom } from 'jotai'
import { createQuantizer, extractBuffer } from '@/libs/pixsaur-color/src'
import { ColorSpaceDistanceMetric } from '@/libs/pixsaur-color/src/metric/distance'
import { getColorSpaceToRgbFn } from '@/libs/pixsaur-color/src/space'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { generateAmstradCPCPalette } from '@/palettes/cpc-palette'
import {
  getVisualRegion,
  getVisualRegionNormalized
} from '@/utils/get-visual-region'
import { logger } from '@/utils/logger'
import {
  colorSpaceAtom,
  contrastStrategyAtom,
  ditheringAtom,
  modeAtom
} from '../config/config'
import { paletteProcessorAtom } from '../adapters/processors'
import { CPC_MODE_CONFIG } from '../config/types'
import { selectionAtom, workingImageAtom } from '../image/image'
import { lockedVectorsAtom } from '../palette/palette'

export const previewCanvasWidthAtom = atom<number | null>(null)

export const previewCanvasSizeAtom = atom((get) => {
  const width = get(previewCanvasWidthAtom)
  if (!width) return { width: 0, height: 0 }
  const height = Math.floor(width * (200 / 320))
  return { width, height }
})

// 1. Zone sélectionnée réduite à la largeur du mode
export const croppedImageAtom = atom(async (get) => {
  const workingImageData = await get(workingImageAtom)
  const selection = get(selectionAtom)

  if (!workingImageData || !selection) return null

  return getVisualRegion(workingImageData, selection)
})

// 2. Extraction des données RGBA
export const croppedBufferAtom = atom(async (get) => {
  const cropped = await get(croppedImageAtom)
  if (!cropped) return null
  return extractBuffer(cropped)
})

// 3. Construction du quantizer sans mémoïsation
export const quantizerAtom = atom(async (get) => {
  const buf = await get(croppedBufferAtom)
  const cropped = await get(croppedImageAtom)
  const lockedVecs = get(lockedVectorsAtom)
  const colorSpace = get(colorSpaceAtom)
  const contrastStrategy = get(contrastStrategyAtom)
  if (!buf || !cropped) return null

  const availableMetrics = ColorSpaceDistanceMetric[colorSpace]
  const distanceMetric = availableMetrics[0]

  const quantizer = createQuantizer({
    buf,

    basePalette: generateAmstradCPCPalette(),
    preselected: lockedVecs,
    quantConfig: {
      colorSpace,
      distanceMetric,
      contrastStrategy
    }
  })
  return quantizer
})

// 4. Palette réduite via ADAPTATEUR (nouveau système principal)
export const reducedPaletteRawAtom = atom(async (get) => {
  const buf = await get(croppedBufferAtom)
  const cropped = await get(croppedImageAtom)
  const lockedVecs = get(lockedVectorsAtom)
  const colorSpace = get(colorSpaceAtom)
  const mode = get(modeAtom)
  // Dépendance pour recalculer quand la stratégie change
  get(contrastStrategyAtom)

  if (!buf || !cropped) return []

  // 🚀 UTILISATION DES PROCESSEURS CENTRALISÉS (réutilisation de cache)
  const paletteProcessor = get(paletteProcessorAtom)
  if (!paletteProcessor) {
    throw new Error('Palette processor not initialized')
  }

  const targetColors = CPC_MODE_CONFIG[mode].nColors
  const palette = await paletteProcessor.quantizePalette(
    buf,
    lockedVecs,
    targetColors,
    colorSpace
  )

  return palette
})

// ====== PREVIEW ATOM SIMPLIFIÉ SANS CACHE ======

export const previewImageAtom = atom(async (get) => {
  const cropped = await get(croppedImageAtom)
  const reduced = await get(reducedPaletteRgbAtom)
  const dithering = get(ditheringAtom)
  const mode = get(modeAtom)

  if (!cropped || !reduced || reduced.length === 0) return null

  const startTime = performance.now()

  const normalized = getVisualRegionNormalized(cropped, mode)
  if (!normalized) return null
  
  logger.info('🎨 [PREVIEW] Starting dithering with palette:', reduced.map(p => `[${p.join(',')}]`).join(' '))

  // Calcul direct sans cache
  const ditheringStartTime = performance.now()
  
  // Utilisation directe de l'algorithme de dithering
  const { applyDithering } = await import('@/libs/pixsaur-color/src/dither/apply-dithering')
  const { createColorRemapper } = await import('@/libs/pixsaur-color/src/remap')
  
  // Appliquer le dithering
  const dithered = applyDithering(normalized, reduced, dithering)
  const ditheringTime = performance.now() - ditheringStartTime
  logger.info(`  📐 Dithering: ${ditheringTime.toFixed(2)}ms`)

  // Remapper vers les couleurs CPC quantifiées
  const remappingStartTime = performance.now()
  const remapper = createColorRemapper(reduced)
  const remapped = remapper.remapImageData(dithered)
  const remappingTime = performance.now() - remappingStartTime
  logger.info(`  🎯 Remapping: ${remappingTime.toFixed(2)}ms`)

  // Création du canvas final
  const canvasStartTime = performance.now()
  const canvas = document.createElement('canvas')
  canvas.width = remapped.width
  canvas.height = remapped.height
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(remapped, 0, 0)
  const canvasTime = performance.now() - canvasStartTime
  logger.info(`  🖌️ Canvas Operations: ${canvasTime.toFixed(2)}ms`)

  const totalTime = performance.now() - startTime
  logger.info(`🖼️ Preview Generation: ${totalTime.toFixed(2)}ms`)

  return canvas
})

// Atom pour convertir la palette vers RGB quantifié CPC
export const reducedPaletteRgbAtom = atom(async (get) => {
  const rawPalette = await get(reducedPaletteRawAtom)
  const colorSpace = get(colorSpaceAtom)

  if (!rawPalette || rawPalette.length === 0) return []

  // Convertir vers RGB et quantifier pour CPC
  const toRGB = getColorSpaceToRgbFn(colorSpace)
  const quantified = rawPalette.map((color) => {
    const [r, g, b] = toRGB(color as Vector)
    
    // Quantification CPC stricte
    const qr = r <= 64 ? 0 : (r <= 192 ? 128 : 255)
    const qg = g <= 64 ? 0 : (g <= 192 ? 128 : 255)
    const qb = b <= 64 ? 0 : (b <= 192 ? 128 : 255)
    
    return [qr, qg, qb] as Vector<'RGB'>
  })

  return quantified
})