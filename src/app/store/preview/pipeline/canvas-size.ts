/**
 * Preview Canvas Size Atoms
 *
 * Single responsibility: Calculate preview canvas dimensions based on CPC mode
 */

import { atom } from 'jotai'
import {
  effectiveModeConfigAtom,
  egxEnabledAtom,
  egxTypeAtom,
  modeREnabledAtom,
  modeRPreviewModeAtom
} from '../../config/config'

/**
 * Container width for the preview canvas (set by the UI)
 */
export const previewCanvasWidthAtom = atom<number | null>(null)

/**
 * Calculate the preview canvas size based on:
 * - Container width
 * - CPC mode configuration (pixel aspect ratio)
 * - Special modes (EGX, Mode R)
 */
export const previewCanvasSizeAtom = atom((get) => {
  const containerWidth = get(previewCanvasWidthAtom)

  if (!containerWidth) return { width: 0, height: 0 }

  const modeConfig = get(effectiveModeConfigAtom)

  // Check if Mode R is enabled and using blended preview
  const modeREnabled = get(modeREnabledAtom)
  const modeRPreviewMode = get(modeRPreviewModeAtom)
  const isModeRBlended =
    modeREnabled && (modeRPreviewMode === 'blended' || !modeRPreviewMode)

  // Check if EGX is enabled
  const egxEnabled = get(egxEnabledAtom)
  const egxType = get(egxTypeAtom)

  // Calculate visual dimensions based on mode
  let visualWidth: number
  let visualHeight: number

  if (egxEnabled) {
    // EGX uses high-resolution mode dimensions
    const widthMultiplier = egxType === 'egx1' ? 2 : 4
    const getModePixelRatio = (mode: number) => {
      if (mode === 0) return 1
      if (mode === 1) return 2
      return 4
    }
    const baseWidthMode0 = modeConfig.width / getModePixelRatio(modeConfig.mode)
    const egxWidth = Math.round(baseWidthMode0 * widthMultiplier)
    visualWidth = egxWidth
    visualHeight = modeConfig.height * (egxType === 'egx1' ? 1 : 2)
  } else if (isModeRBlended) {
    // Mode R blended: outputs doubled width
    visualWidth = modeConfig.width * 2
    visualHeight = modeConfig.height
  } else {
    // Standard modes: apply scale factors from modeConfig
    visualWidth = modeConfig.width * modeConfig.scaleX
    visualHeight = modeConfig.height * modeConfig.scaleY
  }

  // Calculate scale to fit in container (don't upscale)
  const scale = Math.min(containerWidth / visualWidth, 1)

  const width = Math.floor(visualWidth * scale)
  const height = Math.floor(visualHeight * scale)

  return { width, height }
})
