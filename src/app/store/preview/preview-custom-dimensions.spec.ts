import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'
import {
  targetDimensionsAtom,
  modeAtom,
  setTargetDimensionsAtom
} from '../config/config'
import { previewCanvasSizeAtom, previewCanvasWidthAtom } from './preview'

describe('Preview Pipeline - Target Dimensions', () => {
  it('should use target dimensions for mode 0 with standard dimensions', () => {
    const store = createStore()
    store.set(previewCanvasWidthAtom, 800)
    store.set(modeAtom, '0')
    store.set(setTargetDimensionsAtom, { width: 160, height: 200 })

    const size = store.get(previewCanvasSizeAtom)

    // Mode 0: 160×200, scaleX=2, scaleY=1 → visual 320×200
    // Scale to fit 800: min(800/320, 1) = 1
    expect(size.width).toBe(320)
    expect(size.height).toBe(200)
  })

  it('should use target dimensions for mode 0 with overscan dimensions', () => {
    const store = createStore()
    store.set(previewCanvasWidthAtom, 800)
    store.set(modeAtom, '0')
    store.set(setTargetDimensionsAtom, { width: 192, height: 280 })

    const size = store.get(previewCanvasSizeAtom)

    // Mode 0 overscan: 192×280, scaleX=2, scaleY=1 → visual 384×280
    expect(size.width).toBe(384)
    expect(size.height).toBe(280)
  })

  it('should use targetDimensionsAtom for custom mode 0', () => {
    const store = createStore()
    store.set(previewCanvasWidthAtom, 800)
    store.set(modeAtom, '0')
    store.set(setTargetDimensionsAtom, { width: 164, height: 248 })

    const targetDims = store.get(targetDimensionsAtom)
    expect(targetDims.width).toBe(164)
    expect(targetDims.height).toBe(248)

    const size = store.get(previewCanvasSizeAtom)

    // Custom 164×248, scaleX=2, scaleY=1 → visual 328×248
    expect(size.width).toBe(328)
    expect(size.height).toBe(248)
  })

  it('should use targetDimensionsAtom for custom mode 1', () => {
    const store = createStore()
    store.set(previewCanvasWidthAtom, 800)
    store.set(modeAtom, '1')
    store.set(setTargetDimensionsAtom, { width: 328, height: 248 })

    const size = store.get(previewCanvasSizeAtom)

    // Custom 328×248, scaleX=1, scaleY=1 → visual 328×248
    expect(size.width).toBe(328)
    expect(size.height).toBe(248)
  })

  it('should use targetDimensionsAtom for custom mode 2', () => {
    const store = createStore()
    store.set(previewCanvasWidthAtom, 800)
    store.set(modeAtom, '2')
    store.set(setTargetDimensionsAtom, { width: 656, height: 248 })

    const size = store.get(previewCanvasSizeAtom)

    // Custom 656×248, scaleX=1, scaleY=2 → visual 656×496
    expect(size.width).toBe(656)
    expect(size.height).toBe(496)
  })

  it('should update preview size when target dimensions change', () => {
    const store = createStore()
    store.set(previewCanvasWidthAtom, 800)
    store.set(modeAtom, '0')
    store.set(setTargetDimensionsAtom, { width: 160, height: 200 })

    let size = store.get(previewCanvasSizeAtom)
    expect(size.width).toBe(320) // 160×2
    expect(size.height).toBe(200)

    // Change target dimensions
    store.set(setTargetDimensionsAtom, { width: 164, height: 248 })

    size = store.get(previewCanvasSizeAtom)
    expect(size.width).toBe(328) // 164×2
    expect(size.height).toBe(248)
  })

  it('should scale down to fit container width', () => {
    const store = createStore()
    store.set(previewCanvasWidthAtom, 400) // Small container
    store.set(modeAtom, '0')
    store.set(setTargetDimensionsAtom, { width: 320, height: 248 })

    const size = store.get(previewCanvasSizeAtom)

    // Custom 320×248, scaleX=2, scaleY=1 → visual 640×248
    // Scale to fit 400: min(400/640, 1) = 0.625
    expect(size.width).toBe(Math.floor(640 * 0.625))
    expect(size.height).toBe(Math.floor(248 * 0.625))
  })
})
