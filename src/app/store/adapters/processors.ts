import { atom } from 'jotai'
import { processorTypeAtom } from '@/app/store/config/config'
import type { ImageProcessor } from '@/libs/pixsaur-adapter'
import type REGL from 'regl'
import { adapterLogger } from '@/utils/logger'

// Atomes pour les adaptateurs auto-sélectionnés
export const imageProcessorAtom = atom<ImageProcessor | null>(null)
export const paletteProcessorAtom = atom<ImageProcessor | null>(null)

// État d'initialisation pour éviter les multiples initialisations
let initializationPromise: Promise<void> | null = null
let isInitializing = false

// Atome pour initialiser les adaptateurs de façon asynchrone (singleton)
export const initializeProcessorsAtom = atom(null, async (_get, set) => {
  const callStack = new Error().stack?.split('\n')[2]?.trim() || 'unknown'
  adapterLogger.debug(`🔧 [PROCESSORS] initializeProcessorsAtom called from: ${callStack}`)
  
  // Si déjà en cours d'initialisation, attendre la promesse existante
  if (isInitializing && initializationPromise) {
    adapterLogger.debug('🔄 [PROCESSORS] Already initializing, waiting...')
    await initializationPromise
    return
  }

  // Si déjà initialisés, ne rien faire
  const currentImage = _get(imageProcessorAtom)
  const currentPalette = _get(paletteProcessorAtom)
  if (currentImage && currentPalette) {
    adapterLogger.debug('♻️ [PROCESSORS] Processors already initialized, skipping')
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

// Export du factory pour compatibilité
export const processorFactory = {
  async createBestProcessor(_type = 'gpu') {
    const { ReGLProcessor } = await import('@/libs/pixsaur-adapter/adapters/regl-processor')
    
    // Créer une instance ReGL pour GPU processing
    let reglInstance: REGL.Regl | undefined = undefined
    try {
      const createREGL = (await import('regl')).default
      reglInstance = createREGL({
        // Configuration optimisée pour image processing
        extensions: [],
        optionalExtensions: ['OES_texture_float', 'OES_texture_half_float'],
        attributes: {
          preserveDrawingBuffer: false,
          antialias: false,
          depth: false,
          stencil: false
        }
      })
      adapterLogger.debug('✅ [FACTORY] ReGL instance created successfully')
    } catch (error) {
      adapterLogger.warn('⚠️ [FACTORY] Failed to create ReGL instance, falling back to CPU:', error)
    }
    
    return new ReGLProcessor(reglInstance)
  }
}
