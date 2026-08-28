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
