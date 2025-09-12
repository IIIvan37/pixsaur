import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect } from 'react'
import { perfLogger, adapterLogger } from '@/utils/logger'
import { 
  imageProcessorAtom, 
  paletteProcessorAtom, 
  initializeProcessorsAtom,
  disposeProcessorsAtom
} from '@/app/store/adapters/processors'
import type { IImageAdjustmentConfig } from '@/libs/pixsaur-adapter'

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
  const applyAdjustments = useCallback(async (
    imageData: ImageData, 
    config: IImageAdjustmentConfig
  ) => {
    if (!imageProcessor) {
      throw new Error('Image processor not initialized')
    }
    
    perfLogger.time(`${imageProcessor.isHardwareAccelerated ? 'WebGL' : 'CPU'} adjustments`)
    const result = await imageProcessor.applyAdjustments(imageData, config)
    perfLogger.timeEnd(`${imageProcessor.isHardwareAccelerated ? 'WebGL' : 'CPU'} adjustments`)
    
    return result
  }, [imageProcessor])
  
  return {
    imageProcessor,
    paletteProcessor,
    applyAdjustments,
    isInitialized: !!(imageProcessor && paletteProcessor),
    isHardwareAccelerated: imageProcessor?.isHardwareAccelerated ?? false
  }
}