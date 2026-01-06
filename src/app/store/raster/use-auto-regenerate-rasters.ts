import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'
import { logger } from '@/core'
import { isSelectionDraggingAtom, selectionAtom } from '../image/image'
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
  const isSelectionDragging = useAtomValue(isSelectionDraggingAtom)
  const rasterDitheringIntensity = useAtomValue(rasterDitheringIntensityAtom)
  const maxChangesPerLine = useAtomValue(rasterMaxChangesPerLineAtom)
  const autoOptimize = useSetAtom(autoOptimizeRasterAtom)

  // Refs to track previous values
  const previousSelectionRef = useRef(selection)
  const previousRasterDitheringRef = useRef(rasterDitheringIntensity)
  const previousMaxChangesRef = useRef(maxChangesPerLine)
  const isRegeneratingRef = useRef(false)

  useEffect(() => {
    logger.info('[RASTER-REGEN] useEffect triggered', {
      rasterDitheringIntensity,
      maxChangesPerLine,
      rasterEnabled,
      hasGeneratedRasters
    })

    // Skip all checks if we're currently regenerating
    if (isRegeneratingRef.current) {
      logger.debug('[RASTER-REGEN] Skipping: already regenerating')
      return
    }

    // Check what changed
    const selectionChanged =
      JSON.stringify(previousSelectionRef.current) !== JSON.stringify(selection)
    const rasterDitheringChanged =
      previousRasterDitheringRef.current !== rasterDitheringIntensity
    const maxChangesChanged =
      previousMaxChangesRef.current !== maxChangesPerLine

    logger.debug('[RASTER-REGEN] State check:', {
      rasterEnabled,
      hasGeneratedRasters,
      selectionChanged,
      rasterDitheringChanged,
      maxChangesChanged,
      previousDithering: previousRasterDitheringRef.current,
      currentDithering: rasterDitheringIntensity,
      previousMaxChanges: previousMaxChangesRef.current,
      currentMaxChanges: maxChangesPerLine
    })

    // Update refs
    previousSelectionRef.current = selection
    previousRasterDitheringRef.current = rasterDitheringIntensity
    previousMaxChangesRef.current = maxChangesPerLine

    // Skip if nothing changed or raster not enabled
    // Note: We don't check hasGeneratedRasters for dithering/maxChanges changes
    // because user expects immediate feedback when adjusting these sliders
    if (!rasterEnabled) {
      logger.debug('[RASTER-REGEN] Skipping: raster not enabled')
      return
    }

    // For selection changes, only regenerate if rasters were already generated
    if (selectionChanged && !hasGeneratedRasters) {
      logger.debug(
        '[RASTER-REGEN] Skipping selection change: no generated rasters'
      )
      return
    }

    // Skip if nothing actually changed
    if (!selectionChanged && !rasterDitheringChanged && !maxChangesChanged) {
      logger.debug('[RASTER-REGEN] Skipping: no changes detected')
      return
    }

    // Skip regeneration while user is actively dragging/resizing the selection
    if (isSelectionDragging) {
      logger.debug('[RASTER-REGEN] Skipping: selection is dragging')
      return
    }

    // Set flag immediately to prevent re-triggering during regeneration
    isRegeneratingRef.current = true
    logger.info('[RASTER-REGEN] Triggering regeneration...', {
      selectionChanged,
      rasterDitheringChanged,
      maxChangesChanged
    })

    // Debounce the regeneration (800ms - increased from 300ms for better performance)
    const timeoutId = setTimeout(async () => {
      try {
        logger.info('[RASTER-REGEN] Executing autoOptimize')
        // Always reset changes when regenerating
        await autoOptimize({ resetChanges: true })
        logger.info('[RASTER-REGEN] autoOptimize completed')
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
    isSelectionDragging,
    rasterDitheringIntensity,
    maxChangesPerLine,
    rasterEnabled,
    hasGeneratedRasters,
    autoOptimize
  ])
}
