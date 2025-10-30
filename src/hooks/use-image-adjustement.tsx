import { useAtomValue, useSetAtom } from 'jotai'
import debounce from 'lodash/debounce'
import { useEffect, useMemo } from 'react'
import { configAtom } from '@/app/store/config/config'
import { downscaledAtom, setWorkingImageAtom } from '@/app/store/image/image'
import { useImageProcessors } from './use-image-processors'

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
    hue,
    vibrance,
    temperature,
    tint,
    gamma,
    exposure,
    highlights,
    shadows,
    posterization
  } = useAtomValue(configAtom)

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
            hue,
            vibrance,
            temperature,
            tint,
            gamma,
            exposure,
            highlights,
            shadows,
            posterization
          }
        )
        setSrc(result)
      }, 10),
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
      hue,
      vibrance,
      temperature,
      tint,
      gamma,
      exposure,
      highlights,
      shadows,
      posterization,
      setSrc
    ]
  )

  useEffect(() => {
    if (!downscaled) return

    // Simple logic: apply adjustments when data changes or when there's an adjustment change
    // The debouncedApply already handles the current adjustment values via closure
    debouncedApply(data)

    return () => debouncedApply.cancel()
  }, [data, debouncedApply, downscaled])
}
