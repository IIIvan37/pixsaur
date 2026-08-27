/**
 * EGX Index Buffer Generation
 *
 * Thin adapters over the `quantizeEgx` use-case
 * (`@/preview/application/quantize-egx`): the atoms assemble the input from the
 * EGX config/palette/image atoms and delegate the dithering + per-line index
 * mapping. They stay async only to await their upstream pipeline atoms.
 */

import { atom } from 'jotai'
import { quantizeEgx } from '@/preview/application/quantize-egx'
import { ditheringAtom, egxEnabledAtom } from '../../config/config'
import { applyManualEditsToBuffer, manualPixelEditsAtom } from '../preview'
import { egxConfigAtom } from './egx-config'
import { egxNormalizedImageAtom } from './egx-image'
import { egxPaletteAtom } from './egx-palette'

/**
 * EGX index buffer for the preview editor: one palette index per pixel,
 * respecting the per-line EGX constraints.
 */
export const egxIndexBufferAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const config = get(egxConfigAtom)
  const dithering = get(ditheringAtom)
  const paletteInfo = await get(egxPaletteAtom)
  const normalized = await get(egxNormalizedImageAtom)

  if (!paletteInfo || !normalized) return null

  const result = quantizeEgx({
    normalized,
    palette: paletteInfo.colors,
    config,
    dithering
  })

  return result.ok ? result.indexBuffer : null
})

/**
 * Final EGX index buffer with manual edits applied.
 * This is the buffer that should be used for export in EGX mode.
 */
export const finalEgxIndexBufferAtom = atom(async (get) => {
  const egxEnabled = get(egxEnabledAtom)
  if (!egxEnabled) return null

  const baseData = await get(egxIndexBufferAtom)
  if (!baseData) return null

  const edits = get(manualPixelEditsAtom)
  return applyManualEditsToBuffer(baseData, edits)
})
