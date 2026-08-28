/**
 * The destination tile size and what it costs in distortion (Q1 · Q7 · Q8).
 *
 * `suggestTileGeometry` advises, it does not constrain: the user may pick a
 * size the source shape does not like, and read how far off it is.
 */

import { atom } from 'jotai'
import {
  SOURCE_PIXEL_ASPECT,
  type SourcePlatform,
  type TileGrid
} from '@/libs/pixsaur-tileset'
import { suggestTileGeometry, type TileGeometry } from '@/tileset'
import { tilesetModeAtom } from './config'
import { tilesetGridAtom } from './grid'

const DEFAULT_TARGET: TileGrid = { tileWidth: 8, tileHeight: 8 }

export const tilesetTargetAtom = atom<TileGrid>(DEFAULT_TARGET)

export const setTilesetTargetAtom = atom(
  null,
  (get, set, payload: Partial<TileGrid>) => {
    set(tilesetTargetAtom, { ...get(tilesetTargetAtom), ...payload })
  }
)

/** The machine the sheet comes from — its pixel shape, nothing else. */
export const sourcePlatformAtom = atom<SourcePlatform>('nes-ntsc')

export const tilesetGeometryAtom = atom<TileGeometry>((get) => {
  const { tileWidth, tileHeight } = get(tilesetGridAtom)
  return suggestTileGeometry({
    source: { tileWidth, tileHeight },
    sourcePixel: SOURCE_PIXEL_ASPECT[get(sourcePlatformAtom)],
    mode: get(tilesetModeAtom),
    target: get(tilesetTargetAtom)
  })
})
