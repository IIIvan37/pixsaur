import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isQuitShortcut } from '@/tauri'

describe('quit-shortcut', () => {
  let originalActive: Element | null

  beforeEach(() => {
    originalActive = document.activeElement
  })
  afterEach(() => {
    ;(originalActive as any)?.focus?.()
  })

  it('returns true for Ctrl+Q', () => {
    const event = new KeyboardEvent('keydown', { key: 'q', ctrlKey: true })
    expect(isQuitShortcut(event)).toBe(true)
  })

  it('returns true for Meta+Q', () => {
    const event = new KeyboardEvent('keydown', { key: 'Q', metaKey: true })
    expect(isQuitShortcut(event)).toBe(true)
  })
})
