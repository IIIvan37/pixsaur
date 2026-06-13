/**
 * Session auto-persistence.
 *
 * `captureSessionAtom` reads the user-input leaf atoms into a serializable
 * {@link SessionSnapshot}; `restoreSessionAtom` writes one back. The plumbing
 * that wires these to `localStorage` (load on mount, debounced save on change)
 * lives in `use-session-persistence.ts`.
 */

import { atom } from 'jotai'
import { logger } from '@/core'
import { activePresetIdAtom, adjustmentsAtom } from '../config/adjustments'
import {
  customDimensionsAtom,
  dimensionPresetAtom,
  pixelModeAtom
} from '../config/dimensions'
import { colorSpaceAtom, ditheringAtom } from '../config/dithering'
import { egxOverscanAtom, egxPreviewModeAtom } from '../config/egx'
import { modeRPreviewModeAtom } from '../config/mode-r'
import {
  autoDistinctMappingAtom,
  colorDiversityAtom,
  horizontalSmoothingAtom,
  paletteStrategyAtom,
  processorTypeAtom,
  resampleStrategyAtom,
  smoothingAtom
} from '../config/processing'
import { centerImageAtom, resizeModeAtom } from '../config/resize'
import {
  canvasWidthAtom,
  imageAtom,
  selectionAtom,
  setImgAtom
} from '../image/image'
import { manualPixelEditsAtom } from '../preview/pipeline/manual-edits'
import { rasterEnabledAtom } from '../raster/raster-config'
import {
  SESSION_STORAGE_KEY,
  SESSION_VERSION,
  type SessionSnapshot
} from './session-types'

/** Read the current session into a plain serializable snapshot. */
export const captureSessionAtom = atom<SessionSnapshot>((get) => {
  const img = get(imageAtom)
  return {
    version: SESSION_VERSION,
    image: img ? { src: img.src } : null,
    canvasWidth: get(canvasWidthAtom),
    selection: get(selectionAtom),
    adjustments: get(adjustmentsAtom),
    activePresetId: get(activePresetIdAtom),
    pixelMode: get(pixelModeAtom),
    dimensionPreset: get(dimensionPresetAtom),
    customDimensions: get(customDimensionsAtom),
    colorSpace: get(colorSpaceAtom),
    dithering: get(ditheringAtom),
    smoothing: get(smoothingAtom),
    horizontalSmoothing: get(horizontalSmoothingAtom),
    processorType: get(processorTypeAtom),
    paletteStrategy: get(paletteStrategyAtom),
    autoDistinctMapping: get(autoDistinctMappingAtom),
    colorDiversity: get(colorDiversityAtom),
    resampleStrategy: get(resampleStrategyAtom),
    resizeMode: get(resizeModeAtom),
    centerImage: get(centerImageAtom),
    egxPreviewMode: get(egxPreviewModeAtom),
    egxOverscan: get(egxOverscanAtom),
    modeRPreviewMode: get(modeRPreviewModeAtom),
    rasterEnabled: get(rasterEnabledAtom),
    manualEdits: Array.from(get(manualPixelEditsAtom).entries())
  }
})

function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode session image'))
    img.src = src
  })
}

/** Apply a previously captured snapshot to the live atoms. */
export const restoreSessionAtom = atom(
  null,
  async (_get, set, snapshot: SessionSnapshot) => {
    // Settings first (synchronous) so the pipeline is configured before the
    // image lands and triggers a recompute.
    set(adjustmentsAtom, snapshot.adjustments)
    set(activePresetIdAtom, snapshot.activePresetId)
    set(pixelModeAtom, snapshot.pixelMode)
    set(dimensionPresetAtom, snapshot.dimensionPreset)
    set(customDimensionsAtom, snapshot.customDimensions)
    set(colorSpaceAtom, snapshot.colorSpace)
    set(ditheringAtom, snapshot.dithering)
    set(smoothingAtom, snapshot.smoothing)
    set(horizontalSmoothingAtom, snapshot.horizontalSmoothing)
    set(processorTypeAtom, snapshot.processorType)
    set(paletteStrategyAtom, snapshot.paletteStrategy)
    set(autoDistinctMappingAtom, snapshot.autoDistinctMapping)
    set(colorDiversityAtom, snapshot.colorDiversity)
    set(resampleStrategyAtom, snapshot.resampleStrategy)
    set(resizeModeAtom, snapshot.resizeMode)
    set(centerImageAtom, snapshot.centerImage)
    set(egxPreviewModeAtom, snapshot.egxPreviewMode)
    set(egxOverscanAtom, snapshot.egxOverscan)
    set(modeRPreviewModeAtom, snapshot.modeRPreviewMode)
    set(rasterEnabledAtom, snapshot.rasterEnabled)

    if (snapshot.canvasWidth !== null) {
      set(canvasWidthAtom, snapshot.canvasWidth)
    }

    // Source image: decode then push through the normal setter so srcVersion
    // bumps and the pipeline re-runs exactly like a fresh upload.
    if (snapshot.image) {
      try {
        const img = await decodeImage(snapshot.image.src)
        set(setImgAtom, img)
      } catch (error) {
        logger.warn('[Session] Failed to restore source image:', error)
      }
    }

    // Selection + manual edits reference the restored image's geometry.
    if (snapshot.selection) {
      set(selectionAtom, snapshot.selection)
    }
    if (snapshot.manualEdits.length > 0) {
      set(manualPixelEditsAtom, new Map(snapshot.manualEdits))
    }
  }
)

/** Read a persisted snapshot from localStorage, or null when absent/stale. */
export function loadSnapshot(): SessionSnapshot | null {
  try {
    const raw = globalThis.localStorage?.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionSnapshot
    if (parsed?.version !== SESSION_VERSION) return null
    return parsed
  } catch (error) {
    logger.warn('[Session] Failed to load session:', error)
    return null
  }
}

/**
 * Persist a snapshot. If the image pushes us past the localStorage quota, the
 * settings are kept and the image is dropped so the rest of the session still
 * survives a reload.
 */
export function persistSnapshot(snapshot: SessionSnapshot): void {
  try {
    globalThis.localStorage?.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(snapshot)
    )
  } catch {
    try {
      globalThis.localStorage?.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ ...snapshot, image: null })
      )
      logger.warn(
        '[Session] Source image too large to persist — saved settings only'
      )
    } catch (error) {
      logger.warn('[Session] Failed to persist session:', error)
    }
  }
}
