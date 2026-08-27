import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'
import { pixelModeAtom } from '../../config/dimensions'
import { egxEnabledAtom, egxTypeAtom } from '../../config/egx'
import { modeREnabledAtom, modeRPreviewModeAtom } from '../../config/mode-r'
import {
  rasterChangesAtom,
  rasterEnabledAtom
} from '../../raster/raster-config'
import { previewCanvasSizeAtom, previewCanvasWidthAtom } from './canvas-size'

/**
 * A store on the standard path, mode 0 (160×200, scale 2×1 → 320×200 visual),
 * in a container wide enough that nothing is scaled down.
 */
function standardStore() {
  const store = createStore()
  store.set(previewCanvasWidthAtom, 1000)
  store.set(pixelModeAtom, 0)
  store.set(egxEnabledAtom, false)
  store.set(modeREnabledAtom, false)
  store.set(rasterEnabledAtom, false)
  store.set(rasterChangesAtom, [])
  return store
}

describe('previewCanvasSizeAtom', () => {
  it('is empty until the container reports its width', () => {
    const store = standardStore()
    store.set(previewCanvasWidthAtom, null)
    expect(store.get(previewCanvasSizeAtom)).toEqual({ width: 0, height: 0 })
  })

  describe('standard path', () => {
    it('applies the mode scale factors (mode 0: 160×200 at 2×1)', () => {
      expect(standardStore().get(previewCanvasSizeAtom)).toEqual({
        width: 320,
        height: 200
      })
    })

    it('applies the vertical scale factor of mode 2 (640×200 at 1×2)', () => {
      const store = standardStore()
      store.set(pixelModeAtom, 2)
      expect(store.get(previewCanvasSizeAtom)).toEqual({
        width: 640,
        height: 400
      })
    })

    it('scales down to fit a narrow container', () => {
      const store = standardStore()
      store.set(previewCanvasWidthAtom, 160)
      expect(store.get(previewCanvasSizeAtom)).toEqual({
        width: 160,
        height: 100
      })
    })

    it('never upscales past the native size', () => {
      const store = standardStore()
      store.set(previewCanvasWidthAtom, 4000)
      expect(store.get(previewCanvasSizeAtom).width).toBe(320)
    })
  })

  describe('raster path', () => {
    it('paints at the same size as the standard path', () => {
      const store = standardStore()
      store.set(rasterEnabledAtom, true)
      store.set(rasterChangesAtom, [
        { id: 'c1', line: 10, inkIndex: 0, color: [0, 0, 0] }
      ] as never)
      expect(store.get(previewCanvasSizeAtom)).toEqual({
        width: 320,
        height: 200
      })
    })
  })

  describe('EGX path', () => {
    it('doubles the mode-0 width for EGX1', () => {
      const store = standardStore()
      store.set(egxEnabledAtom, true)
      store.set(egxTypeAtom, 'egx1')
      expect(store.get(previewCanvasSizeAtom)).toEqual({
        width: 320,
        height: 200
      })
    })

    it('quadruples the width and doubles the height for EGX2', () => {
      const store = standardStore()
      store.set(egxEnabledAtom, true)
      store.set(egxTypeAtom, 'egx2')
      expect(store.get(previewCanvasSizeAtom)).toEqual({
        width: 640,
        height: 400
      })
    })

    it('normalizes a mode-1 config to its mode-0 pixel count first', () => {
      const store = standardStore()
      store.set(pixelModeAtom, 1)
      store.set(egxEnabledAtom, true)
      store.set(egxTypeAtom, 'egx1')
      // 320 mode-1 pixels = 160 mode-0 pixels, doubled by EGX1.
      expect(store.get(previewCanvasSizeAtom).width).toBe(320)
    })
  })

  describe('Mode R path', () => {
    it('doubles the width when blending the two frames', () => {
      const store = standardStore()
      store.set(modeREnabledAtom, true)
      store.set(modeRPreviewModeAtom, 'blended')
      expect(store.get(previewCanvasSizeAtom)).toEqual({
        width: 320,
        height: 200
      })
    })

    it('keeps the native width when showing a single frame', () => {
      const store = standardStore()
      store.set(modeREnabledAtom, true)
      store.set(modeRPreviewModeAtom, 'frameA')
      expect(store.get(previewCanvasSizeAtom)).toEqual({
        width: 160,
        height: 200
      })
    })

    it('treats an unset preview mode as blended', () => {
      const store = standardStore()
      store.set(modeREnabledAtom, true)
      store.set(modeRPreviewModeAtom, undefined as never)
      expect(store.get(previewCanvasSizeAtom).width).toBe(320)
    })
  })
})
