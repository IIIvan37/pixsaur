import { useEffect, useMemo } from 'react'
import debounce from 'lodash/debounce'
import { useAtomValue, useSetAtom } from 'jotai'
import { downscaledAtom, setWorkingImageAtom } from '@/app/store/image/image'
import { clearLastChangedKeyAtom, configAtom } from '@/app/store/config/config'
import { webglAvailableAtom, webglAdjustImageAtom } from '@/app/store/webgl/webgl'
import { applyAdjustmentsInOnePass } from '@/libs/pixsaur-color/src/transform/color-transform/adjust'
import { perfLogger, logger } from '@/utils/logger'

export const useWebGLImageAdjustment = () => {
  const setSrc = useSetAtom(setWorkingImageAtom)
  const downscaled = useAtomValue(downscaledAtom)
  const webglAvailable = useAtomValue(webglAvailableAtom)
  const webglAdjust = useSetAtom(webglAdjustImageAtom)

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
        if (!downscaled) return

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

        let result: ImageData

        // Try WebGL first if available
        if (webglAvailable) {
          try {
            perfLogger.time('WebGL adjustment')
            const webglResult = webglAdjust({ imageData, config })
            perfLogger.timeEnd('WebGL adjustment')
            
            if (webglResult) {
              result = webglResult
            } else {
              logger.warn('WebGL returned null, falling back to CPU')
              // Fallback to CPU
              perfLogger.time('CPU adjustment (WebGL fallback)')
              result = applyAdjustmentsInOnePass(imageData, config)
              perfLogger.timeEnd('CPU adjustment (WebGL fallback)')
            }
          } catch (error) {
            logger.warn('WebGL adjustment failed, using CPU fallback:', error)
            perfLogger.time('CPU adjustment (WebGL error)')
            result = applyAdjustmentsInOnePass(imageData, config)
            perfLogger.timeEnd('CPU adjustment (WebGL error)')
          }
        } else {
          // CPU fallback
          perfLogger.time('CPU adjustment')
          result = applyAdjustmentsInOnePass(imageData, config)
          perfLogger.timeEnd('CPU adjustment')
        }

        setSrc(result)
        clearLastChangedKey()
      }, debounceTime), // Debounce minimal pour réactivité maximale
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
      webglAvailable,
      webglAdjust
    ]
  )

  useEffect(() => {
    if (!downscaled || !lastChangedKey) return

    debouncedApply(data)
    return () => debouncedApply.cancel()
  }, [data, lastChangedKey, debouncedApply, downscaled])
}