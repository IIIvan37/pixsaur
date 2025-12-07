import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'
import {
  clearRasterChangesAtom,
  rasterInputSignatureAtom
} from '@/app/store/raster/raster'

/**
 * Hook that automatically clears raster changes when the image,
 * adjustments, palette strategy, or dithering settings change.
 *
 * This ensures raster optimizations are always recalculated when
 * the underlying image processing changes.
 */
export function useRasterAutoClear() {
  const signature = useAtomValue(rasterInputSignatureAtom)
  const clearRaster = useSetAtom(clearRasterChangesAtom)

  // Track the previous signature to detect changes
  const prevSignatureRef = useRef<typeof signature | null>(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Skip the first render - don't clear on initial load
    if (isFirstRender.current) {
      isFirstRender.current = false
      prevSignatureRef.current = signature
      return
    }

    // Check if signature has changed
    const prevSignature = prevSignatureRef.current
    if (prevSignature) {
      const hasChanged =
        prevSignature.imageId !== signature.imageId ||
        prevSignature.adjustments !== signature.adjustments ||
        prevSignature.strategy !== signature.strategy ||
        prevSignature.ditheringMode !== signature.ditheringMode ||
        prevSignature.ditheringIntensity !== signature.ditheringIntensity

      if (hasChanged) {
        clearRaster()
      }
    }

    prevSignatureRef.current = signature
  }, [signature, clearRaster])
}
