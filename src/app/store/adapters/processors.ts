import { atom } from 'jotai'
import { processorTypeAtom } from '@/app/store/config/config'
import { pushToastAtom } from '@/app/store/notifications/toast'
import { adapterLogger } from '@/core'
import type { ImageProcessor } from '@/libs/pixsaur-adapter'
import { processorFactory } from '@/libs/pixsaur-adapter/factory'

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
      const imageProcessor =
        await processorFactory.createBestProcessor(processorType)

      adapterLogger.info(
        `Processor initialized: ${imageProcessor.type === 'regl' ? 'WebGL (GPU)' : 'CPU fallback'}`
      )

      // Auto mode silently falls back to CPU when WebGL is unavailable; surface
      // it so the user understands a slower path is in use.
      if (processorType !== 'cpu' && imageProcessor.type !== 'regl') {
        set(pushToastAtom, 'gpu-fallback')
      }

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
export { processorFactory } from '@/libs/pixsaur-adapter/factory'
