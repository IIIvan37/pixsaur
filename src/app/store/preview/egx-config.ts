/**
 * EGX Configuration Atoms
 *
 * Handles EGX mode configuration and dimension calculations.
 * EGX alternates video modes per line (spatial interlacing, no flicker).
 */

import { atom } from 'jotai'
import type { CpcModeConfig } from '@/app/store/config/types'
import type { EGXConfig, EGXType } from '@/libs/pixsaur-egx'
import {
  cpcHardwareAtom,
  ditheringAtom,
  effectiveModeConfigAtom,
  egxEnabledAtom,
  egxFirstLineModeAtom,
  egxTypeAtom
} from '../config/config'

/**
 * Get the CPC mode config for EGX based on the high-resolution mode.
 * EGX1: Uses Mode 1 dimensions (320×200 standard, 384×280 overscan)
 * EGX2: Uses Mode 2 dimensions (640×200 standard, 768×280 overscan)
 */
export function getEGXModeConfig(
  egxType: EGXType,
  baseModeConfig: CpcModeConfig
): CpcModeConfig {
  // EGX uses the high-resolution mode dimensions
  // EGX1: Mode 1 (320px wide), EGX2: Mode 2 (640px wide)
  const highResMode = egxType === 'egx1' ? 1 : 2

  // Calculate width based on the high-res mode
  // Mode 0: 160px, Mode 1: 320px, Mode 2: 640px
  // The ratio is: Mode 1 = 2× Mode 0, Mode 2 = 4× Mode 0
  const widthMultiplier = egxType === 'egx1' ? 2 : 4
  const getModeMultiplier = (mode: number) => {
    if (mode === 0) return 1
    if (mode === 1) return 2
    return 4
  }
  const modeMultiplier = getModeMultiplier(baseModeConfig.mode)
  const baseWidthMode0 = baseModeConfig.width / modeMultiplier
  const egxWidth = Math.round(baseWidthMode0 * widthMultiplier)

  return {
    ...baseModeConfig,
    mode: highResMode,
    width: egxWidth,
    // EGX has square-ish pixels (no horizontal stretching)
    scaleX: 1,
    scaleY: egxType === 'egx1' ? 1 : 2, // Mode 2 has tall pixels
    // EGX1: 16 colors (like Mode 0), EGX2: 4 colors (like Mode 1)
    nColors: egxType === 'egx1' ? 16 : 4
  }
}

/**
 * Derived EGX configuration from individual settings
 */
export const egxConfigAtom = atom((get): EGXConfig => {
  const type = get(egxTypeAtom)
  const firstLineMode = get(egxFirstLineModeAtom)
  const hardware = get(cpcHardwareAtom)
  const dithering = get(ditheringAtom)

  const ditheringEnabled = dithering.mode !== 'none'
  const ditheringIntensity = ditheringEnabled
    ? Math.round(dithering.intensity * 100)
    : 0

  return {
    type,
    firstLineMode,
    targetHardware: hardware,
    ditheringMode: ditheringEnabled ? dithering.mode : 'none',
    ditheringIntensity
  }
})

/**
 * Atom that provides the effective mode config for EGX.
 * Uses high-resolution mode dimensions.
 */
export const egxModeConfigAtom = atom((get): CpcModeConfig | null => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const egxType = get(egxTypeAtom)
  const baseModeConfig = get(effectiveModeConfigAtom)

  return getEGXModeConfig(egxType, baseModeConfig)
})
