/**
 * The conversion itself — CPU, synchronous, no adapter (Q30).
 *
 * A 256x256 sheet is 65 000 pixels, less than one preview frame; and the GPU
 * is not deterministic between drivers, which would break the deduplication
 * the edit link of Q11 rests on.
 */

import { atom } from 'jotai'
import { type ConvertTilesetResult, convertTileset } from '@/tileset'
import {
  tilesetHardwareAtom,
  tilesetModeAtom,
  tilesetOptionsAtom
} from './config'
import { tilesetTargetAtom } from './geometry'
import { tilesetGridAtom } from './grid'
import { tilesetSheetAtom } from './sheet'

/** `null` until a sheet is imported — there is nothing to convert before. */
export const convertedTilesetAtom = atom<ConvertTilesetResult | null>((get) => {
  const sheet = get(tilesetSheetAtom)
  if (!sheet) return null

  return convertTileset({
    sheet,
    source: get(tilesetGridAtom),
    target: get(tilesetTargetAtom),
    mode: get(tilesetModeAtom),
    hardware: get(tilesetHardwareAtom),
    ...get(tilesetOptionsAtom)
  })
})

/**
 * Pins the palette the conversion just chose (Q26 · Q28).
 *
 * Edits are stored as pen INDICES, so a palette left free to drift would
 * silently repaint every tile that used pen 5 the next time the sheet, the
 * grid or a setting moves. Freezing is what makes an edit outlive a reglage.
 */
export const freezeTilesetPaletteAtom = atom(null, (get, set) => {
  const result = get(convertedTilesetAtom)
  if (!result?.ok) return

  set(tilesetOptionsAtom, {
    ...get(tilesetOptionsAtom),
    palette: result.tileset.palette
  })
})

/** Hands the palette back to the strategy, whatever the sheet now asks for. */
export const thawTilesetPaletteAtom = atom(null, (get, set) => {
  const { palette: _thawed, ...kept } = get(tilesetOptionsAtom)
  set(tilesetOptionsAtom, kept)
})
