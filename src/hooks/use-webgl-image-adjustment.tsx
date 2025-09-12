import { useEffect, useMemo } from 'react'
import debounce from 'lodash/debounce'
import { useAtomValue, useSetAtom } from 'jotai'
import { downscaledAtom, setWorkingImageAtom } from '@/app/store/image/image'
import { clearLastChangedKeyAtom, configAtom } from '@/app/store/config/config'
import { webglAvailableAtom, webglAdjustImageAtom } from '@/app/store/webgl/webgl'
import { applyAdjustmentsInOnePass } from '@/libs/pixsaur-color/src/transform/color-transform/adjust'

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

  // Debounce timing optimized for performance
  const debounceTime = useMemo(() => {
    if (!webglAvailable) return 150 // CPU needs more debounce
    
    // Different debounce for different adjustment types
    const fastAdjustments = ['red', 'green', 'blue', 'brightness'] 
    const isFastAdjustment = fastAdjustments.includes(lastChangedKey || '')
    
    return isFastAdjustment ? 10 : 30 // WebGL is fast enough for very responsive UI
  }, [webglAvailable, lastChangedKey])

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
            console.time('🚀 WebGL adjustment')
            const webglResult = webglAdjust({ imageData, config })
            console.timeEnd('🚀 WebGL adjustment')
            
            if (webglResult) {
              result = webglResult
            } else {
              console.warn('🚀 WebGL returned null, falling back to CPU')
              // Fallback to CPU
              console.time('⚠️ CPU adjustment (WebGL fallback)')
              result = applyAdjustmentsInOnePass(imageData, config)
              console.timeEnd('⚠️ CPU adjustment (WebGL fallback)')
            }
          } catch (error) {
            console.warn('WebGL adjustment failed, using CPU fallback:', error)
            console.time('⚠️ CPU adjustment (WebGL error)')
            result = applyAdjustmentsInOnePass(imageData, config)
            console.timeEnd('⚠️ CPU adjustment (WebGL error)')
          }
        } else {
          // CPU fallback
          console.time('⚠️ CPU adjustment')
          result = applyAdjustmentsInOnePass(imageData, config)
          console.timeEnd('⚠️ CPU adjustment')
        }

        setSrc(result)
        clearLastChangedKey()
      }, debounceTime), // Debounce adaptatif selon WebGL/CPU et type d'ajustement
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
      webglAdjust,
      debounceTime
    ]
  )

  useEffect(() => {
    if (!downscaled || !lastChangedKey) return

    debouncedApply(data)
    return () => debouncedApply.cancel()
  }, [data, lastChangedKey, debouncedApply, downscaled])
}