/**
 * App-wide toast notifications for cross-cutting events that aren't owned by a
 * single feature panel (e.g. the silent GPU→CPU processor fallback).
 *
 * The store stays i18n-free: it carries a `kind` discriminant and the UI
 * (`<Toaster />`) maps it to a localized message.
 */

import { atom } from 'jotai'

export type ToastKind =
  | 'gpu-fallback'
  | 'image-too-large'
  | 'image-dimensions-too-large'

export interface ToastState {
  readonly kind: ToastKind
  readonly open: boolean
}

export const toastAtom = atom<ToastState | null>(null)

/** Show a toast for the given kind. */
export const pushToastAtom = atom(null, (_get, set, kind: ToastKind) => {
  set(toastAtom, { kind, open: true })
})

/** Hide the current toast (kept mounted so the close transition can play). */
export const dismissToastAtom = atom(null, (get, set) => {
  const current = get(toastAtom)
  if (current) set(toastAtom, { ...current, open: false })
})
