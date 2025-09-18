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

  const { applyAdjustments, isInitialized } = useImageProcessors()

  // Fonction pour appliquer les ajustements avec debounce
  const applyAdjustmentsDebounced = useMemo(
    () =>
      debounce(async () => {
        if (!downscaledImageData || !isInitialized) {
          return
        }

        try {
          logger.time('GPU image adjustments')

          const adjustedImageData = await applyAdjustments(
            downscaledImageData,
            {
              rgb: { r: 0, g: 0, b: 0 },
              brightness: config.brightness,
              contrast: config.contrast,
              saturation: config.saturation,
              posterization: 0
            }
          )

          setWorkingImage(adjustedImageData)
          logger.timeEnd('GPU image adjustments')
        } catch (error) {
          logger.error('Error applying image adjustments:', error)
        }
      }, 0),
    [
      downscaledImageData,
      isInitialized,
      config,
      applyAdjustments,
      setWorkingImage
    ]
  )

  return {
    applyAdjustments: applyAdjustmentsDebounced,
    isInitialized
  }
}
