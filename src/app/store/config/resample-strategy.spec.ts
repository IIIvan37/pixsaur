import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'
import { resampleStrategyAtom, setResampleStrategyAtom } from './processing'

describe('resampleStrategyAtom', () => {
  it('defaults to lanczos2 (highest quality)', () => {
    const store = createStore()
    expect(store.get(resampleStrategyAtom)).toBe('lanczos2')
  })

  it('is updated through setResampleStrategyAtom', () => {
    const store = createStore()
    store.set(setResampleStrategyAtom, 'box')
    expect(store.get(resampleStrategyAtom)).toBe('box')

    store.set(setResampleStrategyAtom, 'tent')
    expect(store.get(resampleStrategyAtom)).toBe('tent')
  })
})
