import { useAtomValue, useSetAtom } from 'jotai'
import debounce from 'lodash/debounce'
import { useEffect, useMemo } from 'react'
import {
  clearLastChangedKeyAtom,
  configAtom
} from '@/app/store/config/config'
import { downscaledAtom, setWorkingImageAtom } from '@/app/store/image/image'
import { useImageProcessors } from './use-image-processors'
import { adapterLogger } from '@/utils/logger'

export const useImageAdjustement = () => {
  const setSrc = useSetAtom(setWorkingImageAtom)
  const downscaled = useAtomValue(downscaledAtom)
  const { imageProcessor, isInitialized } = useImageProcessors()

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

  const debouncedApply = useMemo(
    () =>
      debounce(async (data: Uint8ClampedArray) => {
        if (!imageProcessor || !isInitialized) {
          return
        }
        
        if (process.env.NODE_ENV === 'development') {
          adapterLogger.debug('🔧 [DEBUG] use-image-adjustement calling processor')
        }
        const result = imageProcessor.applyAdjustmentsSync(
          new ImageData(
            new Uint8ClampedArray(data),
            downscaled!.width,
            downscaled!.height
          ),
          {
            rgb: { r: red, g: green, b: blue },
            brightness,
            contrast,
            saturation,
            posterization
          }
        )
        setSrc(result)
        clearLastChangedKey()
      }, 0),
    [
      imageProcessor,
      isInitialized,
      downscaled,
      red,
      green,
      blue,
      brightness,
      contrast,
      saturation,
      posterization,
      setSrc,
      clearLastChangedKey
    ]
  )

  useEffect(() => {
    if (!downscaled || !lastChangedKey) return

    debouncedApply(data)
    return () => debouncedApply.cancel()
  }, [data, lastChangedKey, debouncedApply, downscaled])
}
