import { useEffect, useMemo } from 'react'
import debounce from 'lodash/debounce'
import { useAtomValue, useSetAtom } from 'jotai'
import { downscaledAtom, setWorkingImageAtom } from '@/app/store/image/image'
import { clearLastChangedKeyAtom, configAtom } from '@/app/store/config/config'
import { useImageProcessors } from './use-image-processors'
import { perfLogger, logger } from '@/utils/logger'

export const useAdapterImageAdjustment = () => {
  const setSrc = useSetAtom(setWorkingImageAtom)
  const downscaled = useAtomValue(downscaledAtom)
  const { applyAdjustments, isInitialized, isHardwareAccelerated } = useImageProcessors()

  const {
    red,
    green,
    blue,
    brightness,
    contrast,
    saturation,
    posterization,
    lastChangedKey
  } = useAtomValue(configAtom)

  const clearLastChangedKey = useSetAtom(clearLastChangedKeyAtom)
  const data = useMemo(
    () => downscaled?.data || new Uint8ClampedArray(),
    [downscaled]
  )

  // Debounce timing optimisé - valeur minimale pour réactivité maximale
  const debounceTime = 0

  const debouncedApply = useMemo(
    () =>
      debounce(async (data: Uint8ClampedArray) => {
        if (!downscaled || !isInitialized) return

        const imageData = new ImageData(
          new Uint8ClampedArray(data),
          downscaled.width,
          downscaled.height
        )

        const config = {
          rgb: { r: red, g: green, b: blue },
          brightness,
          contrast,
          saturation,
          posterization
        }

        try {
          perfLogger.time(`${isHardwareAccelerated ? 'WebGL' : 'CPU'} adjustment`)
          
          const result = await applyAdjustments(imageData, config)
          
          perfLogger.timeEnd(`${isHardwareAccelerated ? 'WebGL' : 'CPU'} adjustment`)
          
          setSrc(result)
          clearLastChangedKey()
        } catch (error) {
          logger.error('Image adjustment failed:', error)
          clearLastChangedKey()
        }
      }, debounceTime),
    [
      downscaled,
      red,
      green,
      blue,
      brightness,
      contrast,
      saturation,
      posterization,
      setSrc,
      clearLastChangedKey,
      applyAdjustments,
      isInitialized,
      isHardwareAccelerated
    ]
  )

  useEffect(() => {
    if (!downscaled || !lastChangedKey || !isInitialized) return

    debouncedApply(data)
    return () => debouncedApply.cancel()
  }, [data, lastChangedKey, debouncedApply, downscaled, isInitialized])
}