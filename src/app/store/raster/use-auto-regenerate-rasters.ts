import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'
import { selectionAtom } from '../image/image'
import {
  autoOptimizeRasterAtom,
  hasGeneratedRastersAtom,
  rasterDitheringIntensityAtom,
  rasterEnabledAtom,
  rasterMaxChangesPerLineAtom
} from './raster'

/**
 * Hook that automatically regenerates rasters when key parameters change.
 * Only triggers if rasters have been auto-generated (preserves manual rasters).
 *
 * Watches:
 * - selection (user's selection rectangle)
 * - rasterDitheringIntensity (internal 1D dithering)
 * - maxChangesPerLine (raster changes limit)
 *
 * Note: finalDithering is NOT watched because it's applied AFTER raster optimization,
 * so changing it doesn't require regenerating the rasters.
 */
export function useAutoRegenerateRasters() {
  const rasterEnabled = useAtomValue(rasterEnabledAtom)
  const hasGeneratedRasters = useAtomValue(hasGeneratedRastersAtom)
  const selection = useAtomValue(selectionAtom)
  const rasterDitheringIntensity = useAtomValue(rasterDitheringIntensityAtom)
  const maxChangesPerLine = useAtomValue(rasterMaxChangesPerLineAtom)
  const autoOptimize = useSetAtom(autoOptimizeRasterAtom)

  // Refs to track previous values
  const previousSelectionRef = useRef(selection)
  const previousRasterDitheringRef = useRef(rasterDitheringIntensity)
  const previousMaxChangesRef = useRef(maxChangesPerLine)
  const isRegeneratingRef = useRef(false)

  useEffect(() => {
    // Skip all checks if we're currently regenerating
    if (isRegeneratingRef.current) {
      return
    }

    // Check what changed
    const selectionChanged =
      JSON.stringify(previousSelectionRef.current) !== JSON.stringify(selection)
    const rasterDitheringChanged =
      previousRasterDitheringRef.current !== rasterDitheringIntensity
    const maxChangesChanged =
      previousMaxChangesRef.current !== maxChangesPerLine

    // Update refs
    previousSelectionRef.current = selection
    previousRasterDitheringRef.current = rasterDitheringIntensity
    previousMaxChangesRef.current = maxChangesPerLine

    // Skip if nothing changed, raster not enabled, or no auto-generated rasters
    if (
      !rasterEnabled ||
      !hasGeneratedRasters ||
      (!selectionChanged && !rasterDitheringChanged && !maxChangesChanged)
    ) {
      return
    }

    // Set flag immediately to prevent re-triggering during regeneration
    isRegeneratingRef.current = true

    // Debounce the regeneration (300ms)
    const timeoutId = setTimeout(async () => {
      try {
        // Always reset changes when regenerating
        await autoOptimize({ resetChanges: true })
      } finally {
        isRegeneratingRef.current = false
      }
    }, 300)

    return () => {
      clearTimeout(timeoutId)
      // Reset flag if cleanup happens before timeout executes
      isRegeneratingRef.current = false
    }
  }, [
    selection,
    rasterDitheringIntensity,
    maxChangesPerLine,
    rasterEnabled,
    hasGeneratedRasters,
    autoOptimize
  ])
}
