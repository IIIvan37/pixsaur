import { useAtomValue, useSetAtom } from 'jotai'
import debounce from 'lodash/debounce'
import { useMemo } from 'react'
import { configAtom } from '@/app/store/config/config'
import { downscaledAtom, setWorkingImageAtom } from '@/app/store/image/image'
import { logger } from '@/utils/logger'
import { useImageProcessors } from './use-image-processors'

export const useAdapterImageAdjustment = () => {
  const config = useAtomValue(configAtom)
  const downscaledImageData = useAtomValue(downscaledAtom)
  const setWorkingImage = useSetAtom(setWorkingImageAtom)

  const { applyAdjustments, isInitialized, isHardwareAccelerated } =
    useImageProcessors()

  // Fonction pour appliquer les ajustements avec debounce
  const applyAdjustmentsDebounced = useMemo(
    () =>
      debounce(async () => {
        if (!downscaledImageData || !isInitialized) {
          return
        }

        try {
          logger.time(
            `${isHardwareAccelerated ? 'GPU' : 'CPU'} image adjustments`
          )

          const adjustedImageData = await applyAdjustments(
            downscaledImageData,
            {
              brightness: config.brightness,
              contrast: config.contrast,
              saturation: config.saturation
            }
          )

          // Mettre à jour l'image de travail avec le résultat
          setWorkingImage(adjustedImageData)

          logger.timeEnd(
            `${isHardwareAccelerated ? 'GPU' : 'CPU'} image adjustments`
          )
        } catch (error) {
          logger.error('Error applying image adjustments:', error)
        }
      }, 0),
    [
      downscaledImageData,
      isInitialized,
      isHardwareAccelerated,
      config,
      applyAdjustments,
      setWorkingImage
    ]
  )

  return {
    applyAdjustments: applyAdjustmentsDebounced,
    isInitialized,
    isHardwareAccelerated
  }
}
