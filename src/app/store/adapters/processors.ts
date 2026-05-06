import { atom } from 'jotai'
import type REGL from 'regl'
import createREGL from 'regl'
import { processorTypeAtom } from '@/app/store/config/config'
import { adapterLogger } from '@/core'
import type { ImageProcessor } from '@/libs/pixsaur-adapter'
import { ReGLProcessor } from '@/libs/pixsaur-adapter/adapters/regl-processor'

// Atomes pour les adaptateurs auto-sélectionnés
export const imageProcessorAtom = atom<ImageProcessor | null>(null)

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
  if (currentImage) {
    return
  }

  isInitializing = true

  initializationPromise = (async () => {
    try {
      const processorType = _get(processorTypeAtom)

      // Créer un processeur unique partagé par le pipeline image + palette
      const imageProcessor = await processorFactory.createBestProcessor(
        processorType
      )

      adapterLogger.info(
        `Processor initialized: ${imageProcessor.type === 'regl' ? 'WebGL (GPU)' : 'CPU fallback'}`
      )

      set(imageProcessorAtom, imageProcessor)
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

  if (imageProcessor) {
    imageProcessor.dispose()
    set(imageProcessorAtom, null)
  }
})

// Atome pour forcer la réinitialisation quand le type change
export const reinitializeProcessorsAtom = atom(null, async (_get, set) => {
  // Nettoyer les anciens processeurs
  set(disposeProcessorsAtom)

  // Réinitialiser
  await set(initializeProcessorsAtom)
})

// Atome qui écoute les changements de processorType et recharge automatiquement
export const processorTypeListenerAtom = atom(
  (get) => get(processorTypeAtom),
  async (_get, set, _payload) => {
    await set(reinitializeProcessorsAtom)
  }
)
export const processorFactory = {
  async createBestProcessor(type = 'gpu') {
    // Si CPU est explicitement demandé, créer un processeur CPU
    if (type === 'cpu') {
      return new ReGLProcessor(undefined)
    }

    // GPU forcé: échec dur si ReGL indisponible
    if (type === 'gpu') {
      const reglInstance = this.createGpuInstance()
      if (!reglInstance) {
        throw new Error('GPU processor requested but ReGL initialization failed')
      }
      return new ReGLProcessor(reglInstance)
    }

    // auto: tenter GPU puis fallback CPU
    const reglInstance = this.createGpuInstance()
    if (!reglInstance) {
      adapterLogger.warn(
        '[FACTORY] Auto mode fallback: ReGL unavailable, using CPU processor'
      )
      return new ReGLProcessor(undefined)
    }

    return new ReGLProcessor(reglInstance)
  },

  createGpuInstance(): REGL.Regl | undefined {
    try {
      return createREGL({
        extensions: [],
        optionalExtensions: ['OES_texture_float', 'OES_texture_half_float'],
        attributes: {
          preserveDrawingBuffer: false,
          antialias: false,
          depth: false,
          stencil: false
        }
      })
    } catch (error) {
      adapterLogger.warn('[FACTORY] Failed to create ReGL instance:', error)
      return undefined
    }
  }
}
