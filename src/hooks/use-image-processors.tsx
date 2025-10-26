import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect } from 'react'
import {
  disposeProcessorsAtom,
  imageProcessorAtom,
  initializeProcessorsAtom,
  paletteProcessorAtom
} from '@/app/store/adapters/processors'
import type { AdjustmentConfig } from '@/libs/pixsaur-adapter'
import { adapterLogger, logger } from '@/utils/logger'

export const useImageProcessors = () => {
  const imageProcessor = useAtomValue(imageProcessorAtom)
  const paletteProcessor = useAtomValue(paletteProcessorAtom)
  const initializeProcessors = useSetAtom(initializeProcessorsAtom)
  const disposeProcessors = useSetAtom(disposeProcessorsAtom)

  // Initialisation automatique au montage - une seule fois globalement
  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      try {
        await initializeProcessors()
        // Pas besoin de vérifier mounted car l'atom gère déjà les doublons
      } catch (error) {
        if (mounted) {
          adapterLogger.error('Failed to initialize processors:', error)
        }
      }
    }

    // Lancer l'initialisation si les processeurs ne sont pas disponibles
    if (!imageProcessor || !paletteProcessor) {
      initialize()
    }

    return () => {
      mounted = false
    }
  }, [imageProcessor, paletteProcessor, initializeProcessors])

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      disposeProcessors()
    }
  }, [disposeProcessors])

  // Helper pour appliquer les ajustements avec l'adaptateur
  const applyAdjustments = useCallback(
    async (imageData: ImageData, config: AdjustmentConfig) => {
      if (!imageProcessor) {
        throw new Error('Image processor not initialized')
      }

      logger.time('Image adjustments')
      const result = await imageProcessor.applyAdjustments(imageData, config)
      logger.timeEnd('Image adjustments')

      return result
    },
    [imageProcessor]
  )

  const isInitialized = !!(imageProcessor && paletteProcessor)

  return {
    imageProcessor,
    paletteProcessor,
    applyAdjustments,
    isInitialized
  }
}
