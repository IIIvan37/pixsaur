import { atom } from 'jotai'
import { imageProcessorFactory } from '@/libs/pixsaur-adapter'
import type { IImageProcessor, IPaletteProcessor } from '@/libs/pixsaur-adapter'
import { adapterLogger } from '@/utils/logger'

// Atomes pour les adaptateurs auto-sélectionnés
export const imageProcessorAtom = atom<IImageProcessor | null>(null)
export const paletteProcessorAtom = atom<IPaletteProcessor | null>(null)

// État d'initialisation pour éviter les multiples initialisations
let initializationPromise: Promise<void> | null = null
let isInitializing = false

// Atome pour initialiser les adaptateurs de façon asynchrone (singleton)
export const initializeProcessorsAtom = atom(
  null, 
  async (_get, set) => {
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
        
        // Créer les processeurs avec sélection automatique WebGL/CPU
        const imageProcessor = await imageProcessorFactory.createImageProcessor()
        const paletteProcessor = await imageProcessorFactory.createPaletteProcessor()
        
        adapterLogger.info(`Image processor: ${imageProcessor.isHardwareAccelerated ? 'WebGL (GPU)' : 'CPU'}`)
        adapterLogger.info(`Palette processor: ${paletteProcessor.isHardwareAccelerated ? 'WebGL (GPU)' : 'CPU'}`)
        
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
  }
)

// Atome pour nettoyer les ressources
export const disposeProcessorsAtom = atom(
  null,
  (get, set) => {
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
  }
)