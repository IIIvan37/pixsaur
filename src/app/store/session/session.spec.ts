import { createStore } from 'jotai'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { colorDiversityAtom, paletteStrategyAtom } from '../config/processing'
import { manualPixelEditsAtom } from '../preview/pipeline/manual-edits'
import {
  captureSessionAtom,
  loadSnapshot,
  persistSnapshot,
  restoreSessionAtom
} from './session'
import { SESSION_STORAGE_KEY, type SessionSnapshot } from './session-types'

afterEach(() => {
  globalThis.localStorage?.clear()
  vi.restoreAllMocks()
})

function baseSnapshot(): SessionSnapshot {
  const store = createStore()
  return store.get(captureSessionAtom)
}

describe('captureSessionAtom', () => {
  it('captures the current settings as a serializable snapshot', () => {
    const store = createStore()
    store.set(paletteStrategyAtom, 'adaptive')
    store.set(colorDiversityAtom, 80)

    const snapshot = store.get(captureSessionAtom)

    expect(snapshot.paletteStrategy).toBe('adaptive')
    expect(snapshot.colorDiversity).toBe(80)
    expect(snapshot.image).toBeNull()
    // round-trips through JSON without throwing
    expect(() => JSON.stringify(snapshot)).not.toThrow()
  })

  it('serializes manual edits as entries', () => {
    const store = createStore()
    store.set(
      manualPixelEditsAtom,
      new Map([
        ['0,0', 3],
        ['1,2', 5]
      ])
    )

    expect(store.get(captureSessionAtom).manualEdits).toEqual([
      ['0,0', 3],
      ['1,2', 5]
    ])
  })
})

describe('restoreSessionAtom', () => {
  it('applies a snapshot to the live atoms', async () => {
    const store = createStore()
    const snapshot: SessionSnapshot = {
      ...baseSnapshot(),
      paletteStrategy: 'adaptive',
      colorDiversity: 12,
      rasterEnabled: true,
      manualEdits: [['4,5', 7]]
    }

    await store.set(restoreSessionAtom, snapshot)

    expect(store.get(paletteStrategyAtom)).toBe('adaptive')
    expect(store.get(colorDiversityAtom)).toBe(12)
    expect(store.get(manualPixelEditsAtom).get('4,5')).toBe(7)
  })

  it('round-trips capture → restore', async () => {
    const source = createStore()
    source.set(paletteStrategyAtom, 'perceptual-balanced')
    source.set(colorDiversityAtom, 33)
    const snapshot = source.get(captureSessionAtom)

    const target = createStore()
    await target.set(restoreSessionAtom, snapshot)

    expect(target.get(paletteStrategyAtom)).toBe('perceptual-balanced')
    expect(target.get(colorDiversityAtom)).toBe(33)
  })
})

describe('persistSnapshot / loadSnapshot', () => {
  it('round-trips through localStorage', () => {
    const snapshot = baseSnapshot()
    persistSnapshot(snapshot)
    expect(loadSnapshot()).toEqual(snapshot)
  })

  it('returns null for a stale version', () => {
    globalThis.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ version: 999 })
    )
    expect(loadSnapshot()).toBeNull()
  })

  it('returns null when nothing is stored', () => {
    expect(loadSnapshot()).toBeNull()
  })

  it('drops the image and keeps settings when the quota is exceeded', () => {
    const snapshot: SessionSnapshot = {
      ...baseSnapshot(),
      image: { src: 'data:image/png;base64,AAAA' }
    }

    const setItem = vi
      .spyOn(globalThis.localStorage, 'setItem')
      .mockImplementationOnce(() => {
        throw new DOMException('quota', 'QuotaExceededError')
      })

    persistSnapshot(snapshot)

    // Second call (the fallback) persists with image stripped.
    expect(setItem).toHaveBeenCalledTimes(2)
    const persisted = JSON.parse(setItem.mock.calls[1][1] as string)
    expect(persisted.image).toBeNull()
    expect(persisted.paletteStrategy).toBe(snapshot.paletteStrategy)
  })
})
