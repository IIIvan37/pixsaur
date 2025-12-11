/**
 * Hook to handle automatic raster regeneration when tuning parameters change
 */

import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'
import logger from '@/core/logger'
import { rasterTuningOverrides } from '@/libs/pixsaur-raster/optimize-line-palettes'
import {
  autoOptimizeRasterAtom,
  hasGeneratedRastersAtom,
  rasterEnabledAtom
} from './raster'
import {
  horizontalErrorCoefficientAtom,
  mode0LineWeightAtom,
  mode0PixelWeightAtom,
  paletteContinuityBonusAtom,
  paletteContinuityDistanceAtom,
  paletteFrequencyExponentAtom,
  verticalErrorCoefficientAtom
} from './raster-tuning'

/**
 * Synchronizes tuning parameter atoms with rasterTuningOverrides
 * and auto-regenerates rasters when parameters change
 */
export function useRasterTuningRegeneration() {
  const autoOptimize = useSetAtom(autoOptimizeRasterAtom)
  const rasterEnabled = useAtomValue(rasterEnabledAtom)
  const hasGeneratedRasters = useAtomValue(hasGeneratedRastersAtom)

  const verticalErrorCoef = useAtomValue(verticalErrorCoefficientAtom)
  const horizontalErrorCoef = useAtomValue(horizontalErrorCoefficientAtom)
  const paletteContinuityDistance = useAtomValue(paletteContinuityDistanceAtom)
  const paletteContinuityBonus = useAtomValue(paletteContinuityBonusAtom)
  const paletteFrequencyExponent = useAtomValue(paletteFrequencyExponentAtom)
  const mode0PixelWeight = useAtomValue(mode0PixelWeightAtom)
  const mode0LineWeight = useAtomValue(mode0LineWeightAtom)

  const isRegeneratingRef = useRef(false)

  useEffect(() => {
    // Always update the overrides
    rasterTuningOverrides.verticalErrorCoefficient = verticalErrorCoef
    rasterTuningOverrides.horizontalErrorCoefficient = horizontalErrorCoef
    rasterTuningOverrides.paletteContinuityDistance = paletteContinuityDistance
    rasterTuningOverrides.paletteContinuityBonus = paletteContinuityBonus
    rasterTuningOverrides.paletteFrequencyExponent = paletteFrequencyExponent
    rasterTuningOverrides.mode0PixelWeight = mode0PixelWeight
    rasterTuningOverrides.mode0LineWeight = mode0LineWeight

    // Skip regeneration if already regenerating or if rasters aren't enabled/generated
    if (isRegeneratingRef.current || !rasterEnabled || !hasGeneratedRasters) {
      return
    }

    // Set flag to prevent re-triggering
    isRegeneratingRef.current = true

    // Debounce the regeneration (200ms) to avoid too many updates
    const timeoutId = setTimeout(() => {
      autoOptimize({ resetChanges: true })
        .catch((error) => {
          logger.error('Failed to regenerate rasters:', error)
        })
        .finally(() => {
          isRegeneratingRef.current = false
        })
    }, 200)

    return () => {
      clearTimeout(timeoutId)
      isRegeneratingRef.current = false
    }
  }, [
    verticalErrorCoef,
    horizontalErrorCoef,
    paletteContinuityDistance,
    paletteContinuityBonus,
    paletteFrequencyExponent,
    mode0PixelWeight,
    mode0LineWeight,
    rasterEnabled,
    hasGeneratedRasters,
    autoOptimize
  ])
}
