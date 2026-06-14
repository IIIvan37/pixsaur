/**
 * Use-case: derive the initial editing session when entering edit mode.
 *
 * Pure, synchronous, total. Replaces the state-derivation logic inlined in
 * `enterEditModeAtom` (`app/store/editor/editor-actions.ts`). The Jotai atom
 * stays a thin adapter: it awaits the candidate index buffers, resolves the
 * mode-specific raw base buffer, calls this function, and writes the result
 * back to the editor atoms (plus the constant view-control resets — cursor,
 * viewport, zoom, grid — which carry no business logic).
 *
 * The rules captured here:
 * - **Base buffer (for diffing on apply):** the mode-specific raw buffer
 *   (without manual edits) when available, otherwise the effective buffer. The
 *   atom picks WHICH raw buffer (EGX > raster > preview) by awaiting only the
 *   active mode's source; this use-case applies the fallback and the copy.
 * - **EGX capture:** `egxConfig` is kept only when EGX is active.
 * - **Pixel mode (aspect ratio):** EGX1 → Mode 1, EGX2 → Mode 2; otherwise the
 *   current config pixel mode.
 * - Both buffers are **copied** (input never aliased), and the palette is
 *   deep-copied per color.
 */

import type { PixelMode } from '@/domain/cpc'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import type { EGXConfig, EGXType } from '@/libs/pixsaur-egx'
import type { RasterChange } from '@/libs/pixsaur-raster/types'

export interface EnterEditModeInput {
  /**
   * Effective index buffer to edit (with manual edits already applied), plus
   * its dimensions and palette. The atom guards the null case before calling.
   */
  effective: {
    buffer: Uint8Array
    width: number
    height: number
    palette: Vector[]
  }
  /**
   * Mode-specific raw base buffer (without manual edits) for the active mode —
   * EGX, raster, or preview — or `null` when that source is unavailable, in
   * which case the effective buffer is used as the base.
   */
  baseBufferRaw: Uint8Array | null
  /** Whether EGX mode is active. */
  egxEnabled: boolean
  /** EGX configuration when active (captured only if `egxEnabled`). */
  egxConfig: EGXConfig | null
  /** EGX variant, used to derive the aspect-ratio pixel mode in EGX. */
  egxType: EGXType
  /** Current config pixel mode, used when EGX is inactive. */
  configPixelMode: PixelMode
  /** Active raster changes to carry into the edit session. */
  rasterChanges: RasterChange[]
}

export interface EditSession {
  /** Base buffer (without edits) kept for diffing when changes are applied. */
  originalBuffer: Uint8Array
  /** Working copy the editor mutates. */
  editBuffer: Uint8Array
  dimensions: { width: number; height: number }
  egxEnabled: boolean
  egxConfig: EGXConfig | null
  pixelMode: PixelMode
  basePalette: Vector<'RGB'>[]
  rasterChanges: RasterChange[]
}

export function enterEditMode(input: EnterEditModeInput): EditSession {
  const {
    effective,
    baseBufferRaw,
    egxEnabled,
    egxConfig,
    egxType,
    configPixelMode,
    rasterChanges
  } = input

  // EGX1 uses Mode 1 dimensions (square pixels); EGX2 uses Mode 2 (tall pixels).
  const egxPixelMode: PixelMode = egxType === 'egx1' ? 1 : 2
  const pixelMode: PixelMode = egxEnabled ? egxPixelMode : configPixelMode

  return {
    originalBuffer: new Uint8Array(baseBufferRaw ?? effective.buffer),
    editBuffer: new Uint8Array(effective.buffer),
    dimensions: { width: effective.width, height: effective.height },
    egxEnabled,
    egxConfig: egxEnabled ? egxConfig : null,
    pixelMode,
    basePalette: effective.palette.map((c) => [...c] as Vector<'RGB'>),
    rasterChanges: [...rasterChanges]
  }
}
