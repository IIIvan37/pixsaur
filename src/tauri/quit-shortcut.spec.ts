import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isEditableElement, isQuitShortcut } from './quit-shortcut'

describe('quit-shortcut', () => {
  let originalActive: Element | null

  beforeEach(() => {
    originalActive = document.activeElement
  })
  afterEach(() => {
    ;(originalActive as any)?.focus?.()
  })

  describe('isEditableElement', () => {
    it('returns false for null', () => {
      expect(isEditableElement(null)).toBe(false)
    })

    it('returns true for input element', () => {
      const input = document.createElement('input')
      expect(isEditableElement(input)).toBe(true)
    })

    it('returns true for textarea element', () => {
      const textarea = document.createElement('textarea')
      expect(isEditableElement(textarea)).toBe(true)
    })

    it('returns true for select element', () => {
      const select = document.createElement('select')
      expect(isEditableElement(select)).toBe(true)
    })

    it('returns true for contentEditable element', () => {
      const div = document.createElement('div')
      div.contentEditable = 'true'
      expect(isEditableElement(div)).toBe(true)
    })

    it('returns false for non-editable div', () => {
      const div = document.createElement('div')
      expect(isEditableElement(div)).toBe(false)
    })

    it('returns false for span', () => {
      const span = document.createElement('span')
      expect(isEditableElement(span)).toBe(false)
    })
  })

  describe('isQuitShortcut', () => {
    it('returns true for Ctrl+Q', () => {
      const event = new KeyboardEvent('keydown', { key: 'q', ctrlKey: true })
      expect(isQuitShortcut(event)).toBe(true)
    })

    it('returns true for Meta+Q', () => {
      const event = new KeyboardEvent('keydown', { key: 'Q', metaKey: true })
      expect(isQuitShortcut(event)).toBe(true)
    })

    it('returns false without modifier key', () => {
      const event = new KeyboardEvent('keydown', { key: 'q' })
      expect(isQuitShortcut(event)).toBe(false)
    })

    it('returns false for different key with Ctrl', () => {
      const event = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true })
      expect(isQuitShortcut(event)).toBe(false)
    })

    it('returns false when focused on input', () => {
      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()

      const event = new KeyboardEvent('keydown', { key: 'q', ctrlKey: true })
      expect(isQuitShortcut(event)).toBe(false)

      document.body.removeChild(input)
    })

    it('returns false when focused on textarea', () => {
      const textarea = document.createElement('textarea')
      document.body.appendChild(textarea)
      textarea.focus()

      const event = new KeyboardEvent('keydown', { key: 'q', ctrlKey: true })
      expect(isQuitShortcut(event)).toBe(false)

      document.body.removeChild(textarea)
    })
  })
})
