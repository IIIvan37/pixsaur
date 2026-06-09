import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'
import { mode0FilterAtom, setMode0FilterAtom } from './processing'

describe('mode0FilterAtom', () => {
  it('defaults to lanczos2 (highest quality)', () => {
    const store = createStore()
    expect(store.get(mode0FilterAtom)).toBe('lanczos2')
  })

  it('is updated through setMode0FilterAtom', () => {
    const store = createStore()
    store.set(setMode0FilterAtom, 'box')
    expect(store.get(mode0FilterAtom)).toBe('box')

    store.set(setMode0FilterAtom, 'tent')
    expect(store.get(mode0FilterAtom)).toBe('tent')
  })
})
