/**
 * Preview Canvas Size Atoms
 *
 * Single responsibility: Calculate preview canvas dimensions from the CPC mode
 * and the active rendering path (each path paints at its own resolution).
 */

import { atom } from 'jotai'
import type { CpcModeConfig } from '@/domain/cpc'
import type { RenderingPathId } from '@/preview/application/rendering-path'
import {
  effectiveModeConfigAtom,
  egxTypeAtom,
  modeRPreviewModeAtom
} from '../../config/config'
import { activeRenderingPathAtom } from '../rendering-path'

/**
 * Container width for the preview canvas (set by the UI)
 */
export const previewCanvasWidthAtom = atom<number | null>(null)

/** Horizontal pixels a mode-0 pixel is worth in the given CPC mode. */
function modePixelRatio(mode: number): number {
  if (mode === 0) return 1
  if (mode === 1) return 2
  return 4
}

/**
 * The dimensions the active path actually paints, before fitting the container.
 *
 * Each rendering path draws at its own resolution: EGX at the high-resolution
 * mode's width (and doubled height for EGX2), Mode R at doubled width when it
 * blends the two frames, everything else at the CPC mode's own scale factors.
 */
function visualSize(
  path: RenderingPathId,
  modeConfig: CpcModeConfig,
  egxType: string,
  modeRPreviewMode: string | undefined
): { width: number; height: number } {
  switch (path) {
    case 'egx': {
      const widthMultiplier = egxType === 'egx1' ? 2 : 4
      const baseWidthMode0 = modeConfig.width / modePixelRatio(modeConfig.mode)
      return {
        width: Math.round(baseWidthMode0 * widthMultiplier),
        height: modeConfig.height * (egxType === 'egx1' ? 1 : 2)
      }
    }
    case 'mode-r': {
      const isBlended =
        modeRPreviewMode === 'blended' || modeRPreviewMode === undefined
      return {
        width: isBlended ? modeConfig.width * 2 : modeConfig.width,
        height: modeConfig.height
      }
    }
    case 'raster':
    case 'standard':
      return {
        width: modeConfig.width * modeConfig.scaleX,
        height: modeConfig.height * modeConfig.scaleY
      }
  }
}

/**
 * Calculate the preview canvas size from the container width and what the
 * active rendering path paints. Never upscales.
 */
export const previewCanvasSizeAtom = atom((get) => {
  const containerWidth = get(previewCanvasWidthAtom)

  if (!containerWidth) return { width: 0, height: 0 }

  const visual = visualSize(
    get(activeRenderingPathAtom),
    get(effectiveModeConfigAtom),
    get(egxTypeAtom),
    get(modeRPreviewModeAtom)
  )

  // Fit inside the container without upscaling.
  const scale = Math.min(containerWidth / visual.width, 1)

  return {
    width: Math.floor(visual.width * scale),
    height: Math.floor(visual.height * scale)
  }
})
