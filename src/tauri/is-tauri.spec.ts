import { beforeEach, describe, expect, it } from 'vitest'
import { isTauri } from '@/tauri'

describe('isTauri', () => {
  beforeEach(() => {
    delete (globalThis as any).__TAURI_INTERNALS__
  })

  it('should return false when not in Tauri environment', () => {
    expect(isTauri()).toBe(false)
  })

  it('should return true when __TAURI_INTERNALS__ is present', () => {
    ;(globalThis as any).__TAURI_INTERNALS__ = {}
    expect(isTauri()).toBe(true)
  })
})
