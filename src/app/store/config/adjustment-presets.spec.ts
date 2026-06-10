import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'
import {
  ADJUSTMENT_PRESETS,
  applyAdjustmentPresetAtom
} from './adjustment-presets'
import {
  activePresetIdAtom,
  adjustmentsAtom,
  defaultAdjustments,
  setAdjustmentAtom
} from './adjustments'

describe('Adjustment presets', () => {
  it('defaults to the neutral preset', () => {
    const store = createStore()
    expect(store.get(activePresetIdAtom)).toBe('neutral')
  })

  it('applies a preset over defaults and records the active id', () => {
    const store = createStore()
    // dirty an unrelated value first to prove reset-then-overlay
    store.set(setAdjustmentAtom, { key: 'hue', value: 90 })

    store.set(applyAdjustmentPresetAtom, 'dark-photo')

    const adj = store.get(adjustmentsAtom)
    // preset keys
    expect(adj.gamma).toBe(1.15)
    expect(adj.shadows).toBe(25)
    expect(adj.vibrance).toBe(60)
    expect(adj.contrast).toBe(1.2)
    // everything else back to default (hue was 90)
    expect(adj.hue).toBe(defaultAdjustments.hue)
    expect(adj.saturation).toBe(defaultAdjustments.saturation)
    expect(adj.lastChangedKey).toBeNull()
    expect(store.get(activePresetIdAtom)).toBe('dark-photo')
  })

  it('neutral preset restores all defaults', () => {
    const store = createStore()
    store.set(setAdjustmentAtom, { key: 'vibrance', value: 80 })

    store.set(applyAdjustmentPresetAtom, 'neutral')

    const adj = store.get(adjustmentsAtom)
    expect(adj.vibrance).toBe(defaultAdjustments.vibrance)
    expect(store.get(activePresetIdAtom)).toBe('neutral')
  })

  it('clears the active preset to null on a manual adjustment', () => {
    const store = createStore()
    store.set(applyAdjustmentPresetAtom, 'vivid')
    expect(store.get(activePresetIdAtom)).toBe('vivid')

    store.set(setAdjustmentAtom, { key: 'brightness', value: 1.2 })
    expect(store.get(activePresetIdAtom)).toBeNull()
  })

  it('ignores an unknown preset id', () => {
    const store = createStore()
    const before = store.get(adjustmentsAtom)
    // @ts-expect-error: intentionally invalid id
    store.set(applyAdjustmentPresetAtom, 'does-not-exist')
    expect(store.get(adjustmentsAtom)).toEqual(before)
  })

  it('every preset references only valid adjustment keys', () => {
    const validKeys = new Set(Object.keys(defaultAdjustments))
    for (const preset of ADJUSTMENT_PRESETS) {
      for (const key of Object.keys(preset.values)) {
        expect(validKeys.has(key)).toBe(true)
      }
    }
  })
})
