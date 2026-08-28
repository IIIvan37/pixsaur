/**
 * Which workshop the application is showing (Q6).
 *
 * A switcher that replaces the whole content, not a pair of views over one
 * document: greying out the controls the tileset has no use for would be more
 * puzzling than not showing them at all.
 */

import { atom } from 'jotai'

export type Workshop = 'image' | 'tileset'

export const activeWorkshopAtom = atom<Workshop>('image')
