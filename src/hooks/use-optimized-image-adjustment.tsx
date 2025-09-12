import { useEffect, useMemo } from 'react'
import debounce from 'lodash/debounce'
import { useAtomValue, useSetAtom } from 'jotai'
import { downscaledAtom, setWorkingImageAtom } from '@/app/store/image/image'
import { clearLastChangedKeyAtom, configAtom } from '@/app/store/config/config'
import { useImageProcessors } from './use-image-processors'

/**
 * Hook optimisé pour les ajustements d'image avec debouncing uniforme
 * Remplace les 3 implémentations différentes par une version consolidée
 */
export const useOptimizedImageAdjustment = () => {
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

  // Vérification si les ajustements sont neutres (évite le traitement inutile)
  const hasNonDefaultAdjustments = useMemo(() => {
    return red !== 1 || green !== 1 || blue !== 1 ||
           brightness !== 0 || contrast !== 0 || 
           saturation !== 0 || posterization !== 0
  }, [red, green, blue, brightness, contrast, saturation, posterization])

  const debouncedApply = useMemo(
    () =>
      debounce(async (data: Uint8ClampedArray) => {
        if (!downscaled || !isInitialized) return

        // Si tous les ajustements sont neutres, restaurer l'image originale
        if (!hasNonDefaultAdjustments) {
          setSrc(downscaled)
          clearLastChangedKey()
          return
        }

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
          const result = await applyAdjustments(imageData, config)
          setSrc(result)
          clearLastChangedKey()
        } catch (error) {
          console.error('❌ Optimized image adjustment failed:', error)
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
      hasNonDefaultAdjustments
    ]
  )

  useEffect(() => {
    if (!downscaled || !lastChangedKey || !isInitialized) return

    debouncedApply(data)
    return () => debouncedApply.cancel()
  }, [data, lastChangedKey, debouncedApply, downscaled, isInitialized])

  return {
    isProcessing: Boolean(lastChangedKey),
    isHardwareAccelerated,
    debounceTime
  }
}