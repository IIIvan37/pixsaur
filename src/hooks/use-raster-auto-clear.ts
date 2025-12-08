import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'
import {
  clearRasterChangesAtom,
  rasterInputSignatureAtom
} from '@/app/store/raster/raster'

/**
 * Hook that automatically clears raster changes when the image,
 * adjustments, palette strategy, mode config, or hardware settings change.
 *
 * This ensures raster optimizations are always recalculated when
 * the underlying image processing changes.
 *
 * Note: Does NOT clear on dithering changes since final dithering is applied
 * AFTER raster optimization and doesn't invalidate existing rasters.
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
        prevSignature.modeConfig !== signature.modeConfig ||
        prevSignature.hardware !== signature.hardware

      if (hasChanged) {
        clearRaster()
      }
    }

    prevSignatureRef.current = signature
  }, [signature, clearRaster])
}
