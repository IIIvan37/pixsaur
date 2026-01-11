/**
 * Mode R Preview Image
 *
 * Creates preview ImageData for Mode R visualization.
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import {
  generateBlendedPreview,
  generateFlickerHeatmap,
  generateFrameAPreview,
  generateFrameBPreview
} from '@/libs/pixsaur-mode-r'
import {
  effectiveModeConfigAtom,
  modeREnabledAtom,
  modeRPreviewModeAtom
} from '../../config/config'
import { modeRQuantizationAtom } from './mode-r-quantization'

// ============================================================================
// Mode R Preview Image
// ============================================================================

/**
 * Mode R preview image based on selected preview mode
 */
export const modeRPreviewImageAtom = atom(
  async (get): Promise<ImageData | null> => {
    const modeREnabled = get(modeREnabledAtom)
    if (!modeREnabled) {
      logger.info('[Mode R] Preview skipped - Mode R not enabled')
      return null
    }

    const quantResult = await get(modeRQuantizationAtom)
    if (!quantResult) {
      logger.warn('[Mode R] Preview skipped - No quantization result')
      return null
    }

    const previewMode = get(modeRPreviewModeAtom)
    const { indexBufferA, indexBufferB, palettes } = quantResult

    // Output dimensions (Mode 0 resolution)
    // Get dimensions from mode config
    const modeConfig = get(effectiveModeConfigAtom)
    const height = modeConfig.height
    const actualWidth = modeConfig.width

    logger.info('[Mode R] Generating preview', {
      previewMode,
      height,
      actualWidth,
      bufferLength: quantResult.indexBufferA.length,
      paletteALength: palettes.paletteA.length,
      paletteBLength: palettes.paletteB.length
    })

    let previewData: Uint8ClampedArray

    switch (previewMode) {
      case 'frameA':
        previewData = generateFrameAPreview(
          indexBufferA,
          actualWidth,
          height,
          palettes
        )
        break

      case 'frameB':
        previewData = generateFrameBPreview(
          indexBufferB,
          actualWidth,
          height,
          palettes
        )
        break

      case 'flicker':
        previewData = generateFlickerHeatmap(
          indexBufferA,
          indexBufferB,
          actualWidth,
          height,
          palettes
        )
        break

      default:
        previewData = generateBlendedPreview(
          indexBufferA,
          indexBufferB,
          actualWidth,
          height,
          palettes
        )
        break
    }

    // For blended preview, output is at doubled resolution
    // frameA, frameB, and flicker show Mode 0 resolution (160×200)
    const isBlendedMode = previewMode === 'blended' || previewMode === undefined
    const outputWidth = isBlendedMode ? actualWidth * 2 : actualWidth

    logger.info('[Mode R] Preview generated', {
      outputWidth,
      height,
      dataLength: previewData.length
    })

    return new ImageData(
      new Uint8ClampedArray(previewData),
      outputWidth,
      height
    )
  }
)
