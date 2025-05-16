import { adjustLightness } from '@/libs/pixsaur-color/src/transform/color-transform/adjust-brighteness'
import { adjustContrast } from '@/libs/pixsaur-color/src/transform/color-transform/adjust-contrast'
import { adjustRGBChannels } from '@/libs/pixsaur-color/src/transform/color-transform/adjust-rgb'
import { adjustSaturation } from '@/libs/pixsaur-color/src/transform/color-transform/adjust-saturation'
import { useEffect, useMemo } from 'react'
import debounce from 'lodash/debounce'
import { asyncWrap } from '@/utils/async-wrap'
import { useAtomValue, useSetAtom } from 'jotai'
import { downscaledAtom, srcAtom } from '@/app/store/image/image'
import { clearLastChangedKeyAtom, configAtom } from '@/app/store/config/config'

const asyncAdjustRGB = asyncWrap(adjustRGBChannels)
const asyncAdjustLightness = asyncWrap(adjustLightness)
const asyncAdjustContrast = asyncWrap(adjustContrast)
const asyncAdjustSaturation = asyncWrap(adjustSaturation)

type AdjustFn = (
  src: Uint8ClampedArray,
  ...args: number[]
) => Promise<Uint8ClampedArray>

export function useDebouncedAdjust<T extends AdjustFn>(
  fn: T,
  args: [Parameters<T>[0], ...Parameters<T>[1][]],
  delay: number,
  onResult: (out: Uint8ClampedArray) => void,
  enabled: boolean
) {
  const debounced = useMemo(
    () =>
      debounce(
        async (...innerArgs: [Parameters<T>[0], ...Parameters<T>[1][]]) => {
          const result = await fn(...innerArgs)

          onResult(result)
        },
        delay
      ),
    [fn, delay, onResult]
  )

  useEffect(() => {
    if (enabled) debounced(...args)
    return () => debounced.cancel()
  }, [args, debounced, enabled])
}

export const useImageAdjustement = () => {
  const src = useAtomValue(srcAtom)
  const setSrc = useSetAtom(srcAtom)
  const downscaled = useAtomValue(downscaledAtom)

  const { red, green, blue, brightness, contrast, saturation, lastChangedKey } =
    useAtomValue(configAtom)
  const clearLastChangedKey = useSetAtom(clearLastChangedKeyAtom)
  const data = downscaled?.data || new Uint8ClampedArray()
  const enabled = (key: string) => lastChangedKey === key
  const final = (out: Uint8ClampedArray) => {
    clearLastChangedKey()

    setSrc(new ImageData(out, src!.width, src!.height))
  }

  useDebouncedAdjust(
    asyncAdjustRGB,
    [data, red, green, blue],
    300,
    final,
    enabled('red') || enabled('green') || enabled('blue')
  )
  useDebouncedAdjust(
    asyncAdjustLightness,
    [data, brightness],
    300,
    final,
    enabled('brightness')
  )
  useDebouncedAdjust(
    asyncAdjustContrast,
    [data, contrast],
    300,
    final,
    enabled('contrast')
  )

  useDebouncedAdjust(
    asyncAdjustSaturation,
    [data, saturation],
    300,
    final,
    enabled('saturation')
  )
}
