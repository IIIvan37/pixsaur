/**
 * Move of the quit-shortcut helper from utils to tauri domain.
 * This function is used to detect application-level quit key combos
 * and should live near platform code so it can be mocked in tests.
 */

export function isEditableElement(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName?.toUpperCase?.() || ''
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

export function isQuitShortcut(event: KeyboardEvent): boolean {
  if (!(event.ctrlKey || event.metaKey)) return false
  if ((event.key || '').toLowerCase() !== 'q') return false
  if ((event as any).isComposing) return false
  if (isEditableElement(document.activeElement)) return false
  return true
}

export default isQuitShortcut
