import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'
import { egxEnabledAtom } from '../../config/egx'
import { modeREnabledAtom } from '../../config/mode-r'
import {
  rasterChangesAtom,
  rasterEnabledAtom
} from '../../raster/raster-config'
import {
  activeRenderingPathAtom,
  activeRenderingPathCapabilitiesAtom
} from '../rendering-path'

/** A store with every alternate rendering path switched off. */
function standardStore() {
  const store = createStore()
  store.set(modeREnabledAtom, false)
  store.set(egxEnabledAtom, false)
  store.set(rasterEnabledAtom, false)
  store.set(rasterChangesAtom, [])
  return store
}

const oneRasterChange = [
  { id: 'c1', line: 10, inkIndex: 0, color: [0, 0, 0] }
] as never

describe('activeRenderingPathAtom', () => {
  it('is the standard path with every alternate mode off', () => {
    expect(standardStore().get(activeRenderingPathAtom)).toBe('standard')
  })

  it('follows the Mode R flag', () => {
    const store = standardStore()
    store.set(modeREnabledAtom, true)
    expect(store.get(activeRenderingPathAtom)).toBe('mode-r')
  })

  it('follows the EGX flag', () => {
    const store = standardStore()
    store.set(egxEnabledAtom, true)
    expect(store.get(activeRenderingPathAtom)).toBe('egx')
  })

  it('takes the raster path once a change exists', () => {
    const store = standardStore()
    store.set(rasterEnabledAtom, true)
    store.set(rasterChangesAtom, oneRasterChange)
    expect(store.get(activeRenderingPathAtom)).toBe('raster')
  })

  it('stays on the standard path while raster carries no change', () => {
    const store = standardStore()
    store.set(rasterEnabledAtom, true)
    expect(store.get(activeRenderingPathAtom)).toBe('standard')
  })

  it('leaves the raster path when its last change is removed', () => {
    const store = standardStore()
    store.set(rasterEnabledAtom, true)
    store.set(rasterChangesAtom, oneRasterChange)
    store.set(rasterChangesAtom, [])
    expect(store.get(activeRenderingPathAtom)).toBe('standard')
  })
})

describe('activeRenderingPathCapabilitiesAtom', () => {
  it('reports the editor available on the standard path', () => {
    expect(
      standardStore().get(activeRenderingPathCapabilitiesAtom).editor
    ).toBe(true)
  })

  it('reports the editor unavailable once Mode R is on', () => {
    const store = standardStore()
    store.set(modeREnabledAtom, true)
    expect(store.get(activeRenderingPathCapabilitiesAtom).editor).toBe(false)
  })
})
