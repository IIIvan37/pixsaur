import { useAtomValue, useSetAtom } from 'jotai'
import debounce from 'lodash/debounce'
import { useEffect, useMemo, useRef } from 'react'
import { configAtom } from '@/app/store/config/config'
import { downscaledAtom, setWorkingImageAtom } from '@/app/store/image/image'
import { useImageProcessors } from './use-image-processors'

// Debounce delay for adjustment changes (ms)
// 50ms provides a good balance between responsiveness and performance
const ADJUSTMENT_DEBOUNCE_MS = 50

export const useImageAdjustement = () => {
  const setSrc = useSetAtom(setWorkingImageAtom)
  const downscaled = useAtomValue(downscaledAtom)
  const { imageProcessor, isInitialized } = useImageProcessors()

  const config = useAtomValue(configAtom)
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
    posterization,
    median,
    sharpen,
    blur,
    edges,
    chromaKeyEnabled,
    chromaKeyColor,
    chromaKeyTolerance
  } = config

  // Use refs to always have latest values without recreating debounced function
  const configRef = useRef(config)
  const processorRef = useRef(imageProcessor)
  const downscaledRef = useRef(downscaled)

  // Update refs on each render
  configRef.current = config
  processorRef.current = imageProcessor
  downscaledRef.current = downscaled

  const data = useMemo(
    () => downscaled?.data || new Uint8ClampedArray(),
    [downscaled]
  )

  // Create debounced function only once - it reads from refs
  const debouncedApply = useMemo(
    () =>
      debounce((data: Uint8ClampedArray) => {
        const processor = processorRef.current
        const currentDownscaled = downscaledRef.current
        const cfg = configRef.current

        if (!processor || !isInitialized || !currentDownscaled) {
          return
        }

        const result = processor.applyAdjustmentsSync(
          new ImageData(
            new Uint8ClampedArray(data),
            currentDownscaled.width,
            currentDownscaled.height
          ),
          {
            rgb: { r: cfg.red, g: cfg.green, b: cfg.blue },
            brightness: cfg.brightness,
            contrast: cfg.contrast,
            saturation: cfg.saturation,
            hue: cfg.hue,
            vibrance: cfg.vibrance,
            temperature: cfg.temperature,
            tint: cfg.tint,
            gamma: cfg.gamma,
            exposure: cfg.exposure,
            highlights: cfg.highlights,
            shadows: cfg.shadows,
            posterization: cfg.posterization,
            median: cfg.median,
            sharpen: cfg.sharpen,
            blur: cfg.blur,
            edges: cfg.edges,
            chromaKeyEnabled: cfg.chromaKeyEnabled,
            chromaKeyColor: cfg.chromaKeyColor,
            chromaKeyTolerance: cfg.chromaKeyTolerance
          }
        )
        setSrc(result)
      }, ADJUSTMENT_DEBOUNCE_MS),
    [isInitialized, setSrc]
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: config values are intentionally included to trigger re-application
  useEffect(() => {
    if (!downscaled) return

    // Apply adjustments when data or config changes
    // Note: config values trigger via configRef which is updated each render
    debouncedApply(data)

    return () => debouncedApply.cancel()
  }, [
    data,
    debouncedApply,
    downscaled,
    // Config values - trigger re-application when changed
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
    median,
    sharpen,
    blur,
    edges,
    chromaKeyEnabled,
    chromaKeyColor,
    chromaKeyTolerance
  ])
}
