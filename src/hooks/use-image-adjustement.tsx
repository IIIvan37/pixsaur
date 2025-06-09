import { useEffect, useMemo } from 'react'
import debounce from 'lodash/debounce'
import { useAtomValue, useSetAtom } from 'jotai'
import { downscaledAtom, setWorkingImageAtom } from '@/app/store/image/image'
import { clearLastChangedKeyAtom, configAtom } from '@/app/store/config/config'
import { applyAdjustmentsInOnePass } from '@/libs/pixsaur-color/src/transform/color-transform/adjust'

export const useImageAdjustement = () => {
  const setSrc = useSetAtom(setWorkingImageAtom)
  const downscaled = useAtomValue(downscaledAtom)

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
      debounce((data: Uint8ClampedArray) => {
        const result = applyAdjustmentsInOnePass(
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
