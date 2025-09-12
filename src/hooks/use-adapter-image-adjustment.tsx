import { useEffect, useMemo } from 'react'
import debounce from 'lodash/debounce'
import { useAtomValue, useSetAtom } from 'jotai'
import { downscaledAtom, setWorkingImageAtom } from '@/app/store/image/image'
import { clearLastChangedKeyAtom, configAtom } from '@/app/store/config/config'
import { useImageProcessors } from './use-image-processors'

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

  // Debounce timing optimisé selon le type d'adaptateur
  const debounceTime = useMemo(() => {
    if (!isInitialized) return 100 // En attente d'initialisation
    
    if (isHardwareAccelerated) {
      // WebGL GPU - ultra-rapide
      const fastAdjustments = ['red', 'green', 'blue', 'brightness'] 
      const isFastAdjustment = fastAdjustments.includes(lastChangedKey || '')
      return isFastAdjustment ? 10 : 30
    } else {
      // CPU - plus conservateur
      return 150
    }
  }, [isInitialized, isHardwareAccelerated, lastChangedKey])

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
          console.time(`🎨 ${isHardwareAccelerated ? 'WebGL' : 'CPU'} adjustment`)
          
          const result = await applyAdjustments(imageData, config)
          
          console.timeEnd(`🎨 ${isHardwareAccelerated ? 'WebGL' : 'CPU'} adjustment`)
          
          setSrc(result)
          clearLastChangedKey()
        } catch (error) {
          console.error('❌ Image adjustment failed:', error)
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
      isHardwareAccelerated,
      debounceTime
    ]
  )

  useEffect(() => {
    if (!downscaled || !lastChangedKey || !isInitialized) return

    debouncedApply(data)
    return () => debouncedApply.cancel()
  }, [data, lastChangedKey, debouncedApply, downscaled, isInitialized])
}