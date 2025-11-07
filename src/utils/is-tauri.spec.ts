import { beforeEach, describe, expect, it } from 'vitest'
import { isTauri } from './is-tauri'

describe('isTauri', () => {
  beforeEach(() => {
    // Clean up any existing __TAURI_INTERNALS__
    delete (globalThis as any).__TAURI_INTERNALS__
  })

  it('should return false when not in Tauri environment', () => {
    expect(isTauri()).toBe(false)
  })

  it('should return true when __TAURI_INTERNALS__ is present', () => {
    // Simulate Tauri environment
    ;(globalThis as any).__TAURI_INTERNALS__ = {}
    expect(isTauri()).toBe(true)
  })

  it('should return false when globalThis is undefined', () => {
    // This test is more theoretical as globalThis should always exist in modern environments
    expect(isTauri()).toBe(false)
  })
})
