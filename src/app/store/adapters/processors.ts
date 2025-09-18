import { atom } from 'jotai'
import { processorTypeAtom } from '@/app/store/config/config'
import type { ImageProcessor } from '@/libs/pixsaur-adapter'
import { processorFactory } from '@/libs/pixsaur-adapter'
import { adapterLogger } from '@/utils/logger'

// Atomes pour les adaptateurs auto-sélectionnés
export const imageProcessorAtom = atom<ImageProcessor | null>(null)
export const paletteProcessorAtom = atom<ImageProcessor | null>(null)

// État d'initialisation pour éviter les multiples initialisations
let initializationPromise: Promise<void> | null = null
let isInitializing = false

// Atome pour initialiser les adaptateurs de façon asynchrone (singleton)
export const initializeProcessorsAtom = atom(null, async (_get, set) => {
  // Si déjà en cours d'initialisation, attendre la promesse existante
  if (isInitializing && initializationPromise) {
    await initializationPromise
    return
  }

  // Si déjà initialisés, ne rien faire
  const currentImage = _get(imageProcessorAtom)
  const currentPalette = _get(paletteProcessorAtom)
  if (currentImage && currentPalette) {
    return
  }

  isInitializing = true

  initializationPromise = (async () => {
    try {
      adapterLogger.debug('Initializing image processors...')

      const processorType = _get(processorTypeAtom)

      // Créer les processeurs avec sélection automatique WebGL/CPU
      const imageProcessor =
        await processorFactory.createBestProcessor(processorType)
      const paletteProcessor =
        await processorFactory.createBestProcessor(processorType)

      adapterLogger.info(
        `Image processor: ${imageProcessor.type === 'regl' ? 'WebGL (GPU)' : 'CPU'}`
      )
      adapterLogger.info(
        `Palette processor: ${paletteProcessor.type === 'regl' ? 'WebGL (GPU)' : 'CPU'}`
      )

      set(imageProcessorAtom, imageProcessor)
      set(paletteProcessorAtom, paletteProcessor)
    } catch (error) {
      adapterLogger.error('Failed to initialize processors:', error)
      throw error
    } finally {
      isInitializing = false
      initializationPromise = null
    }
  })()

  await initializationPromise
})

// Atome pour nettoyer les ressources
export const disposeProcessorsAtom = atom(null, (get, set) => {
  const imageProcessor = get(imageProcessorAtom)
  const paletteProcessor = get(paletteProcessorAtom)

  if (imageProcessor) {
    imageProcessor.dispose()
    set(imageProcessorAtom, null)
  }

  if (paletteProcessor) {
    paletteProcessor.dispose()
    set(paletteProcessorAtom, null)
  }

  adapterLogger.debug('Processors disposed')
})
