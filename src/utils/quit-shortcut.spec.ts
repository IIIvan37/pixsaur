import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isEditableElement, isQuitShortcut } from './quit-shortcut'

describe('quit-shortcut', () => {
  let originalActive: Element | null

  beforeEach(() => {
    originalActive = document.activeElement
  })
  afterEach(() => {
    // Restore active element to avoid side effects across tests
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

  it('returns false for non-Q keys', () => {
    const event = new KeyboardEvent('keydown', { key: 'w', ctrlKey: true })
    expect(isQuitShortcut(event)).toBe(false)
  })

  it('returns false for no modifier (just Q)', () => {
    const event = new KeyboardEvent('keydown', { key: 'q' })
    expect(isQuitShortcut(event)).toBe(false)
  })

  it('returns false when active element is an input', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    const event = new KeyboardEvent('keydown', { key: 'q', ctrlKey: true })
    expect(isEditableElement(document.activeElement)).toBe(true)
    expect(isQuitShortcut(event)).toBe(false)
    input.remove()
  })

  it('returns false when active element is contentEditable', () => {
    const div = document.createElement('div')
    div.contentEditable = 'true'
    document.body.appendChild(div)
    div.focus()
    const event = new KeyboardEvent('keydown', { key: 'q', ctrlKey: true })
    expect(isEditableElement(document.activeElement)).toBe(true)
    expect(isQuitShortcut(event)).toBe(false)
    div.remove()
  })
})
