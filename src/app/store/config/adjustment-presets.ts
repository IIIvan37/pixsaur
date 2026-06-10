/**
 * Source image adjustment presets
 *
 * Built-in, one-click combinations of source-image adjustments (vibrance,
 * contrast, gamma, median…). Applying a preset resets every adjustment to its
 * default value, then overlays only the keys the preset defines — so a preset
 * always yields the same result regardless of the previous state.
 *
 * Values are in app units (vibrance -100..100, contrast/saturation/gamma
 * multiplicative, shadows -100..100, median 0..3) and were derived empirically.
 */

import { atom } from 'jotai'
import {
  activePresetIdAtom,
  adjustmentsAtom,
  defaultAdjustments
} from './adjustments'
import type { AdjustementKey } from './types'

export type AdjustmentPresetId = 'neutral' | 'vivid' | 'dark-photo' | 'poster'

export type AdjustmentPreset = {
  id: AdjustmentPresetId
  values: Partial<Record<AdjustementKey, number>>
}

export const ADJUSTMENT_PRESETS: readonly AdjustmentPreset[] = [
  { id: 'neutral', values: {} },
  { id: 'vivid', values: { vibrance: 45, contrast: 1.15, saturation: 1.1 } },
  {
    id: 'dark-photo',
    values: { gamma: 1.15, shadows: 25, vibrance: 60, contrast: 1.2 }
  },
  {
    id: 'poster',
    values: { vibrance: 70, contrast: 1.3, saturation: 1.2, median: 1 }
  }
]

/**
 * Apply a preset: start from defaults, overlay the preset's keys, and record
 * the active preset id. Unknown ids are ignored.
 */
export const applyAdjustmentPresetAtom = atom(
  null,
  (_get, set, id: AdjustmentPresetId) => {
    const preset = ADJUSTMENT_PRESETS.find((p) => p.id === id)
    if (!preset) {
      return
    }
    set(adjustmentsAtom, {
      ...defaultAdjustments,
      ...preset.values,
      lastChangedKey: null
    })
    set(activePresetIdAtom, id)
  }
)
