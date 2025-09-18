import { atom } from 'jotai'
import { createQuantizer, extractBuffer } from '@/libs/pixsaur-color/src'
import { ColorSpaceDistanceMetric } from '@/libs/pixsaur-color/src/metric/distance'
import { getColorSpaceToRgbFn } from '@/libs/pixsaur-color/src/space'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { generateAmstradCPCPalette } from '@/palettes/cpc-palette'
import { OptimizedImageProcessor } from '@/utils/optimized-image-processor'
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
    logger.warn('Palette processor not initialized')
    return []
  }

  const palette = await paletteProcessor.quantizePalette(
    buf,
    cropped,
    CPC_MODE_CONFIG[mode].nColors,
    generateAmstradCPCPalette(),
    lockedVecs,
    colorSpace
  )

  return palette
})

// ====== CACHE POUR PERFORMANCE ======

/**
 * Cache intelligent pour dithering basé sur les paramètres
 */
type DitheringCacheEntry = {
  key: string
  buffer: Uint8ClampedArray
  width: number
  height: number
  timestamp: number
}

// Cache global pour le dithering (hors atoms pour éviter les problèmes de state)
const ditheringCache = new Map<string, DitheringCacheEntry>()

/**
 * Génère une clé de cache pour le dithering
 */
export function generateDitheringCacheKey(
  imageData: ImageData,
  palette: Vector[],
  dithering: { mode: string; intensity: number }
): string {
  // Hash simple mais efficace basé sur les propriétés critiques
  const imageHash = `${imageData.width}x${imageData.height}_${imageData.data.length}`
  const paletteHash = palette.map(p => `${p[0]},${p[1]},${p[2]}`).join('|')
  const ditheringHash = `${dithering.mode}_${dithering.intensity}`
  
  // Génération d'un hash simple mais unique
  const combined = `${imageHash}_${paletteHash}_${ditheringHash}`
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(16).padStart(8, '0')
}

// Nettoyage automatique du cache (garder seulement les 5 dernières entrées)
function cleanupCache() {
  if (ditheringCache.size > 5) {
    const entries = Array.from(ditheringCache.entries())
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
    ditheringCache.clear()
    entries.slice(0, 5).forEach(([key, value]) => {
      ditheringCache.set(key, value)
    })
  }
}

// Variables globales pour les statistiques de cache
let cacheHits = 0
let cacheMisses = 0

/**
 * Récupère les statistiques du cache dithering
 */
export function getDitheringCacheStats() {
  const total = cacheHits + cacheMisses
  return {
    size: ditheringCache.size,
    maxSize: 5,
    hitRate: total > 0 ? cacheHits / total : 0,
    hits: cacheHits,
    misses: cacheMisses,
    total
  }
}

// 5. Image preview finale avec cache dithering optimisé
export const previewImageAtom = atom(async (get) => {
  const mode = get(modeAtom)
  const quantizer = await get(quantizerAtom)
  const reduced = await get(reducedPaletteRawAtom)
  const reducedRgb = await get(reducedPaletteRgbAtom) // ✅ palette déjà projetée en RGB
  const cropped = await get(croppedImageAtom)
  const dithering = get(ditheringAtom)
  if (!quantizer || !cropped) return null

  logger.time('🖼️ Preview Generation')

  const normalized = getVisualRegionNormalized(cropped, mode)
  if (!normalized) return null
  
  // Générer clé de cache pour dithering - VERSION OPTIMISÉE
  const cacheKey = OptimizedImageProcessor.generateFastCacheKey(normalized, reduced, {
    mode: dithering.mode,
    intensity: dithering.intensity
  })
  logger.info('🔑 [CACHE] Generated key:', cacheKey)

  // Vérifier cache existant
  let previewBuffer: Uint8ClampedArray
  const existingCache = ditheringCache.get(cacheKey)
  
  if (existingCache) {
    logger.info('🎯 [CACHE] Dithering cache HIT')
    cacheHits++
    previewBuffer = existingCache.buffer
  } else {
    // Cache MISS - calculer nouveau dithering
    logger.info('❌ [CACHE] Dithering cache MISS - computing...')
    cacheMisses++
    logger.time('  📐 Dithering')
    
    previewBuffer = quantizer.dither(normalized, reduced, {
      mode: dithering.mode,
      intensity: dithering.intensity
    })
    
    logger.timeEnd('  📐 Dithering')

    // Mettre à jour le cache
    ditheringCache.set(cacheKey, {
      key: cacheKey,
      buffer: previewBuffer,
      width: normalized.width,
      height: normalized.height,
      timestamp: Date.now()
    })
    
    // Nettoyage automatique
    cleanupCache()
  }

  logger.time('  🎯 Remapping')
  // remappage final en RGB visible - VERSION OPTIMISÉE (MUTATION EN PLACE)
  const imageDataToRemap = new ImageData(
    new Uint8ClampedArray(previewBuffer), // Buffer du cache ou nouveau
    normalized.width,
    normalized.height
  )
  const remapped = OptimizedImageProcessor.remapImageDataInPlace(
    imageDataToRemap,
    reducedRgb
  )
  logger.timeEnd('  🎯 Remapping')

  logger.time('  🖌️ Canvas Operations')
  // Convert ImageData to Canvas for drawImage
  const remappedCanvas = document.createElement('canvas')
  remappedCanvas.width = remapped.width
  remappedCanvas.height = remapped.height
  const remappedCtx = remappedCanvas.getContext('2d')
  if (!remappedCtx) return null
  remappedCtx.putImageData(remapped, 0, 0)

  const targetW = CPC_MODE_CONFIG[mode].width
  const targetH = CPC_MODE_CONFIG[mode].height

  // Création du canvas final avec la taille cible
  const finalCanvas = document.createElement('canvas')
  finalCanvas.width = targetW
  finalCanvas.height = targetH
  const finalCtx = finalCanvas.getContext('2d')
  if (!finalCtx) return null
  finalCtx.imageSmoothingEnabled = true
  finalCtx.imageSmoothingQuality = 'high'
  const dx = Math.floor((targetW - remapped.width) / 2)
  const dy = Math.floor((targetH - remapped.height) / 2)

  finalCtx.drawImage(
    remappedCanvas,
    0,
    0,
    remapped.width,
    remapped.height,
    dx,
    dy,
    remapped.width,
    remapped.height
  )
  logger.timeEnd('  🖌️ Canvas Operations')

  const result = finalCtx.getImageData(0, 0, targetW, targetH)
  logger.timeEnd('🖼️ Preview Generation')
  return result
})

export const reducedPaletteRgbAtom = atom(async (get) => {
  const colorSpace = get(colorSpaceAtom)
  const toRGB = getColorSpaceToRgbFn(colorSpace)
  const raw = await get(reducedPaletteRawAtom)
  
  // VERSION OPTIMISÉE: conversion en place puis quantification
  const projected = raw.slice() // Shallow copy pour ne pas muter l'original
  OptimizedImageProcessor.convertPaletteInPlace(projected, toRGB)

  // Quantify colors to match CPC palette values (0, 128, 255) - OPTIMISÉ
  for (const color of projected) {
    const r = color[0]
    const g = color[1] 
    const b = color[2]
    
    // Quantification optimisée en place
    color[0] = r <= 64 ? 0 : (r <= 192 ? 128 : 255)
    color[1] = g <= 64 ? 0 : (g <= 192 ? 128 : 255)
    color[2] = b <= 64 ? 0 : (b <= 192 ? 128 : 255)
  }

  return projected
})

// ====== ADAPTER-BASED ATOMS (alternative implementation) ======

/**
 * Atom alternatif utilisant l'adaptateur pour la quantization
 * Peut remplacer progressivement le système direct
 */
// SUPPRIMÉ - redondant avec reducedPaletteRawAtom
