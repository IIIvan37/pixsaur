import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { ditheringAtom } from '../../config/dithering'
import { egxEnabledAtom } from '../../config/egx'
import { modeREnabledAtom } from '../../config/mode-r'
import {
  rasterChangesAtom,
  rasterEnabledAtom
} from '../../raster/raster-config'
import { rasterOptimizationResultAtom } from '../../raster/raster-index-buffer'
import { effectiveIndexBufferAtom } from '../effective-rendering'

const RASTER_BUFFER = new Uint8Array([1, 2, 3, 4])

function storeOnPath(
  flags: Partial<{ modeR: boolean; egx: boolean; raster: boolean }> = {}
) {
  const store = createStore()
  store.set(modeREnabledAtom, flags.modeR ?? false)
  store.set(egxEnabledAtom, flags.egx ?? false)
  store.set(rasterEnabledAtom, flags.raster ?? false)
  store.set(
    rasterChangesAtom,
    flags.raster
      ? ([{ id: 'c1', line: 0, inkIndex: 0, color: [0, 0, 0] }] as never)
      : []
  )
  return store
}

/**
 * Plants a ready raster buffer, so "returns null" becomes a real statement
 * about the dispatch rather than a statement about an empty pipeline.
 */
function withRasterResult(store: ReturnType<typeof createStore>) {
  store.set(ditheringAtom, { mode: 'none', intensity: 0 } as never)
  store.set(rasterOptimizationResultAtom, {
    optimizedIndexBuffer: RASTER_BUFFER,
    quantizedGlobalPalette: [[0, 0, 0]] as Vector<'RGB'>[],
    rasterChanges: [],
    preprocessedImage: new ImageData(2, 2),
    width: 2,
    height: 2
  })
  return store
}

describe('effectiveIndexBufferAtom', () => {
  it('hands the editor the raster buffer on the raster path', async () => {
    const store = withRasterResult(storeOnPath({ raster: true }))
    const buffer = await store.get(effectiveIndexBufferAtom)
    expect(buffer?.buffer).toBe(RASTER_BUFFER)
  })

  it('has no buffer to offer on the Mode R path, even when one is ready', async () => {
    // Mode R wins the path resolution while a raster buffer sits ready one
    // branch away. Mode R declares no single index buffer, so the dispatch must
    // refuse rather than hand back another path's — the exact silent
    // substitution the old priority chain performed.
    const store = withRasterResult(storeOnPath({ modeR: true, raster: true }))
    await expect(store.get(effectiveIndexBufferAtom)).resolves.toBeNull()
  })

  it('ignores the raster buffer once its last change is deleted', async () => {
    // Raster still enabled, but with no change the standard path renders — the
    // editor must follow the screen instead of the stale optimization result.
    const store = withRasterResult(storeOnPath({ raster: true }))
    store.set(rasterChangesAtom, [])
    await expect(store.get(effectiveIndexBufferAtom)).resolves.toBeNull()
  })

  it('is null on the standard path until the pipeline produces a buffer', async () => {
    await expect(
      storeOnPath().get(effectiveIndexBufferAtom)
    ).resolves.toBeNull()
  })

  it('falls back to the standard buffer when the EGX one is missing', async () => {
    await expect(
      storeOnPath({ egx: true }).get(effectiveIndexBufferAtom)
    ).resolves.toBeNull()
  })
})
