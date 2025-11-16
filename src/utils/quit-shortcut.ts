/**
 * Helper utilities for keyboard shortcuts that should quit the app.
 *
 * This is intentionally lightweight and platform-agnostic: it detects
 * Cmd+Q (macOS) and Ctrl+Q (Windows/Linux) and excludes key presses
 * that occur while the user is typing in form fields.
 */

export function isEditableElement(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName?.toUpperCase?.() || ''
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  // contentEditable elements should be considered editable
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

export function isQuitShortcut(event: KeyboardEvent): boolean {
  // Only consider Ctrl or Meta (Cmd on macOS) modifiers
  if (!(event.ctrlKey || event.metaKey)) return false

  // We only want to match the Q key (case-insensitive)
  if ((event.key || '').toLowerCase() !== 'q') return false

  // Do not trigger while the user is composing (IME)
  if ((event as any).isComposing) return false

  // Ignore when focus is in an editable element
  if (isEditableElement(document.activeElement)) return false

  return true
}

export default isQuitShortcut
