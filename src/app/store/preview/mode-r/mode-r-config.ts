/**
 * Mode R Configuration
 *
 * Handles Mode R settings and configuration derivation.
 */

import { atom } from 'jotai'
import type { ModeRConfig } from '@/libs/pixsaur-mode-r'
import {
  cpcHardwareAtom,
  ditheringAtom,
  modeRAntiFlickerAtom,
  modeRDualPaletteAtom,
  modeRMaxLuminanceDeltaAtom
} from '../../config/config'

/**
 * Derived Mode R configuration from individual settings.
 *
 * Reads `ditheringAtom` raw, not `effectiveDitheringAtom`: the Mode R path does
 * not force dithering off under distinct mapping
 * (`renderingPathCapabilities('mode-r').distinctMappingForcesNoDither`).
 */
export const modeRConfigAtom = atom((get): ModeRConfig => {
  const antiFlickerWeight = get(modeRAntiFlickerAtom)
  const maxLuminanceDelta = get(modeRMaxLuminanceDeltaAtom)
  const hardware = get(cpcHardwareAtom)
  const dithering = get(ditheringAtom)
  const useDualPalette = get(modeRDualPaletteAtom)

  // Use the same dithering intensity as standard mode (0-1 range → 0-100)
  const ditheringEnabled = dithering.mode !== 'none'
  const ditheringIntensity = ditheringEnabled
    ? Math.round(dithering.intensity * 100)
    : 0

  // When using dual palette, reduce anti-flicker weight to allow more color diversity
  // Otherwise the quantizer picks similar colors to minimize flicker, defeating the purpose
  const effectiveAntiFlicker = useDualPalette
    ? Math.min(antiFlickerWeight, 30) // Cap at 30% for dual palette mode
    : antiFlickerWeight

  return {
    antiFlickerWeight: effectiveAntiFlicker,
    maxLuminanceDelta,
    targetHardware: hardware,
    // Pass the actual dithering mode from settings
    ditheringMode: ditheringEnabled ? dithering.mode : 'none',
    ditheringIntensity,
    useDualPalette,
    useDiffusionCorrection: dithering.useDiffusionCorrection,
    useOrderedCorrection: dithering.useOrderedCorrection
  }
})
