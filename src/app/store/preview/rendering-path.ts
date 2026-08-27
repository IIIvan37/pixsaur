/**
 * The active rendering path, as a Jotai atom.
 *
 * Deliberately a leaf module: it depends only on the primitive config atoms, so
 * anything in the store can ask "which path is rendering?" without pulling in
 * the preview pipeline. The dispatch that *uses* the answer lives in
 * `effective-rendering.ts`.
 */

import { atom } from 'jotai'
import {
  renderingPathCapabilities,
  resolveRenderingPath
} from '@/preview/application/rendering-path'
import { egxEnabledAtom } from '../config/egx'
import { modeREnabledAtom } from '../config/mode-r'
import { rasterChangesAtom, rasterEnabledAtom } from '../raster/raster-config'

/**
 * The rendering path currently in effect. Every consumer that used to branch on
 * `modeREnabledAtom` / `egxEnabledAtom` / `rasterEnabledAtom` reads this
 * instead, so a new path is added in one place.
 */
export const activeRenderingPathAtom = atom((get) =>
  resolveRenderingPath({
    modeREnabled: get(modeREnabledAtom),
    egxEnabled: get(egxEnabledAtom),
    rasterEnabled: get(rasterEnabledAtom),
    rasterChangeCount: get(rasterChangesAtom).length
  })
)

/** What the active path supports — see `RENDERING_PATH_CAPABILITIES`. */
export const activeRenderingPathCapabilitiesAtom = atom((get) =>
  renderingPathCapabilities(get(activeRenderingPathAtom))
)
